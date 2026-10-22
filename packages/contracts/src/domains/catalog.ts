import { z } from 'zod';
import { Cents, Currency, Id, IsoDate, PageQuery, Sku, Slug } from '../primitives.js';

export const CategoryDto = z.object({
  id: Id,
  name: z.string(),
  slug: z.string(),
  productCount: z.number().int().optional()
});
export type CategoryDto = z.infer<typeof CategoryDto>;

export const CreateCategoryBody = z.strictObject({
  name: z.string().trim().min(2).max(60),
  slug: Slug
});
export type CreateCategoryBody = z.infer<typeof CreateCategoryBody>;

export const ProductDto = z.object({
  id: Id,
  sku: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  priceCents: Cents,
  currency: Currency,
  imageUrl: z.string().nullable(),
  active: z.boolean(),
  category: CategoryDto.pick({ id: true, name: true, slug: true }).nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate
});
export type ProductDto = z.infer<typeof ProductDto>;

export const ProductSort = z.enum(['newest', 'name', 'price_asc', 'price_desc']);

export const ProductQuery = PageQuery.extend({
  q: z.string().trim().max(100).optional(),
  category: Slug.optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  sort: ProductSort.default('newest'),
  includeInactive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional()
}).refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
  message: 'minPrice deve ser menor ou igual a maxPrice',
  path: ['minPrice']
});
export type ProductQuery = z.infer<typeof ProductQuery>;

export const CreateProductBody = z.strictObject({
  sku: Sku,
  name: z.string().trim().min(2).max(120),
  slug: Slug,
  description: z.string().trim().max(4000).default(''),
  priceCents: Cents,
  currency: Currency.default('BRL'),
  imageUrl: z.url().max(500).nullable().default(null),
  categoryId: Id.nullable().default(null),
  active: z.boolean().default(true)
});
export type CreateProductBody = z.infer<typeof CreateProductBody>;

export const UpdateProductBody = CreateProductBody.partial().refine((b) => Object.keys(b).length > 0, {
  message: 'Envie ao menos um campo para atualizar'
});
export type UpdateProductBody = z.infer<typeof UpdateProductBody>;

export const LookupBody = z.strictObject({ ids: z.array(Id).min(1).max(100) });

export const ProductSnapshot = ProductDto.pick({
  id: true,
  sku: true,
  name: true,
  priceCents: true,
  currency: true,
  imageUrl: true,
  active: true
});
export type ProductSnapshot = z.infer<typeof ProductSnapshot>;
