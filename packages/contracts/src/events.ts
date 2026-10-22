import { z } from 'zod';
import { Cents, Currency, Id } from './primitives.js';
import { PaymentMethod } from './domains/orders.js';

const OrderLine = z.object({
  productId: Id,
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: Cents
});

export const eventSchemas = {
  'user.registered': z.object({ userId: Id, email: z.string(), name: z.string() }),
  'product.created': z.object({ productId: Id, sku: z.string(), name: z.string(), priceCents: Cents, active: z.boolean() }),
  'product.updated': z.object({ productId: Id, sku: z.string(), name: z.string(), priceCents: Cents, active: z.boolean() }),
  'order.placed': z.object({
    orderId: Id,
    userId: z.string(),
    number: z.number().int(),
    items: z.array(OrderLine).min(1),
    totalCents: Cents,
    currency: Currency,
    paymentMethod: PaymentMethod,
    cardToken: z.string().optional()
  }),
  'inventory.reserved': z.object({ orderId: Id }),
  'inventory.rejected': z.object({ orderId: Id, reason: z.string(), productIds: z.array(Id) }),
  'payment.requested': z.object({
    orderId: Id,
    userId: z.string(),
    amountCents: Cents,
    currency: Currency,
    method: PaymentMethod,
    cardToken: z.string().optional()
  }),
  'payment.approved': z.object({ orderId: Id, paymentId: Id }),
  'payment.declined': z.object({ orderId: Id, paymentId: Id, reason: z.string() }),
  'order.confirmed': z.object({ orderId: Id, userId: z.string(), number: z.number().int(), totalCents: Cents }),
  'order.cancelled': z.object({ orderId: Id, userId: z.string(), number: z.number().int(), reason: z.string(), releaseStock: z.boolean() }),
  'order.shipped': z.object({ orderId: Id, userId: z.string(), number: z.number().int() }),
  'order.delivered': z.object({ orderId: Id, userId: z.string(), number: z.number().int() })
} as const;

export type EventMap = { [K in keyof typeof eventSchemas]: z.output<(typeof eventSchemas)[K]> };
export type EventName = keyof EventMap;
export const EVENT_NAMES = Object.keys(eventSchemas) as EventName[];

export interface EventEnvelope<K extends EventName = EventName> {
  id: string;
  name: K;
  version: 1;
  occurredAt: string;
  correlationId: string | null;
  payload: EventMap[K];
}

export const EnvelopeHeader = z.object({
  id: Id,
  name: z.enum(EVENT_NAMES as [EventName, ...EventName[]]),
  version: z.literal(1),
  occurredAt: z.iso.datetime({ offset: true }),
  correlationId: z.string().nullable()
});

export const parseEnvelope = (raw: unknown): EventEnvelope => {
  const base = EnvelopeHeader.extend({ payload: z.unknown() }).parse(raw);
  const payload = eventSchemas[base.name].parse(base.payload);
  return { ...base, payload } as EventEnvelope;
};

export const createEnvelope = <K extends EventName>(name: K, payload: EventMap[K], correlationId: string | null = null): EventEnvelope<K> => ({
  id: crypto.randomUUID(),
  name,
  version: 1,
  occurredAt: new Date().toISOString(),
  correlationId,
  payload: eventSchemas[name].parse(payload) as EventMap[K]
});
