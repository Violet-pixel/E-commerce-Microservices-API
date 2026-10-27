import { api } from '@cesto/contracts';
import { ServiceClient, createService, createVerifier, listen, route, startOutboxRelay } from '@cesto/core';
import { EventBus, Redis } from '@cesto/bus';
import { env } from './env.js';
import { createDb } from './db.js';
import { OrderService } from './orders.js';

const db = createDb(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const app = await createService({
  name: 'orders',
  env,
  verifier: createVerifier({ jwksUrl: `${env.AUTH_URL}/oauth/jwks`, issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE }),
  checks: {
    postgres: async () => (await db.$queryRaw`SELECT 1 AS ok`).length === 1,
    redis: async () => (await redis.ping()) === 'PONG'
  }
});

const bus = new EventBus({ redis, service: 'orders', logger: app.log });
const relay = startOutboxRelay({
  publisher: bus,
  store: {
    pending: (take) => db.outboxEvent.findMany({ where: { publishedAt: null }, orderBy: { createdAt: 'asc' }, take, select: { id: true, envelope: true } }),
    markPublished: async (ids) => {
      await db.outboxEvent.updateMany({ where: { id: { in: ids } }, data: { publishedAt: new Date() } });
    }
  },
  onError: (error) => app.log.error({ err: error }, 'falha no outbox')
});

const client = new ServiceClient({ authUrl: env.AUTH_URL, clientId: env.SERVICE_CLIENT_ID, clientSecret: env.SERVICE_CLIENT_SECRET });
const orders = new OrderService(db, client, { catalogUrl: env.CATALOG_URL, cartUrl: env.CART_URL }, relay.notify);

await bus.subscribe({
  'inventory.reserved': (e) => orders.onInventoryReserved(e),
  'inventory.rejected': (e) => orders.onInventoryRejected(e),
  'payment.approved': (e) => orders.onPaymentApproved(e),
  'payment.declined': (e) => orders.onPaymentDeclined(e)
});

route(app, api.orders.checkout, ({ principal, body, request }) => orders.checkout(principal.id, body, request.id));
route(app, api.orders.list, ({ principal, query }) => orders.list(query, principal));
route(app, api.orders.get, ({ principal, params }) => orders.get(params.id, principal));
route(app, api.orders.cancel, ({ principal, params }) => orders.cancel(params.id, principal));
route(app, api.orders.updateStatus, ({ params, body }) => orders.updateStatus(params.id, body.status, body.note));

await listen(app, env, [bus.stop.bind(bus), relay.stop, () => db.$disconnect(), () => redis.quit()]);
