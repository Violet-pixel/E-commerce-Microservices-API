import { api } from '@cesto/contracts';
import type { CartDto, ProductSnapshot, RawCart } from '@cesto/contracts';
import { NotFoundError, ValidationError } from '@cesto/core';
import type { ServiceClient } from '@cesto/core';
import type { Redis } from '@cesto/bus';

export interface CartSettings {
  ttlSeconds: number;
  maxItems: number;
  catalogUrl: string;
}

export const buildCart = (userId: string, raw: RawCart['items'], products: ProductSnapshot[]): CartDto => {
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = raw
    .map(({ productId, quantity }) => {
      const product = byId.get(productId);
      if (!product) return null;
      return {
        productId,
        sku: product.sku,
        name: product.name,
        imageUrl: product.imageUrl,
        unitPriceCents: product.priceCents,
        quantity,
        subtotalCents: product.priceCents * quantity,
        available: product.active
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const billable = items.filter((i) => i.available);
  return {
    userId,
    items,
    itemCount: billable.reduce((n, i) => n + i.quantity, 0),
    totalCents: billable.reduce((n, i) => n + i.subtotalCents, 0),
    currency: products[0]?.currency ?? 'BRL'
  };
};

export class CartService {
  constructor(
    private readonly redis: Redis,
    private readonly client: ServiceClient,
    private readonly settings: CartSettings
  ) {}

  private key(userId: string) {
    return `cesto:cart:${userId}`;
  }

  async raw(userId: string): Promise<RawCart> {
    const hash = await this.redis.hgetall(this.key(userId));
    return {
      userId,
      items: Object.entries(hash)
        .map(([productId, qty]) => ({ productId, quantity: Number(qty) }))
        .filter((i) => i.quantity > 0)
        .sort((a, b) => a.productId.localeCompare(b.productId))
    };
  }

  async view(userId: string): Promise<CartDto> {
    const raw = await this.raw(userId);
    if (raw.items.length === 0) return buildCart(userId, [], []);
    const products = await this.client.call(this.settings.catalogUrl, api.catalog.lookup, { body: { ids: raw.items.map((i) => i.productId) } });
    return buildCart(userId, raw.items, products);
  }

  private async product(productId: string): Promise<ProductSnapshot> {
    const [product] = await this.client.call(this.settings.catalogUrl, api.catalog.lookup, { body: { ids: [productId] } });
    if (!product || !product.active) throw new NotFoundError('Produto', productId);
    return product;
  }

  async add(userId: string, productId: string, quantity: number): Promise<CartDto> {
    await this.product(productId);
    const key = this.key(userId);
    const exists = await this.redis.hexists(key, productId);
    if (!exists && (await this.redis.hlen(key)) >= this.settings.maxItems) throw new ValidationError(`O carrinho aceita até ${this.settings.maxItems} produtos diferentes`);
    const total = await this.redis.hincrby(key, productId, quantity);
    if (total > 999) await this.redis.hset(key, productId, 999);
    await this.redis.expire(key, this.settings.ttlSeconds);
    return this.view(userId);
  }

  async update(userId: string, productId: string, quantity: number): Promise<CartDto> {
    const key = this.key(userId);
    if (quantity === 0) await this.redis.hdel(key, productId);
    else {
      if (!(await this.redis.hexists(key, productId))) await this.product(productId);
      await this.redis.hset(key, productId, quantity);
      await this.redis.expire(key, this.settings.ttlSeconds);
    }
    return this.view(userId);
  }

  async clear(userId: string): Promise<CartDto> {
    await this.redis.del(this.key(userId));
    return buildCart(userId, [], []);
  }
}
