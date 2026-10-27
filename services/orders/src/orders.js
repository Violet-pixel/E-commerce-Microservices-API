import { api, createEnvelope } from '@cesto/contracts';
import { ForbiddenError, InvalidTransitionError, NotFoundError, isUniqueViolation, iso, paginate } from '@cesto/core';
import { CUSTOMER_CANCELLABLE, assertTransition, canTransition, holdsStock, priceOrder } from './saga.js';

const include = { items: true, history: { orderBy: { createdAt: 'asc' } } };

export const toOrderDto = (row) => ({
  id: row.id,
  number: row.number,
  userId: row.userId,
  status: row.status,
  items: row.items.map((i) => ({
    productId: i.productId,
    sku: i.sku,
    name: i.name,
    unitPriceCents: i.unitPriceCents,
    quantity: i.quantity,
    subtotalCents: i.unitPriceCents * i.quantity
  })),
  totalCents: row.totalCents,
  currency: row.currency,
  paymentMethod: row.paymentMethod,
  shippingAddress: row.shippingAddress,
  cancelReason: row.cancelReason,
  history: row.history.map((h) => ({ status: h.status, note: h.note, at: iso(h.createdAt) })),
  createdAt: iso(row.createdAt),
  updatedAt: iso(row.updatedAt)
});

const outbox = (tx, envelope) =>
  tx.outboxEvent.create({ data: { id: envelope.id, name: envelope.name, envelope: envelope } });

export class OrderService {
  constructor(db, client, upstreams, notify) {
    this.db = db;
    this.client = client;
    this.upstreams = upstreams;
    this.notify = notify;
  }

  async load(id) {
    const row = await this.db.order.findUnique({ where: { id }, include });
    if (!row) throw new NotFoundError('Pedido', id);
    return row;
  }

  ensureAccess(row, principal) {
    const admin = principal.kind === 'user' && principal.role === 'ADMIN';
    if (!admin && row.userId !== principal.id) throw new NotFoundError('Pedido', row.id);
  }

