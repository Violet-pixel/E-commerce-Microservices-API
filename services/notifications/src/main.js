import { api } from '@cesto/contracts';
import { NotFoundError, createService, createVerifier, isUniqueViolation, iso, isoOrNull, listen, paginate, route } from '@cesto/core';
import { EventBus, Redis } from '@cesto/bus';
import { env } from './env.js';
import { createDb } from './db.js';
import { NOTIFIED_EVENTS, render } from './templates.js';

const db = createDb(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const app = await createService({
  name: 'notifications',
  env,
  verifier: createVerifier({ jwksUrl: `${env.AUTH_URL}/oauth/jwks`, issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE }),
  checks: {
    postgres: async () => (await db.$queryRaw`SELECT 1 AS ok`).length === 1,
    redis: async () => (await redis.ping()) === 'PONG'
  }
});

const toDto = (n) => ({
  id: n.id,
  userId: n.userId,
  kind: n.kind,
  title: n.title,
  body: n.body,
  orderId: n.orderId,
  readAt: isoOrNull(n.readAt),
  createdAt: iso(n.createdAt)
});

const bus = new EventBus({ redis, service: 'notifications', logger: app.log });
const store = async (event) => {
  const rendered = render(event);
  if (!rendered) return;
  try {
    await db.notification.create({ data: { eventId: event.id, ...rendered } });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
};
await bus.subscribe(Object.fromEntries(NOTIFIED_EVENTS.map((name) => [name, store])));

route(app, api.notifications.list, ({ principal, query }) => {
  const where = { userId: principal.id, ...(query.unread === true ? { readAt: null } : {}) };
  return paginate(query, (args) => db.$transaction([db.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...args }), db.notification.count({ where })]), toDto);
});
route(app, api.notifications.unread, async ({ principal }) => ({ unread: await db.notification.count({ where: { userId: principal.id, readAt: null } }) }));
route(app, api.notifications.markRead, async ({ principal, params }) => {
  const found = await db.notification.findFirst({ where: { id: params.id, userId: principal.id } });
  if (!found) throw new NotFoundError('Notificação', params.id);
  return toDto(found.readAt ? found : await db.notification.update({ where: { id: found.id }, data: { readAt: new Date() } }));
});
route(app, api.notifications.markAll, async ({ principal }) => {
  await db.notification.updateMany({ where: { userId: principal.id, readAt: null }, data: { readAt: new Date() } });
  return { unread: 0 };
});

await listen(app, env, [bus.stop.bind(bus), () => db.$disconnect(), () => redis.quit()]);
