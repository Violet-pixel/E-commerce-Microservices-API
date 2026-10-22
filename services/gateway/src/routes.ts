export interface Upstream {
  name: string;
  prefix: string;
  target: string;
}

export const upstreams = (env: {
  AUTH_URL: string;
  CATALOG_URL: string;
  INVENTORY_URL: string;
  CART_URL: string;
  ORDERS_URL: string;
  PAYMENTS_URL: string;
  NOTIFICATIONS_URL: string;
}): Upstream[] => [
  { name: 'auth', prefix: '/oauth', target: env.AUTH_URL },
  { name: 'auth', prefix: '/.well-known', target: env.AUTH_URL },
  { name: 'auth', prefix: '/api/v1/auth', target: env.AUTH_URL },
  { name: 'catalog', prefix: '/api/v1/catalog', target: env.CATALOG_URL },
  { name: 'inventory', prefix: '/api/v1/inventory', target: env.INVENTORY_URL },
  { name: 'cart', prefix: '/api/v1/cart', target: env.CART_URL },
  { name: 'orders', prefix: '/api/v1/orders', target: env.ORDERS_URL },
  { name: 'payments', prefix: '/api/v1/payments', target: env.PAYMENTS_URL },
  { name: 'notifications', prefix: '/api/v1/notifications', target: env.NOTIFICATIONS_URL }
];