  async checkout(userId, body, correlationId) {
    const cart = await this.client.call(this.upstreams.cartUrl, api.cart.raw, { params: { userId } });
    const products = cart.items.length
      ? await this.client.call(this.upstreams.catalogUrl, api.catalog.lookup, { body: { ids: cart.items.map((i) => i.productId) } })
      : [];
    const priced = priceOrder(cart, products);
    const row = await this.db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          totalCents: priced.totalCents,
          currency: priced.currency,
          paymentMethod: body.paymentMethod,
          paymentToken: body.cardToken ?? null,
          shippingAddress: body.shippingAddress,
          items: { create: priced.lines },
          history: { create: { status: 'PENDING', note: 'Pedido recebido' } }
        },
        include
      });
      await outbox(
        tx,
        createEnvelope(
          'order.placed',
          {
            orderId: order.id,
            userId,
            number: order.number,
            items: priced.lines.map(({ productId, sku, quantity, unitPriceCents }) => ({ productId, sku, quantity, unitPriceCents })),
            totalCents: priced.totalCents,
            currency: priced.currency,
            paymentMethod: body.paymentMethod,
            cardToken: body.cardToken
          },
          correlationId
        )
      );
      return order;
    });
    this.notify();
    return toOrderDto(row);
  }

  async list(query, principal) {
    const admin = principal.kind === 'user' && principal.role === 'ADMIN';
    if (query.scope === 'all' && !admin) throw new ForbiddenError('Somente administradores veem todos os pedidos');
    const where = {
      ...(query.scope === 'all' ? {} : { userId: principal.id }),
      ...(query.status ? { status: query.status } : {})
    };
    return paginate(
      query,
      (args) => this.db.$transaction([this.db.order.findMany({ where, include, orderBy: { createdAt: 'desc' }, ...args }), this.db.order.count({ where })]),
      toOrderDto
    );
  }

  async get(id, principal) {
    const row = await this.load(id);
    this.ensureAccess(row, principal);
    return toOrderDto(row);
  }

  async move(tx, row, to, note, extra = {}) {
    assertTransition(row.status, to);
    const updated = await tx.order.updateMany({ where: { id: row.id, status: row.status }, data: { status: to } });
    if (updated.count !== 1) throw new InvalidTransitionError(row.status, to);
    await tx.order.update({ where: { id: row.id }, data: { ...extra, history: { create: { status: to, note } } } });
  }

  async cancelTx(tx, row, reason, correlationId) {
    await this.move(tx, row, 'CANCELLED', reason, { cancelReason: reason });
    await outbox(tx, createEnvelope('order.cancelled', { orderId: row.id, userId: row.userId, number: row.number, reason, releaseStock: holdsStock(row.status) }, correlationId));
  }

  async cancel(id, principal) {
    const row = await this.load(id);
    this.ensureAccess(row, principal);
    if (!CUSTOMER_CANCELLABLE.includes(row.status)) throw new InvalidTransitionError(row.status, 'CANCELLED');
    await this.db.$transaction((tx) => this.cancelTx(tx, row, 'Cancelado pelo cliente', null));
    this.notify();
    return toOrderDto(await this.load(id));
  }

  async updateStatus(id, status, note) {
    const row = await this.load(id);
    await this.db.$transaction(async (tx) => {
      if (status === 'CANCELLED') return this.cancelTx(tx, row, note ?? 'Cancelado pela loja', null);
      await this.move(tx, row, status, note ?? null);
      const name = status === 'SHIPPED' ? 'order.shipped' : 'order.delivered';
      await outbox(tx, createEnvelope(name, { orderId: row.id, userId: row.userId, number: row.number }));
    });
    this.notify();
    return toOrderDto(await this.load(id));
  }

  async once(event, work, orderId) {
    if (await this.db.processedEvent.findUnique({ where: { eventId: event.id } })) return;
    try {
      await this.db.$transaction(async (tx) => {
        await tx.processedEvent.create({ data: { eventId: event.id, name: event.name } });
        const row = await tx.order.findUnique({ where: { id: orderId }, include });
        if (!row) return;
        await work(tx, row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) return;
      throw error;
    }
    this.notify();
  }

  onInventoryReserved(event) {
    return this.once(event, async (tx, row) => {
      if (!canTransition(row.status, 'AWAITING_PAYMENT')) return;
      await this.move(tx, row, 'AWAITING_PAYMENT', 'Estoque reservado');
      await outbox(
        tx,
        createEnvelope(
          'payment.requested',
          { orderId: row.id, userId: row.userId, amountCents: row.totalCents, currency: row.currency, method: row.paymentMethod, cardToken: row.paymentToken ?? undefined },
          event.id
        )
      );
    }, event.payload.orderId);
  }

  onInventoryRejected(event) {
    return this.once(event, async (tx, row) => {
      if (!canTransition(row.status, 'CANCELLED')) return;
      await this.move(tx, row, 'CANCELLED', event.payload.reason, { cancelReason: event.payload.reason });
      await outbox(tx, createEnvelope('order.cancelled', { orderId: row.id, userId: row.userId, number: row.number, reason: event.payload.reason, releaseStock: false }, event.id));
    }, event.payload.orderId);
  }

  onPaymentApproved(event) {
    return this.once(event, async (tx, row) => {
      if (row.status === 'CANCELLED') {
        await outbox(tx, createEnvelope('order.cancelled', { orderId: row.id, userId: row.userId, number: row.number, reason: row.cancelReason ?? 'Pedido cancelado', releaseStock: false }, event.id));
        return;
      }
      if (!canTransition(row.status, 'CONFIRMED')) return;
      await this.move(tx, row, 'CONFIRMED', 'Pagamento aprovado');
      await outbox(tx, createEnvelope('order.confirmed', { orderId: row.id, userId: row.userId, number: row.number, totalCents: row.totalCents }, event.id));
    }, event.payload.orderId);
  }

  onPaymentDeclined(event) {
    return this.once(event, async (tx, row) => {
      if (!canTransition(row.status, 'CANCELLED') || row.status !== 'AWAITING_PAYMENT') return;
      await this.cancelTx(tx, row, `Pagamento recusado: ${event.payload.reason}`, event.id);
    }, event.payload.orderId);
  }
}
