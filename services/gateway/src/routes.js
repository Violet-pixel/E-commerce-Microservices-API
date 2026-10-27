export const upstreams = (env) => [
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
