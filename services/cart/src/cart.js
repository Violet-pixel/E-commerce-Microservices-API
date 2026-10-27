import { api } from '@cesto/contracts';
import { NotFoundError, ValidationError } from '@cesto/core';

export const buildCart = (userId, raw, products) => {
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
    .filter((item) => item !== null);
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
  constructor(redis, client, settings) {
    this.redis = redis;
    this.client = client;
    this.settings = settings;
  }

  key(userId) {
    return `cesto:cart:${userId}`;
  }

  async raw(userId) {
    const hash = await this.redis.hgetall(this.key(userId));
    return {
      userId,
      items: Object.entries(hash)
        .map(([productId, qty]) => ({ productId, quantity: Number(qty) }))
        .filter((i) => i.quantity > 0)
        .sort((a, b) => a.productId.localeCompare(b.productId))
    };
  }

  async view(userId) {
    const raw = await this.raw(userId);
    if (raw.items.length === 0) return buildCart(userId, [], []);
    const products = await this.client.call(this.settings.catalogUrl, api.catalog.lookup, { body: { ids: raw.items.map((i) => i.productId) } });
    return buildCart(userId, raw.items, products);
  }

  async product(productId) {
    const [product] = await this.client.call(this.settings.catalogUrl, api.catalog.lookup, { body: { ids: [productId] } });
    if (!product || !product.active) throw new NotFoundError('Produto', productId);
    return product;
  }

  async add(userId, productId, quantity) {
    await this.product(productId);
    const key = this.key(userId);
    const exists = await this.redis.hexists(key, productId);
    if (!exists && (await this.redis.hlen(key)) >= this.settings.maxItems) throw new ValidationError(`O carrinho aceita até ${this.settings.maxItems} produtos diferentes`);
    const total = await this.redis.hincrby(key, productId, quantity);
    if (total > 999) await this.redis.hset(key, productId, 999);
    await this.redis.expire(key, this.settings.ttlSeconds);
    return this.view(userId);
  }

  async update(userId, productId, quantity) {
    const key = this.key(userId);
    if (quantity === 0) await this.redis.hdel(key, productId);
    else {
      if (!(await this.redis.hexists(key, productId))) await this.product(productId);
      await this.redis.hset(key, productId, quantity);
      await this.redis.expire(key, this.settings.ttlSeconds);
    }
    return this.view(userId);
  }

  async clear(userId) {
    await this.redis.del(this.key(userId));
    return buildCart(userId, [], []);
  }
}
