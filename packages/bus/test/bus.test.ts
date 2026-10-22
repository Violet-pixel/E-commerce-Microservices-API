import { afterAll, describe, expect, it } from 'vitest';
import { Redis } from 'ioredis';
import { EventBus } from '../src/index.js';
import type { EventEnvelope } from '@cesto/contracts';

const url = process.env.TEST_REDIS_URL;

describe.runIf(Boolean(url))('barramento Redis Streams', () => {
  const redis = new Redis(url ?? '', { maxRetriesPerRequest: null });
  const prefix = `cesto:test:${Date.now()}`;
  afterAll(async () => {
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length) await redis.del(...keys);
    await redis.quit();
  });

  it('entrega, confirma e reprocessa falhas', async () => {
    const received: EventEnvelope<'inventory.reserved'>[] = [];
    let failures = 0;
    const consumer = new EventBus({ redis, service: 'teste', prefix, blockMs: 100, claimIdleMs: 200 });
    await consumer.subscribe({
      'inventory.reserved': async (e) => {
        if (failures++ === 0) throw new Error('falha passageira');
        received.push(e);
      }
    });
    const producer = new EventBus({ redis, service: 'produtor', prefix });
    const sent = await producer.publish('inventory.reserved', { orderId: crypto.randomUUID() });
    for (let i = 0; i < 60 && received.length === 0; i++) await new Promise((r) => setTimeout(r, 100));
    await consumer.stop();
    expect(received.map((e) => e.id)).toEqual([sent.id]);
    const pending = (await redis.xpending(`${prefix}:inventory.reserved`, 'teste')) as [number];
    expect(pending[0]).toBe(0);
  });
});
