import { createEnvelope } from '@cesto/contracts';
import type { CategoryDto, CreateCategoryBody, CreateProductBody, EventEnvelope, Paginated, ProductDto, ProductQuery, ProductSnapshot, UpdateProductBody } from '@cesto/contracts';
import { ConflictError, NotFoundError, ValidationError, iso, paginate } from '@cesto/core';
import type { Db } from './db.js';
import type { Prisma } from './generated/prisma/client.js';

type ProductRow = Prisma.ProductGetPayload<{ include: { category: true } }>;

export const toProductDto = (row: ProductRow): ProductDto => ({
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

const orderBy = (sort: ProductQuery['sort']): Prisma.ProductOrderByWithRelationInput[] => {
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

export const outboxData = (envelope: EventEnvelope) => ({
  id: envelope.id,
  name: envelope.name,
  envelope: envelope as unknown as Prisma.InputJsonValue
});

const productEvent = (row: { id: string; sku: string; name: string; priceCents: number; active: boolean }) => ({
  productId: row.id,
  sku: row.sku,
  name: row.name,
  priceCents: row.priceCents,
  active: row.active
});

export class CatalogService {
  constructor(
    private readonly db: Db,
    private readonly notify: () => void
  ) {}

  async list(query: ProductQuery, canSeeInactive: boolean): Promise<Paginated<ProductDto>> {
    const where: Prisma.ProductWhereInput = {
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

  async get(id: string, canSeeInactive: boolean): Promise<ProductDto> {
    const row = await this.db.product.findUnique({ where: { id }, include: { category: true } });
    if (!row || (!row.active && !canSeeInactive)) throw new NotFoundError('Produto', id);
    return toProductDto(row);
  }

  private async assertCategory(categoryId: string | null | undefined) {
    if (!categoryId) return;
    const exists = await this.db.category.count({ where: { id: categoryId } });
    if (!exists) throw new ValidationError('Categoria inexistente', { field: 'categoryId' });
  }

  async create(body: CreateProductBody): Promise<ProductDto> {
    await this.assertCategory(body.categoryId);
    const row = await this.db.$transaction(async (tx) => {
      const created = await tx.product.create({ data: body, include: { category: true } });
      await tx.outboxEvent.create({ data: outboxData(createEnvelope('product.created', productEvent(created))) });
      return created;
    });
    this.notify();
    return toProductDto(row);
  }

  async update(id: string, body: UpdateProductBody): Promise<ProductDto> {
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

  deactivate(id: string): Promise<ProductDto> {
    return this.update(id, { active: false });
  }

  async categories(): Promise<CategoryDto[]> {
    const rows = await this.db.category.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { products: { where: { active: true } } } } } });
    return rows.map((c) => ({ id: c.id, name: c.name, slug: c.slug, productCount: c._count.products }));
  }

  async createCategory(body: CreateCategoryBody): Promise<CategoryDto> {
    if (await this.db.category.count({ where: { slug: body.slug } })) throw new ConflictError('Slug de categoria já existe', { field: 'slug' });
    const row = await this.db.category.create({ data: body });
    return { id: row.id, name: row.name, slug: row.slug, productCount: 0 };
  }

  async lookup(ids: string[]): Promise<ProductSnapshot[]> {
    const rows = await this.db.product.findMany({ where: { id: { in: ids } } });
    return rows.map((r) => ({ id: r.id, sku: r.sku, name: r.name, priceCents: r.priceCents, currency: r.currency, imageUrl: r.imageUrl, active: r.active }));
  }
}
