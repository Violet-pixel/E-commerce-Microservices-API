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

export const CartDto = z.object({
  userId: z.string(),
  items: z.array(CartItemDto),
  itemCount: z.number().int(),
  totalCents: Cents,
  currency: Currency
});

export const AddCartItemBody = z.strictObject({ productId: Id, quantity: Quantity.default(1) });

export const UpdateCartItemBody = z.strictObject({ quantity: z.number().int().min(0).max(999) });

export const CartItemParams = z.strictObject({ productId: Id });

export const RawCart = z.object({
  userId: z.string(),
  items: z.array(z.object({ productId: Id, quantity: z.number().int() }))
});
