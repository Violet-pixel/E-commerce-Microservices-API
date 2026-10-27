import proxy from '@fastify/http-proxy';
import rateLimit from '@fastify/rate-limit';
import { Redis } from 'ioredis';
import { api } from '@cesto/contracts';
import { buildOpenApi, createService, listen } from '@cesto/core';
import { env } from './env.js';
import { upstreams } from './routes.js';
import { docsHtml } from './docs.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
const routes = upstreams(env);
const targets = [...new Map(routes.map((r) => [r.name, r.target])).entries()];

const app = await createService({
  name: 'gateway',
  env,
  verifier: null,
  checks: Object.fromEntries([
    ['redis', async () => (await redis.ping()) === 'PONG'],
    ...targets.map(([name, target]) => [name, async () => (await fetch(`${target}/health`, { signal: AbortSignal.timeout(2000) })).ok])
  ]),
  bodyLimit: 1_048_576
});

await app.register(rateLimit, {
  global: true,
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW,
  redis,
  nameSpace: 'cesto:ratelimit:',
  skipOnError: true,
  allowList: (request) => request.url === '/health'
});

const openapi = buildOpenApi(api, {
  title: 'Cesto API',
  version: '1.0.0',
  description: 'API de e-commerce com microsserviços em JavaScript (Node.js). Todas as respostas usam o envelope { ok, data } ou { ok: false, error }.'
});

app.get('/api/openapi.json', async () => openapi);
app.get('/api/docs', async (_request, reply) => reply.type('text/html; charset=utf-8').send(docsHtml));
app.all('/internal/*', async (_request, reply) => reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: 'Rota interna' } }));

for (const route of routes) {
  await app.register(proxy, {
    upstream: route.target,
    prefix: route.prefix,
    rewritePrefix: route.prefix,
    http2: false,
    replyOptions: {
      rewriteRequestHeaders: (request, headers) => ({ ...headers, 'x-request-id': request.id, 'x-forwarded-prefix': route.prefix })
    }
  });
}

await listen(app, env, [() => redis.quit()]);
