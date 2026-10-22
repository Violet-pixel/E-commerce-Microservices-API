import { z } from 'zod';
import { Cents, Currency, Id, IsoDate, PageQuery } from '../primitives.js';

export const OrderStatus = z.enum(['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const PaymentMethod = z.enum(['card', 'pix', 'boleto']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const Address = z.strictObject({
  recipient: z.string().trim().min(2).max(80),
  street: z.string().trim().min(2).max(120),
  number: z.string().trim().min(1).max(10),
  complement: z.string().trim().max(60).optional(),
  district: z.string().trim().min(2).max(60),
  city: z.string().trim().min(2).max(60),
  state: z
    .string()
    .trim()
    .length(2)
    .transform((v) => v.toUpperCase()),
  postalCode: z.string().trim().regex(/^\d{5}-?\d{3}$/)
});
export type Address = z.infer<typeof Address>;

export const OrderItemDto = z.object({
  productId: Id,
  sku: z.string(),
  name: z.string(),
  unitPriceCents: Cents,
  quantity: z.number().int(),
  subtotalCents: Cents
});
export type OrderItemDto = z.infer<typeof OrderItemDto>;

export const OrderHistoryDto = z.object({
  status: OrderStatus,
  note: z.string().nullable(),
  at: IsoDate
});

export const OrderDto = z.object({
  id: Id,
  number: z.number().int(),
  userId: z.string(),
  status: OrderStatus,
  items: z.array(OrderItemDto),
  totalCents: Cents,
  currency: Currency,
  paymentMethod: PaymentMethod,
  shippingAddress: Address,
  cancelReason: z.string().nullable(),
  history: z.array(OrderHistoryDto),
  createdAt: IsoDate,
  updatedAt: IsoDate
});
export type OrderDto = z.infer<typeof OrderDto>;

export const CheckoutBody = z.strictObject({
  shippingAddress: Address,
  paymentMethod: PaymentMethod,
  cardToken: z.string().max(64).optional()
});
export type CheckoutBody = z.infer<typeof CheckoutBody>;

export const OrderQuery = PageQuery.extend({
  status: OrderStatus.optional(),
  scope: z.enum(['mine', 'all']).default('mine')
});
export type OrderQuery = z.infer<typeof OrderQuery>;

export const UpdateOrderStatusBody = z.strictObject({
  status: z.enum(['SHIPPED', 'DELIVERED', 'CANCELLED']),
  note: z.string().trim().max(200).optional()
});
export type UpdateOrderStatusBody = z.infer<typeof UpdateOrderStatusBody>;
