import { z } from 'zod';
import { Cents, Currency, Id, Quantity } from '../primitives.js';

export const CartItemDto = z.object({
  productId: Id,
  sku: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  unitPriceCents: Cents,
  quantity: z.number().int(),
  subtotalCents: Cents,
  available: z.boolean()
});
export type CartItemDto = z.infer<typeof CartItemDto>;

export const CartDto = z.object({
  userId: z.string(),
  items: z.array(CartItemDto),
  itemCount: z.number().int(),
  totalCents: Cents,
  currency: Currency
});
export type CartDto = z.infer<typeof CartDto>;

export const AddCartItemBody = z.strictObject({ productId: Id, quantity: Quantity.default(1) });
export type AddCartItemBody = z.infer<typeof AddCartItemBody>;

export const UpdateCartItemBody = z.strictObject({ quantity: z.number().int().min(0).max(999) });
export type UpdateCartItemBody = z.infer<typeof UpdateCartItemBody>;

export const CartItemParams = z.strictObject({ productId: Id });

export const RawCart = z.object({
  userId: z.string(),
  items: z.array(z.object({ productId: Id, quantity: z.number().int() }))
});
export type RawCart = z.infer<typeof RawCart>;
