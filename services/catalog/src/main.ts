import { api } from '@cesto/contracts';
import { createService, createVerifier, isAdmin, listen, route, startOutboxRelay } from '@cesto/core';
import { EventBus, Redis } from '@cesto/bus';
import { env } from './env.js';
import { createDb } from './db.js';
import { CatalogService } from './catalog.js';
import { seed } from './seed.js';

const db = createDb(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const bus = new EventBus({ redis, service: 'catalog' });

const app = await createService({
  name: 'catalog',
  env,
  verifier: createVerifier({ jwksUrl: `${env.AUTH_URL}/oauth/jwks`, issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE }),
  checks: {
    postgres: async () => (await db.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`).length === 1,
    redis: async () => (await redis.ping()) === 'PONG'
  }
});

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

const catalog = new CatalogService(db, relay.notify);
if (env.SEED_DEMO) await seed(db);

route(app, api.catalog.listProducts, ({ query, principal }) => catalog.list(query, isAdmin(principal)));
route(app, api.catalog.getProduct, ({ params, principal }) => catalog.get(params.id, isAdmin(principal)));
route(app, api.catalog.createProduct, ({ body }) => catalog.create(body));
route(app, api.catalog.updateProduct, ({ params, body }) => catalog.update(params.id, body));
route(app, api.catalog.deleteProduct, ({ params }) => catalog.deactivate(params.id));
route(app, api.catalog.listCategories, () => catalog.categories());
route(app, api.catalog.createCategory, ({ body }) => catalog.createCategory(body));
route(app, api.catalog.lookup, ({ body }) => catalog.lookup(body.ids));

await listen(app, env, [relay.stop, () => db.$disconnect(), () => redis.quit()]);
