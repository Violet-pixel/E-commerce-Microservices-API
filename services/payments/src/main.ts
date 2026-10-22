import { api } from '@cesto/contracts';
import { createService, createVerifier, listen, route, startOutboxRelay } from '@cesto/core';
import { EventBus, Redis } from '@cesto/bus';
import { env } from './env.js';
import { createDb } from './db.js';
import { SimulatedGateway } from './gateway.js';
import { PaymentService } from './payments.js';

const db = createDb(env.DATABASE_URL);
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const app = await createService({
  name: 'payments',
  env,
  verifier: createVerifier({ jwksUrl: `${env.AUTH_URL}/oauth/jwks`, issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE }),
  checks: {
    postgres: async () => (await db.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`).length === 1,
    redis: async () => (await redis.ping()) === 'PONG'
  }
});

const bus = new EventBus({ redis, service: 'payments', logger: app.log });
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

const gateway = new SimulatedGateway({ declineAboveCents: env.PAYMENT_DECLINE_ABOVE_CENTS, delayMs: env.PAYMENT_DELAY_MS });
const payments = new PaymentService(db, gateway, relay.notify);

await bus.subscribe({
  'payment.requested': (e) => payments.onPaymentRequested(e),
  'order.cancelled': (e) => payments.onOrderCancelled(e)
});

route(app, api.payments.byOrder, ({ params, principal }) => payments.byOrder(params.orderId, principal));

await listen(app, env, [bus.stop.bind(bus), relay.stop, () => db.$disconnect(), () => redis.quit()]);
