import { createEnvelope } from '@cesto/contracts';
import { NotFoundError, isUniqueViolation, iso } from '@cesto/core';

export const toPaymentDto = (row) => ({
  id: row.id,
  orderId: row.orderId,
  userId: row.userId,
  amountCents: row.amountCents,
  currency: row.currency,
  method: row.method,
  status: row.status,
  reason: row.reason,
  createdAt: iso(row.createdAt)
});

const outbox = (tx, envelope) =>
  tx.outboxEvent.create({ data: { id: envelope.id, name: envelope.name, envelope: envelope } });

export class PaymentService {
  constructor(db, gateway, notify) {
    this.db = db;
    this.gateway = gateway;
    this.notify = notify;
  }

  async seen(eventId) {
    return Boolean(await this.db.processedEvent.findUnique({ where: { eventId } }));
  }

  async commit(event, work) {
    try {
      await this.db.$transaction(async (tx) => {
        await tx.processedEvent.create({ data: { eventId: event.id, name: event.name } });
        await work(tx);
      });
    } catch (error) {
      if (isUniqueViolation(error)) return;
      throw error;
    }
    this.notify();
  }

  async onPaymentRequested(event) {
    if (await this.seen(event.id)) return;
    const p = event.payload;
    const existing = await this.db.payment.findFirst({ where: { orderId: p.orderId, status: { in: ['APPROVED', 'REFUNDED'] } } });
    if (existing) {
      await this.commit(event, async (tx) => {
        await outbox(tx, createEnvelope('payment.approved', { orderId: p.orderId, paymentId: existing.id }, event.id));
      });
      return;
    }
    const result = await this.gateway.charge({ idempotencyKey: p.orderId, amountCents: p.amountCents, currency: p.currency, method: p.method, cardToken: p.cardToken });
    await this.commit(event, async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: p.orderId,
          userId: p.userId,
          amountCents: p.amountCents,
          currency: p.currency,
          method: p.method,
          status: result.approved ? 'APPROVED' : 'DECLINED',
          reason: result.approved ? null : result.reason,
          providerRef: result.reference
        }
      });
      await outbox(
        tx,
        result.approved
          ? createEnvelope('payment.approved', { orderId: p.orderId, paymentId: payment.id }, event.id)
          : createEnvelope('payment.declined', { orderId: p.orderId, paymentId: payment.id, reason: result.reason }, event.id)
      );
    });
  }

  async onOrderCancelled(event) {
    if (await this.seen(event.id)) return;
    const approved = await this.db.payment.findMany({ where: { orderId: event.payload.orderId, status: 'APPROVED' } });
    for (const payment of approved) await this.gateway.refund(payment.providerRef, payment.amountCents);
    await this.commit(event, async (tx) => {
      await tx.payment.updateMany({ where: { orderId: event.payload.orderId, status: 'APPROVED' }, data: { status: 'REFUNDED', reason: event.payload.reason.slice(0, 200) } });
    });
  }

  async byOrder(orderId, principal) {
    const rows = await this.db.payment.findMany({ where: { orderId }, orderBy: { createdAt: 'asc' } });
    const admin = principal.kind === 'user' && principal.role === 'ADMIN';
    if (!admin && rows.some((r) => r.userId !== principal.id)) throw new NotFoundError('Pedido', orderId);
    return rows.map(toPaymentDto);
  }
}
