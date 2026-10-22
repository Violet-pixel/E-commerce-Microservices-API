import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest, FastifyBaseLogger } from 'fastify';
import cors from '@fastify/cors';
import type { ZodType } from 'zod';
import type { AnyEndpoint, EndpointBody, EndpointParams, EndpointQuery, EndpointResponse } from '@cesto/contracts';
import { bearer, enforce } from './auth.js';
import type { Principal, TokenVerifier } from './auth.js';
import { mapError } from './errors.js';
import type { MappedError } from './errors.js';
import type { BaseEnv } from './config.js';

export type HealthCheck = () => Promise<boolean>;

export interface ServiceOptions {
  name: string;
  env: BaseEnv;
  verifier: TokenVerifier | null;
  checks?: Record<string, HealthCheck>;
  bodyLimit?: number;
  formatError?: (mapped: MappedError, request: FastifyRequest) => { status: number; body: unknown; headers?: Record<string, string> } | null;
}

declare module 'fastify' {
  interface FastifyInstance {
    verifier: TokenVerifier | null;
    serviceName: string;
  }
}

export const createService = async (options: ServiceOptions): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: {
      level: options.env.LOG_LEVEL,
      base: { service: options.name },
      redact: ['req.headers.authorization', 'req.headers.cookie']
    },
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      return typeof incoming === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
    },
    trustProxy: true,
    bodyLimit: options.bodyLimit ?? 1_048_576,
    ajv: undefined
  });

  app.decorate('verifier', options.verifier);
  app.decorate('serviceName', options.name);

  app.setValidatorCompiler(({ schema }) => (data: unknown) => {
    const result = (schema as ZodType).safeParse(data);
    return result.success ? { value: result.data } : { error: result.error };
  });

  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  await app.register(cors, { origin: options.env.CORS_ORIGINS, credentials: true });

  app.setErrorHandler((error, request, reply) => {
    const mapped = mapError(error, request.id);
    if (mapped.status >= 500) request.log.error({ err: error }, 'falha não tratada');
    else request.log.debug({ err: error }, 'erro de domínio');
    const custom = options.formatError?.(mapped, request);
    if (custom) {
      void reply.status(custom.status).headers(custom.headers ?? {}).send(custom.body);
      return;
    }
    void reply.status(mapped.status).send({ ok: false, error: mapped.body });
  });

  app.setNotFoundHandler((request, reply) => {
    void reply.status(404).send({ ok: false, error: { code: 'NOT_FOUND', message: `Rota ${request.method} ${request.url} não existe`, requestId: request.id } });
  });

  app.get('/health', async (_request, reply) => {
    const entries = await Promise.all(
      Object.entries(options.checks ?? {}).map(async ([name, check]) => {
        try {
          return [name, await check()] as const;
        } catch {
          return [name, false] as const;
        }
      })
    );
    const checks = Object.fromEntries(entries);
    const healthy = entries.every(([, ok]) => ok);
    return reply.status(healthy ? 200 : 503).send({ status: healthy ? 'ok' : 'degraded', service: options.name, checks });
  });

  return app;
};

export interface RouteContext<E extends AnyEndpoint> {
  params: EndpointParams<E>;
  query: EndpointQuery<E>;
  body: EndpointBody<E>;
  principal: E['auth'] extends 'public' ? Principal | null : Principal;
  request: FastifyRequest;
  reply: FastifyReply;
  log: FastifyBaseLogger;
}

export type RouteHandler<E extends AnyEndpoint> = (ctx: RouteContext<E>) => Promise<EndpointResponse<E>> | EndpointResponse<E>;

export const resolvePrincipal = async (app: FastifyInstance, request: FastifyRequest): Promise<Principal | null> => {
  const token = bearer(request.headers.authorization);
  if (!token) return null;
  if (!app.verifier) return null;
  return app.verifier.verify(token);
};

export const route = <E extends AnyEndpoint>(app: FastifyInstance, endpoint: E, handler: RouteHandler<E>): void => {
  const schema: Record<string, unknown> = {};
  if (endpoint.params) schema.params = endpoint.params;
  if (endpoint.query) schema.querystring = endpoint.query;
  if (endpoint.body) schema.body = endpoint.body;
  app.route({
    method: endpoint.method,
    url: endpoint.path,
    schema,
    handler: async (request, reply) => {
      const principal = await resolvePrincipal(app, request);
      enforce(endpoint, principal);
      const result = await handler({
        params: request.params as EndpointParams<E>,
        query: (request.query ?? {}) as EndpointQuery<E>,
        body: request.body as EndpointBody<E>,
        principal: principal as RouteContext<E>['principal'],
        request,
        reply,
        log: request.log
      });
      const output = endpoint.response.parse(result);
      void reply.status(endpoint.status ?? 200);
      if (endpoint.raw) {
        void reply.header('cache-control', 'no-store');
        return output;
      }
      return { ok: true, data: output };
    }
  });
};

export const listen = async (app: FastifyInstance, env: BaseEnv, onClose: Array<() => Promise<unknown>> = []): Promise<void> => {
  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'encerrando');
    const timer = setTimeout(() => process.exit(1), 10_000);
    timer.unref();
    try {
      await app.close();
      for (const close of onClose) await close();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'erro ao encerrar');
      process.exit(1);
    }
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  await app.listen({ host: env.HOST, port: env.PORT });
};
