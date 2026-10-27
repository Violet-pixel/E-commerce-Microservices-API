import { z } from 'zod';
import { defineEndpoint } from './endpoint.js';
import { paginated } from './dto.js';
import { Empty, IdParams, Void } from './primitives.js';
import { AuthorizeBody, AuthorizeResponse, Jwks, RegisterBody, RevokeBody, TokenBody, TokenResponse, UserDto } from './domains/auth.js';
import { CategoryDto, CreateCategoryBody, CreateProductBody, LookupBody, ProductDto, ProductQuery, ProductSnapshot, UpdateProductBody } from './domains/catalog.js';
import { SetStockBody, StockDto, StockQuery } from './domains/inventory.js';
import { AddCartItemBody, CartDto, CartItemParams, RawCart, UpdateCartItemBody } from './domains/cart.js';
import { CheckoutBody, OrderDto, OrderQuery, UpdateOrderStatusBody } from './domains/orders.js';
import { OrderIdParams, PaymentDto } from './domains/payments.js';
import { NotificationDto, NotificationQuery, UnreadCount } from './domains/notifications.js';

const Health = z.object({ status: z.enum(['ok', 'degraded']), service: z.string(), checks: z.record(z.string(), z.boolean()) });
const UserParams = z.strictObject({ userId: z.string().min(1).max(64) });

