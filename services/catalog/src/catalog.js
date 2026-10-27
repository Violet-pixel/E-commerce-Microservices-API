import { createEnvelope } from '@cesto/contracts';
import { ConflictError, NotFoundError, ValidationError, iso, paginate } from '@cesto/core';

export const toProductDto = (row) => ({
  id: row.id,
  sku: row.sku,
  name: row.name,
  slug: row.slug,
  description: row.description,
  priceCents: row.priceCents,
  currency: row.currency,
  imageUrl: row.imageUrl,
  active: row.active,
  category: row.category ? { id: row.category.id, name: row.category.name, slug: row.category.slug } : null,
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt)
});

const orderBy = (sort) => {
  switch (sort) {
    case 'name':
      return [{ name: 'asc' }];
    case 'price_asc':
      return [{ priceCents: 'asc' }, { name: 'asc' }];
    case 'price_desc':
      return [{ priceCents: 'desc' }, { name: 'asc' }];
    default:
      return [{ createdAt: 'desc' }, { id: 'asc' }];
  }
};

export const outboxData = (envelope) => ({
  id: envelope.id,
  name: envelope.name,
  envelope: envelope
});

const productEvent = (row) => ({
  productId: row.id,
  sku: row.sku,
  name: row.name,
  priceCents: row.priceCents,
  active: row.active
});

export class CatalogService {
  constructor(db, notify) {
    this.db = db;
    this.notify = notify;
  }

  async list(query, canSeeInactive) {
    const where = {
      ...(canSeeInactive && query.includeInactive ? {} : { active: true }),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined ? { priceCents: { gte: query.minPrice, lte: query.maxPrice } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } }
            ]
          }
        : {})
    };
    return paginate(
      query,
      (args) => this.db.$transaction([this.db.product.findMany({ where, orderBy: orderBy(query.sort), include: { category: true }, ...args }), this.db.product.count({ where })]),
      toProductDto
    );
  }

  async get(id, canSeeInactive) {
    const row = await this.db.product.findUnique({ where: { id }, include: { category: true } });
    if (!row || (!row.active && !canSeeInactive)) throw new NotFoundError('Produto', id);
    return toProductDto(row);
  }

  async assertCategory(categoryId) {
    if (!categoryId) return;
    const exists = await this.db.category.count({ where: { id: categoryId } });
    if (!exists) throw new ValidationError('Categoria inexistente', { field: 'categoryId' });
  }

  async create(body) {
    await this.assertCategory(body.categoryId);
    const row = await this.db.$transaction(async (tx) => {
      const created = await tx.product.create({ data: body, include: { category: true } });
      await tx.outboxEvent.create({ data: outboxData(createEnvelope('product.created', productEvent(created))) });
      return created;
    });
    this.notify();
    return toProductDto(row);
  }

  async update(id, body) {
    await this.assertCategory(body.categoryId);
    const row = await this.db.$transaction(async (tx) => {
      const exists = await tx.product.findUnique({ where: { id } });
      if (!exists) throw new NotFoundError('Produto', id);
      const updated = await tx.product.update({ where: { id }, data: body, include: { category: true } });
      await tx.outboxEvent.create({ data: outboxData(createEnvelope('product.updated', productEvent(updated))) });
      return updated;
    });
    this.notify();
    return toProductDto(row);
  }

  deactivate(id) {
    return this.update(id, { active: false });
  }

  async categories() {
    const rows = await this.db.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: { where: { active: true } } } } } });
    return rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, productCount: c._count.products }));
  }

  async createCategory(body) {
    if (await this.db.category.count({ where: { slug: body.slug } })) throw new ConflictError('Slug de categoria já existe', { field: 'slug' });
    const row = await this.db.category.create({ data: body });
    return { id: row.id, name: row.name, slug: row.slug, productCount: 0 };
  }

  async lookup(ids) {
    const rows = await this.db.product.findMany({ where: { id: { in: ids } } });
    return rows.map((r) => ({ id: r.id, sku: r.sku, name: r.name, priceCents: r.priceCents, currency: r.currency, imageUrl: r.imageUrl, active: r.active }));
  }
}
