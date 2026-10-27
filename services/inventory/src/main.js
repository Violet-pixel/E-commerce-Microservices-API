import { api } from '@cesto/contracts';
import { createService, createVerifier, listen, route, startOutboxRelay } from '@cesto/core';
import { EventBus, Redis } from '@cesto/bus';
import { env } from './env.js';
import { createDb } from './db.js';
import { InventoryService } from './inventory.js';

const db = createDb(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const app = await createService({
  name: 'inventory',
  env,
  verifier: createVerifier({ jwksUrl: `${env.AUTH_URL}/oauth/jwks`, issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE }),
  checks: {
    postgres: async () => (await db.$queryRaw`SELECT 1 AS ok`).length === 1,
    redis: async () => (await redis.ping()) === 'PONG'
  }
});

const bus = new EventBus({ redis, service: 'inventory', logger: app.log });
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

const inventory = new InventoryService(db, relay.notify, env.SEED_DEMO);

await bus.subscribe({
  'product.created': (e) => inventory.onProductCreated(e),
  'product.updated': (e) => inventory.onProductUpdated(e),
  'order.placed': (e) => inventory.onOrderPlaced(e),
  'order.confirmed': (e) => inventory.onOrderConfirmed(e),
  'order.cancelled': (e) => inventory.onOrderCancelled(e)
});

route(app, api.inventory.list, ({ query }) => inventory.list(query.productIds));
route(app, api.inventory.set, ({ params, body }) => inventory.set(params.id, body.available));

await listen(app, env, [bus.stop.bind(bus), relay.stop, () => db.$disconnect(), () => redis.quit()]);