export const api = {
  auth: {
    jwks: defineEndpoint({ method: 'GET', path: '/oauth/jwks', summary: 'Chaves públicas (JWKS)', tags: ['auth'], auth: 'public', response: Jwks, raw: true }),
    authorize: defineEndpoint({ method: 'POST', path: '/oauth/authorize', summary: 'Login com PKCE e emissão do código de autorização', tags: ['auth'], auth: 'public', body: AuthorizeBody, response: AuthorizeResponse }),
    token: defineEndpoint({ method: 'POST', path: '/oauth/token', summary: 'Emissão de tokens (authorization_code, refresh_token, client_credentials)', tags: ['auth'], auth: 'public', body: TokenBody, response: TokenResponse, raw: true }),
    revoke: defineEndpoint({ method: 'POST', path: '/oauth/revoke', summary: 'Revogação de refresh token', tags: ['auth'], auth: 'public', body: RevokeBody, response: Void }),
    register: defineEndpoint({ method: 'POST', path: '/api/v1/auth/register', summary: 'Cadastro de cliente', tags: ['auth'], auth: 'public', body: RegisterBody, response: UserDto, status: 201 }),
    me: defineEndpoint({ method: 'GET', path: '/api/v1/auth/me', summary: 'Usuário autenticado', tags: ['auth'], auth: 'user', response: UserDto })
  },
  catalog: {
    listProducts: defineEndpoint({ method: 'GET', path: '/api/v1/catalog/products', summary: 'Lista e busca de produtos', tags: ['catalog'], auth: 'public', query: ProductQuery, response: paginated(ProductDto) }),
    getProduct: defineEndpoint({ method: 'GET', path: '/api/v1/catalog/products/:id', summary: 'Detalhe do produto', tags: ['catalog'], auth: 'public', params: IdParams, response: ProductDto }),
    createProduct: defineEndpoint({ method: 'POST', path: '/api/v1/catalog/products', summary: 'Cria produto', tags: ['catalog'], auth: 'admin', scopes: ['catalog:write'], body: CreateProductBody, response: ProductDto, status: 201 }),
    updateProduct: defineEndpoint({ method: 'PATCH', path: '/api/v1/catalog/products/:id', summary: 'Atualiza produto', tags: ['catalog'], auth: 'admin', scopes: ['catalog:write'], params: IdParams, body: UpdateProductBody, response: ProductDto }),
    deleteProduct: defineEndpoint({ method: 'DELETE', path: '/api/v1/catalog/products/:id', summary: 'Desativa produto', tags: ['catalog'], auth: 'admin', scopes: ['catalog:write'], params: IdParams, response: ProductDto }),
    listCategories: defineEndpoint({ method: 'GET', path: '/api/v1/catalog/categories', summary: 'Categorias', tags: ['catalog'], auth: 'public', response: z.array(CategoryDto) }),
    createCategory: defineEndpoint({ method: 'POST', path: '/api/v1/catalog/categories', summary: 'Cria categoria', tags: ['catalog'], auth: 'admin', scopes: ['catalog:write'], body: CreateCategoryBody, response: CategoryDto, status: 201 }),
    lookup: defineEndpoint({ method: 'POST', path: '/internal/catalog/lookup', summary: 'Consulta interna de preços', tags: ['internal'], auth: 'service', scopes: ['internal'], body: LookupBody, response: z.array(ProductSnapshot) })
  },
  inventory: {
    list: defineEndpoint({ method: 'GET', path: '/api/v1/inventory', summary: 'Estoque por produto', tags: ['inventory'], auth: 'public', query: StockQuery, response: z.array(StockDto) }),
    set: defineEndpoint({ method: 'PUT', path: '/api/v1/inventory/:id', summary: 'Define a quantidade disponível', tags: ['inventory'], auth: 'admin', scopes: ['inventory:write'], params: IdParams, body: SetStockBody, response: StockDto })
  },
  cart: {
    get: defineEndpoint({ method: 'GET', path: '/api/v1/cart', summary: 'Carrinho do usuário', tags: ['cart'], auth: 'user', response: CartDto }),
    add: defineEndpoint({ method: 'POST', path: '/api/v1/cart/items', summary: 'Adiciona item', tags: ['cart'], auth: 'user', scopes: ['cart:write'], body: AddCartItemBody, response: CartDto }),
    update: defineEndpoint({ method: 'PATCH', path: '/api/v1/cart/items/:productId', summary: 'Altera quantidade (0 remove)', tags: ['cart'], auth: 'user', scopes: ['cart:write'], params: CartItemParams, body: UpdateCartItemBody, response: CartDto }),
    clear: defineEndpoint({ method: 'DELETE', path: '/api/v1/cart', summary: 'Esvazia o carrinho', tags: ['cart'], auth: 'user', scopes: ['cart:write'], response: CartDto }),
    raw: defineEndpoint({ method: 'GET', path: '/internal/carts/:userId', summary: 'Carrinho bruto (interno)', tags: ['internal'], auth: 'service', scopes: ['internal'], params: UserParams, response: RawCart })
  },
  orders: {
    checkout: defineEndpoint({ method: 'POST', path: '/api/v1/orders', summary: 'Fecha o pedido a partir do carrinho', tags: ['orders'], auth: 'user', scopes: ['orders:write'], body: CheckoutBody, response: OrderDto, status: 202 }),
    list: defineEndpoint({ method: 'GET', path: '/api/v1/orders', summary: 'Pedidos', tags: ['orders'], auth: 'user', scopes: ['orders:read'], query: OrderQuery, response: paginated(OrderDto) }),
    get: defineEndpoint({ method: 'GET', path: '/api/v1/orders/:id', summary: 'Detalhe do pedido', tags: ['orders'], auth: 'user', scopes: ['orders:read'], params: IdParams, response: OrderDto }),
    cancel: defineEndpoint({ method: 'POST', path: '/api/v1/orders/:id/cancel', summary: 'Cancela o próprio pedido', tags: ['orders'], auth: 'user', scopes: ['orders:write'], params: IdParams, body: Empty, response: OrderDto }),
    updateStatus: defineEndpoint({ method: 'PATCH', path: '/api/v1/orders/:id/status', summary: 'Envio, entrega ou cancelamento (admin)', tags: ['orders'], auth: 'admin', scopes: ['orders:manage'], params: IdParams, body: UpdateOrderStatusBody, response: OrderDto })
  },
  payments: {
    byOrder: defineEndpoint({ method: 'GET', path: '/api/v1/payments/orders/:orderId', summary: 'Pagamentos de um pedido', tags: ['payments'], auth: 'user', scopes: ['orders:read'], params: OrderIdParams, response: z.array(PaymentDto) })
  },
  notifications: {
    list: defineEndpoint({ method: 'GET', path: '/api/v1/notifications', summary: 'Notificações', tags: ['notifications'], auth: 'user', scopes: ['notifications:read'], query: NotificationQuery, response: paginated(NotificationDto) }),
    unread: defineEndpoint({ method: 'GET', path: '/api/v1/notifications/unread', summary: 'Contador de não lidas', tags: ['notifications'], auth: 'user', scopes: ['notifications:read'], response: UnreadCount }),
    markRead: defineEndpoint({ method: 'POST', path: '/api/v1/notifications/:id/read', summary: 'Marca como lida', tags: ['notifications'], auth: 'user', scopes: ['notifications:read'], params: IdParams, body: Empty, response: NotificationDto }),
    markAll: defineEndpoint({ method: 'POST', path: '/api/v1/notifications/read-all', summary: 'Marca todas como lidas', tags: ['notifications'], auth: 'user', scopes: ['notifications:read'], body: Empty, response: UnreadCount })
  }
};

export const HealthDto = Health;
