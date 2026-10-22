import { createHash, randomBytes } from 'node:crypto';

const base = process.env.API_URL ?? 'http://localhost:8080';
const password = process.env.DEMO_PASSWORD ?? 'Cesto@2026';
const redirect = process.env.REDIRECT_URI ?? 'http://localhost:8080/callback';
const steps = [];

const check = (name, condition, detail) => {
  steps.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? 'ok  ' : 'FALHOU'} ${name}${detail ? ` (${detail})` : ''}`);
  if (!condition) process.exitCode = 1;
};

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

const login = async (email) => {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const auth = await call('POST', '/oauth/authorize', {
    body: { response_type: 'code', client_id: 'cesto-web', redirect_uri: redirect, code_challenge: challenge, code_challenge_method: 'S256', state: 'smoke', email, password }
  });
  const token = await call('POST', '/oauth/token', {
    body: { grant_type: 'authorization_code', code: auth.json?.data?.code, redirect_uri: redirect, client_id: 'cesto-web', code_verifier: verifier }
  });
  return token.json;
};

const waitFor = async (fn, predicate, timeoutMs = 20000) => {
  const end = Date.now() + timeoutMs;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (predicate(last)) return last;
    await new Promise((r) => setTimeout(r, 400));
  }
  return last;
};

const address = { recipient: 'Cliente Teste', street: 'Rua das Flores', number: '100', district: 'Centro', city: 'Rio de Janeiro', state: 'rj', postalCode: '20000-000' };

const health = await call('GET', '/health');
check('gateway e serviços saudáveis', health.status === 200, JSON.stringify(health.json?.checks));

const list = await call('GET', '/api/v1/catalog/products?pageSize=50&sort=price_asc');
check('catálogo paginado', list.json?.ok && list.json.data.items.length > 0, `${list.json?.data?.total} produtos`);
const products = list.json.data.items;
const first = products.find((p) => p.sku === 'CAF-GRA-13');
const second = products.find((p) => p.sku === 'PAP-CAD-09');

const invalid = await call('GET', '/api/v1/catalog/products?pageSize=500');
check('validação estrita com Zod', invalid.status === 422 && invalid.json?.error?.code === 'VALIDATION_FAILED');

const anonymous = await call('GET', '/api/v1/cart');
check('rota protegida sem token', anonymous.status === 401 && anonymous.json?.error?.code === 'UNAUTHENTICATED');

const customer = await login('cliente@cesto.dev');
check('login OAuth2 com PKCE', Boolean(customer?.access_token && customer?.refresh_token), customer?.scope);

const before = await call('GET', `/api/v1/inventory?productIds=${first.id},${second.id}`);
const stockBefore = Object.fromEntries(before.json.data.map((s) => [s.productId, s.available]));

await call('DELETE', '/api/v1/cart', { token: customer.access_token });
await call('POST', '/api/v1/cart/items', { token: customer.access_token, body: { productId: first.id, quantity: 2 } });
const cart = await call('POST', '/api/v1/cart/items', { token: customer.access_token, body: { productId: second.id, quantity: 1 } });
const expected = first.priceCents * 2 + second.priceCents;
check('carrinho com total calculado', cart.json?.data?.totalCents === expected, `${cart.json?.data?.totalCents}`);

const order = await call('POST', '/api/v1/orders', { token: customer.access_token, body: { shippingAddress: address, paymentMethod: 'pix' } });
check('checkout aceito', order.status === 202 && order.json?.data?.status === 'PENDING', `#${order.json?.data?.number}`);
const confirmed = await waitFor(() => call('GET', `/api/v1/orders/${order.json.data.id}`, { token: customer.access_token }), (r) => r.json?.data?.status === 'CONFIRMED');
check('saga: reserva, pagamento e confirmação', confirmed.json?.data?.status === 'CONFIRMED', confirmed.json?.data?.history?.map((h) => h.status).join(' > '));

const emptied = await waitFor(() => call('GET', '/api/v1/cart', { token: customer.access_token }), (r) => r.json?.data?.items?.length === 0, 5000);
check('carrinho esvaziado pelo evento', emptied.json?.data?.items?.length === 0);

