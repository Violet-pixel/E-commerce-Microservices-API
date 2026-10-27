import { DEMO_PRODUCTS, createEnvelope } from '@cesto/contracts';
import { NotFoundError, isUniqueViolation, iso } from '@cesto/core';

class ReservationFailed extends Error {
  constructor(productIds) {
    super('estoque insuficiente');
    this.productIds = productIds;
  }
}

export const toStockDto = (row) => ({
  productId: row.productId,
  sku: row.sku,
  available: row.available,
  reserved: row.reserved,
  updatedAt: iso(row.updatedAt)
});

const outbox = (tx, envelope) =>
  tx.outboxEvent.create({ data: { id: envelope.id, name: envelope.name, envelope: envelope } });

export class InventoryService {
  constructor(db, notify, seedDemo) {
    this.db = db;
    this.notify = notify;
    this.seedDemo = seedDemo;
  }

  async once(event, work) {
    if (await this.db.processedEvent.findUnique({ where: { eventId: event.id } })) return;
    try {
      await this.db.$transaction(async (tx) => {
        await tx.processedEvent.create({ data: { eventId: event.id, name: event.name } });
        await work(tx);
      });
    } catch (error) {
      if (isUniqueViolation(error) && (await this.db.processedEvent.findUnique({ where: { eventId: event.id } }))) return;
      throw error;
    }
    this.notify();
  }

  async list(productIds) {
    const rows = await this.db.stockItem.findMany({ where: productIds ? { productId: { in: productIds } } : {}, orderBy: { sku: 'asc' } });
    return rows.map(toStockDto);
  }

  async set(productId, available) {
    const exists = await this.db.stockItem.findUnique({ where: { productId } });
    if (!exists) throw new NotFoundError('Item de estoque', productId);
    return toStockDto(await this.db.stockItem.update({ where: { productId }, data: { available } }));
  }

  onProductCreated(event) {
    const initial = this.seedDemo ? (DEMO_PRODUCTS.find((p) => p.id === event.payload.productId)?.stock ?? 0) : 0;
    return this.once(event, async (tx) => {
      await tx.stockItem.upsert({
        where: { productId: event.payload.productId },
        update: { sku: event.payload.sku },
        create: { productId: event.payload.productId, sku: event.payload.sku, available: initial }
      });
    });
  }

  onProductUpdated(event) {
    return this.once(event, async (tx) => {
      await tx.stockItem.upsert({
        where: { productId: event.payload.productId },
        update: { sku: event.payload.sku },
        create: { productId: event.payload.productId, sku: event.payload.sku }
      });
    });
  }

  async onOrderPlaced(event) {
    const { orderId, items } = event.payload;
    const merged = new Map();
    for (const item of items) merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
    try {
      await this.once(event, async (tx) => {
        const missing = [];
        for (const [productId, quantity] of [...merged.entries()].sort(([a], [b]) => a.localeCompare(b))) {
          const result = await tx.stockItem.updateMany({
            where: { productId, available: { gte: quantity } },
            data: { available: { decrement: quantity }, reserved: { increment: quantity } }
          });
          if (result.count !== 1) missing.push(productId);
        }
        if (missing.length) throw new ReservationFailed(missing);
        await tx.reservation.createMany({ data: [...merged.entries()].map(([productId, quantity]) => ({ orderId, productId, quantity })) });
        await outbox(tx, createEnvelope('inventory.reserved', { orderId }, event.id));
      });
    } catch (error) {
      if (!(error instanceof ReservationFailed)) throw error;
      await this.once(event, async (tx) => {
        await outbox(tx, createEnvelope('inventory.rejected', { orderId, reason: 'Estoque insuficiente', productIds: error.productIds }, event.id));
      });
    }
  }

  onOrderConfirmed(event) {
    return this.once(event, async (tx) => {
      const held = await tx.reservation.findMany({ where: { orderId: event.payload.orderId, status: 'HELD' } });
      for (const r of held) {
        await tx.stockItem.update({ where: { productId: r.productId }, data: { reserved: { decrement: r.quantity } } });
      }
      await tx.reservation.updateMany({ where: { orderId: event.payload.orderId, status: 'HELD' }, data: { status: 'COMMITTED' } });
    });
  }

  onOrderCancelled(event) {
    return this.once(event, async (tx) => {
      const active = await tx.reservation.findMany({ where: { orderId: event.payload.orderId, status: { in: ['HELD', 'COMMITTED'] } } });
      for (const r of active) {
        const data = r.status === 'HELD' ? { reserved: { decrement: r.quantity }, available: { increment: r.quantity } } : { available: { increment: r.quantity } };
        await tx.stockItem.update({ where: { productId: r.productId }, data });
      }
      await tx.reservation.updateMany({ where: { orderId: event.payload.orderId, status: { in: ['HELD', 'COMMITTED'] } }, data: { status: 'RELEASED' } });
    });
  }
}
