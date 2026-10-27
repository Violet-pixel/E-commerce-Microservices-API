import { z } from 'zod';

export const Id = z.uuid();

export const Cents = z.number().int().nonnegative().max(1_000_000_000);

export const Currency = z.enum(['BRL', 'USD', 'EUR']);

export const Email = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const Slug = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const Sku = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Z0-9][A-Z0-9-]*$/);

export const IsoDate = z.iso.datetime({ offset: true });

export const Quantity = z.number().int().min(1).max(999);

export const PageQuery = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const IdParams = z.strictObject({ id: Id });

export const Empty = z.strictObject({});
export const Void = z.null();