const after = await call('GET', `/api/v1/inventory?productIds=${first.id},${second.id}`);
const stockAfter = Object.fromEntries(after.json.data.map((s) => [s.productId, s.available]));
check('estoque baixado', stockAfter[first.id] === stockBefore[first.id] - 2 && stockAfter[second.id] === stockBefore[second.id] - 1);

await call('POST', '/api/v1/cart/items', { token: customer.access_token, body: { productId: first.id, quantity: 1 } });
const declined = await call('POST', '/api/v1/orders', { token: customer.access_token, body: { shippingAddress: address, paymentMethod: 'card', cardToken: 'tok_declined' } });
const cancelled = await waitFor(() => call('GET', `/api/v1/orders/${declined.json.data.id}`, { token: customer.access_token }), (r) => r.json?.data?.status === 'CANCELLED');
check('pagamento recusado cancela o pedido', cancelled.json?.data?.status === 'CANCELLED', cancelled.json?.data?.cancelReason);
const restored = await waitFor(
  () => call('GET', `/api/v1/inventory?productIds=${first.id}`),
  (r) => r.json?.data?.[0]?.available === stockAfter[first.id] && r.json?.data?.[0]?.reserved === 0,
  8000
);
check('estoque devolvido após recusa', restored.json?.data?.[0]?.available === stockAfter[first.id]);

const outOfStock = products.find((p) => p.sku === 'CAF-PRE-15');
await call('POST', '/api/v1/cart/items', { token: customer.access_token, body: { productId: outOfStock.id, quantity: 1 } });
const noStock = await call('POST', '/api/v1/orders', { token: customer.access_token, body: { shippingAddress: address, paymentMethod: 'pix' } });
const rejected = await waitFor(() => call('GET', `/api/v1/orders/${noStock.json.data.id}`, { token: customer.access_token }), (r) => r.json?.data?.status === 'CANCELLED');
check('sem estoque cancela o pedido', rejected.json?.data?.cancelReason === 'Estoque insuficiente');

const refreshed = await call('POST', '/oauth/token', { body: { grant_type: 'refresh_token', refresh_token: customer.refresh_token, client_id: 'cesto-web' } });
check('refresh token com rotação', refreshed.status === 200 && refreshed.json?.refresh_token !== customer.refresh_token);
const reuse = await call('POST', '/oauth/token', { body: { grant_type: 'refresh_token', refresh_token: customer.refresh_token, client_id: 'cesto-web' } });
check('reuso de refresh token bloqueado', reuse.status === 400 && reuse.json?.error === 'invalid_grant');
const family = await call('POST', '/oauth/token', { body: { grant_type: 'refresh_token', refresh_token: refreshed.json.refresh_token, client_id: 'cesto-web' } });
check('família de tokens revogada após reuso', family.status === 400);

const forbidden = await call('PATCH', `/api/v1/orders/${order.json.data.id}/status`, { token: customer.access_token, body: { status: 'SHIPPED' } });
check('cliente não altera status', forbidden.status === 403);

const admin = await login('admin@cesto.dev');
const shipped = await call('PATCH', `/api/v1/orders/${order.json.data.id}/status`, { token: admin.access_token, body: { status: 'SHIPPED', note: 'Coletado pela transportadora' } });
check('admin envia o pedido', shipped.json?.data?.status === 'SHIPPED');
const wrong = await call('PATCH', `/api/v1/orders/${order.json.data.id}/status`, { token: admin.access_token, body: { status: 'SHIPPED' } });
check('transição inválida mapeada', wrong.status === 409 && wrong.json?.error?.code === 'INVALID_STATE_TRANSITION');

const notes = await waitFor(() => call('GET', '/api/v1/notifications', { token: customer.access_token }), (r) => r.json?.data?.items?.some((n) => n.kind === 'ORDER_SHIPPED'), 8000);
check('notificações geradas por eventos', notes.json?.data?.total >= 4, `${notes.json?.data?.total} notificações`);

const internal = await call('GET', '/internal/carts/x');
check('rotas internas fora do gateway', internal.status === 404);

const failed = steps.filter((s) => !s.ok).length;
console.log(`\n${steps.length - failed}/${steps.length} verificações passaram`);
