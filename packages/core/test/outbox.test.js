import { describe, expect, it } from 'vitest';
import { createEnvelope } from '@cesto/contracts';
import { startOutboxRelay } from '../src/index.js';

describe('outbox', () => {
  it('publica em ordem e marca como publicado', async () => {
    const rows = [1, 2, 3].map(() => {
      const envelope = createEnvelope('inventory.reserved', { orderId: crypto.randomUUID() });
      return { id: envelope.id, envelope, published: false };
    });
    const sent = [];
    const relay = startOutboxRelay({
      intervalMs: 10,
      store: {
        pending: async (limit) => rows.filter((r) => !r.published).slice(0, limit),
        markPublished: async (ids) => rows.forEach((r) => ids.includes(r.id) && (r.published = true))
      },
      publisher: { publishEnvelope: async (e) => void sent.push(e) }
    });
    await new Promise((r) => setTimeout(r, 60));
    await relay.stop();
    expect(sent.map((e) => e.id)).toEqual(rows.map((r) => r.id));
    expect(rows.every((r) => r.published)).toBe(true);
  });
});
