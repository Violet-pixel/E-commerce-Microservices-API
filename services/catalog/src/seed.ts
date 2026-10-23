import { DEMO_CATEGORIES, DEMO_PRODUCTS, createEnvelope } from '@cesto/contracts';
import type { Db } from './db.js';
import { outboxData } from './catalog.js';

export const seed = async (db: Db): Promise<void> => {
  if ((await db.product.count()) > 0) return;
  await db.$transaction(async (tx) => {
    await tx.category.createMany({ data: DEMO_CATEGORIES.map((c) => ({ ...c })), skipDuplicates: true });
    for (const p of DEMO_PRODUCTS) {
      const category = DEMO_CATEGORIES.find((c) => c.slug === p.category);
      const row = await tx.product.create({
        data: { id: p.id, sku: p.sku, name: p.name, slug: p.slug, description: p.description, priceCents: p.priceCents, imageUrl: `/produtos/${p.slug}.svg`, categoryId: category?.id ?? null }
      });
      await tx.outboxEvent.create({
        data: outboxData(createEnvelope('product.created', { productId: row.id, sku: row.sku, name: row.name, priceCents: row.priceCents, active: row.active }))
      });
    }
  });
};
