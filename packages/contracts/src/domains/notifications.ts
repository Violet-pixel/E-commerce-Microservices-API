import { z } from 'zod';
import { Id, IsoDate, PageQuery } from '../primitives.js';

export const NotificationKind = z.enum(['WELCOME', 'ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_CANCELLED', 'ORDER_SHIPPED', 'ORDER_DELIVERED', 'PAYMENT_DECLINED']);
export type NotificationKind = z.infer<typeof NotificationKind>;

export const NotificationDto = z.object({
  id: Id,
  userId: z.string(),
  kind: NotificationKind,
  title: z.string(),
  body: z.string(),
  orderId: Id.nullable(),
  readAt: IsoDate.nullable(),
  createdAt: IsoDate
});
export type NotificationDto = z.infer<typeof NotificationDto>;

export const NotificationQuery = PageQuery.extend({
  unread: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional()
});

export const UnreadCount = z.object({ unread: z.number().int() });
