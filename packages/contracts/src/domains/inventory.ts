import { z } from 'zod';
import { Id, IsoDate } from '../primitives.js';

export const StockDto = z.object({
  productId: Id,
  sku: z.string(),
  available: z.number().int(),
  reserved: z.number().int(),
  updatedAt: IsoDate
});
export type StockDto = z.infer<typeof StockDto>;

export const SetStockBody = z.strictObject({
  available: z.number().int().min(0).max(1_000_000)
});
export type SetStockBody = z.infer<typeof SetStockBody>;

export const StockQuery = z.strictObject({
  productIds: z
    .string()
    .max(4000)
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(Id).max(100))
    .optional()
});
export type StockQuery = z.infer<typeof StockQuery>;
