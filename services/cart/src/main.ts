import { api } from '@cesto/contracts';
import { ServiceClient, createService, createVerifier, listen, route } from '@cesto/core';
import { EventBus, Redis } from '@cesto/bus';
import { env } from './env.js';
import { CartService } from './cart.js';

const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

const app = await createService({
  name: 'cart',
  env,
  verifier: createVerifier({ jwksUrl: `${env.AUTH_URL}/oauth/jwks`, issuer: env.AUTH_ISSUER, audience: env.AUTH_AUDIENCE }),
  checks: { redis: async () => (await redis.ping()) === 'PONG' }
});

const client = new ServiceClient({ authUrl: env.AUTH_URL, clientId: env.SERVICE_CLIENT_ID, clientSecret: env.SERVICE_CLIENT_SECRET });
const cart = new CartService(redis, client, { ttlSeconds: env.CART_TTL_DAYS * 86_400, maxItems: env.CART_MAX_ITEMS, catalogUrl: env.CATALOG_URL });
const bus = new EventBus({ redis, service: 'cart', logger: app.log });

await bus.subscribe({
  'order.placed': async (e) => {
    await cart.clear(e.payload.userId);
  }
});

route(app, api.cart.get, ({ principal }) => cart.view(principal.id));
route(app, api.cart.add, ({ principal, body }) => cart.add(principal.id, body.productId, body.quantity));
route(app, api.cart.update, ({ principal, params, body }) => cart.update(principal.id, params.productId, body.quantity));
route(app, api.cart.clear, ({ principal }) => cart.clear(principal.id));
route(app, api.cart.raw, ({ params }) => cart.raw(params.userId));

await listen(app, env, [bus.stop.bind(bus), () => redis.quit()]);
