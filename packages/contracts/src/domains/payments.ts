import { z } from 'zod';
import { Cents, Currency, Id, IsoDate } from '../primitives.js';
import { PaymentMethod } from './orders.js';

export const PaymentStatus = z.enum(['APPROVED', 'DECLINED', 'REFUNDED']);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PaymentDto = z.object({
  id: Id,
  orderId: Id,
  userId: z.string(),
  amountCents: Cents,
  currency: Currency,
  method: PaymentMethod,
  status: PaymentStatus,
  reason: z.string().nullable(),
  createdAt: IsoDate
});
export type PaymentDto = z.infer<typeof PaymentDto>;

export const OrderIdParams = z.strictObject({ orderId: Id });
