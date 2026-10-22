import type { EventEnvelope } from '@cesto/contracts';

export interface OutboxRow {
  id: string;
  envelope: unknown;
}

export interface OutboxStore {
  pending(limit: number): Promise<OutboxRow[]>;
  markPublished(ids: string[]): Promise<void>;
}

export interface OutboxPublisher {
  publishEnvelope(envelope: EventEnvelope): Promise<void>;
}

export interface OutboxRelayOptions {
  store: OutboxStore;
  publisher: OutboxPublisher;
  intervalMs?: number;
  batchSize?: number;
  onError?: (error: unknown) => void;
}

export const startOutboxRelay = (options: OutboxRelayOptions) => {
  const interval = options.intervalMs ?? 500;
  const batch = options.batchSize ?? 100;
  let stopped = false;
  let running: Promise<void> | null = null;
  let wake: (() => void) | null = null;

  const tick = async () => {
    const rows = await options.store.pending(batch);
    const done: string[] = [];
    for (const row of rows) {
      await options.publisher.publishEnvelope(row.envelope as EventEnvelope);
      done.push(row.id);
    }
    if (done.length) await options.store.markPublished(done);
    return rows.length === batch;
  };

  const loop = async () => {
    while (!stopped) {
      let more = false;
      try {
        more = await tick();
      } catch (error) {
        options.onError?.(error);
      }
      if (!more && !stopped) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, interval);
          wake = () => {
            clearTimeout(timer);
            resolve();
          };
        });
        wake = null;
      }
    }
  };

  running = loop();

  return {
    notify: () => wake?.(),
    stop: async () => {
      stopped = true;
      wake?.();
      await running;
    }
  };
};
