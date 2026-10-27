import formbody from '@fastify/formbody';
import { api, oauthErrorName } from '@cesto/contracts';
import { createService, createVerifier, listen, route } from '@cesto/core';
import { EventBus, Redis } from '@cesto/bus';
import { createLocalJWKSet } from 'jose';
import { env } from './env.js';
import { createDb } from './db.js';
import { loadSigner } from './keys.js';
import { OAuthService, toUserDto } from './oauth.js';
import { seed } from './seed.js';

const db = createDb(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const signer = await loadSigner(db, env.AUTH_ISSUER, env.AUTH_AUDIENCE);
const bus = new EventBus({ redis, service: 'auth' });
const oauth = new OAuthService(db, signer, { accessTtl: env.ACCESS_TOKEN_TTL, refreshTtl: env.REFRESH_TOKEN_TTL, codeTtl: env.AUTH_CODE_TTL });

await seed(db, env);

const verifier = createVerifier({
  jwksUrl: 'local',
  issuer: env.AUTH_ISSUER,
  audience: env.AUTH_AUDIENCE,
  keySource: async (header, token) => createLocalJWKSet(await signer.jwks())(header, token)
});

const app = await createService({
  name: 'auth',
  env,
  verifier,
  checks: {
    postgres: async () => (await db.$queryRaw`SELECT 1 AS ok`).length === 1,
    redis: async () => (await redis.ping()) === 'PONG'
  },
  formatError: (mapped, request) => {
    const url = request.routeOptions.url ?? '';
    if (url !== '/oauth/token' && url !== '/oauth/revoke') return null;
    return {
      status: mapped.status === 422 ? 400 : mapped.status,
      headers: { 'cache-control': 'no-store' },
      body: { error: oauthErrorName[mapped.body.code] ?? 'server_error', error_description: mapped.body.message }
    };
  }
});

await app.register(formbody);

app.get('/.well-known/openid-configuration', async () => ({
  issuer: env.AUTH_ISSUER,
  authorization_endpoint: '/oauth/authorize',
  token_endpoint: '/oauth/token',
  revocation_endpoint: '/oauth/revoke',
  jwks_uri: '/oauth/jwks',
  grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
  response_types_supported: ['code'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['client_secret_post', 'none']
}));

route(app, api.auth.jwks, () => signer.jwks());
route(app, api.auth.authorize, ({ body }) => oauth.authorize(body));
route(app, api.auth.token, ({ body }) => oauth.token(body));
route(app, api.auth.revoke, async ({ body }) => {
  await oauth.revoke(body.token);
  return null;
});
route(app, api.auth.register, async ({ body }) => {
  const user = await oauth.register(body);
  await bus.publish('user.registered', { userId: user.id, email: user.email, name: user.name });
  return toUserDto(user);
});
route(app, api.auth.me, async ({ principal }) => toUserDto(await oauth.me(principal.id)));

const purge = setInterval(() => {
  oauth.purgeExpired().catch((error) => app.log.warn({ err: error }, 'falha ao limpar tokens expirados'));
}, 3_600_000);
purge.unref();

await listen(app, env, [() => db.$disconnect(), () => redis.quit()]);
