import type { Redis } from 'ioredis';
import { createEnvelope, parseEnvelope } from '@cesto/contracts';
import type { EventEnvelope, EventMap, EventName } from '@cesto/contracts';

export type EventHandler<K extends EventName> = (event: EventEnvelope<K>) => Promise<void>;
export type HandlerMap = { [K in EventName]?: EventHandler<K> };

export interface BusLogger {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface EventBusOptions {
  redis: Redis;
  service: string;
  consumer?: string;
  prefix?: string;
  maxAttempts?: number;
  blockMs?: number;
  claimIdleMs?: number;
  batchSize?: number;
  maxLen?: number;
  logger?: BusLogger;
}

type StreamEntry = [id: string, fields: string[]];
type StreamRead = Array<[stream: string, entries: StreamEntry[]]> | null;
type PendingRow = [id: string, consumer: string, idleMs: number, deliveries: number];

const silent: BusLogger = { info: () => {}, warn: () => {}, error: () => {} };

export class EventBus {
  private readonly prefix: string;
  private readonly consumer: string;
  private readonly logger: BusLogger;
  private reader: Redis | null = null;
  private running = false;
  private loops: Promise<void>[] = [];
  private handlers: HandlerMap = {};

  constructor(private readonly options: EventBusOptions) {
    this.prefix = options.prefix ?? 'cesto:events';
    this.consumer = options.consumer ?? `${options.service}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
    this.logger = options.logger ?? silent;
  }

  streamKey(name: EventName): string {
    return `${this.prefix}:${name}`;
  }

  get deadLetterKey(): string {
    return `${this.prefix}:dead-letter`;
  }

  async publish<K extends EventName>(name: K, payload: EventMap[K], correlationId: string | null = null): Promise<EventEnvelope<K>> {
    const envelope = createEnvelope(name, payload, correlationId);
    await this.publishEnvelope(envelope);
    return envelope;
  }

  async publishEnvelope(envelope: EventEnvelope): Promise<void> {
    await this.options.redis.xadd(this.streamKey(envelope.name), 'MAXLEN', '~', String(this.options.maxLen ?? 100_000), '*', 'event', JSON.stringify(envelope));
  }

  async subscribe(handlers: HandlerMap): Promise<void> {
    this.handlers = handlers;
    const names = Object.keys(handlers) as EventName[];
    if (names.length === 0) return;
    for (const name of names) {
      try {
        await this.options.redis.xgroup('CREATE', this.streamKey(name), this.options.service, '0', 'MKSTREAM');
      } catch (error) {
        if (!String((error as Error).message).includes('BUSYGROUP')) throw error;
      }
    }
    this.reader = this.options.redis.duplicate();
    this.running = true;
    this.loops.push(this.readLoop(names), this.reclaimLoop(names));
    this.logger.info({ events: names, consumer: this.consumer }, 'inscrito nos eventos');
  }

  async stop(): Promise<void> {
    this.running = false;
    this.reader?.disconnect();
    await Promise.allSettled(this.loops);
    this.loops = [];
  }

  private async readLoop(names: EventName[]): Promise<void> {
    const keys = names.map((n) => this.streamKey(n));
    while (this.running && this.reader) {
      try {
        const result = (await this.reader.xreadgroup(
          'GROUP',
          this.options.service,
          this.consumer,
          'COUNT',
          String(this.options.batchSize ?? 32),
          'BLOCK',
          String(this.options.blockMs ?? 2000),
          'STREAMS',
          ...keys,
          ...keys.map(() => '>')
        )) as StreamRead;
        if (!result) continue;
        for (const [stream, entries] of result) {
          for (const entry of entries) await this.handle(stream, entry);
        }
      } catch (error) {
        if (!this.running) return;
        this.logger.error({ err: error }, 'falha ao ler eventos');
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  private async reclaimLoop(names: EventName[]): Promise<void> {
    const idle = this.options.claimIdleMs ?? 15_000;
    const maxAttempts = this.options.maxAttempts ?? 5;
    while (this.running) {
      await new Promise((r) => setTimeout(r, Math.min(idle, 5000)));
      if (!this.running) return;
      for (const name of names) {
        const key = this.streamKey(name);
        try {
          const pending = (await this.options.redis.xpending(key, this.options.service, 'IDLE', idle, '-', '+', 32)) as PendingRow[];
          for (const [id, , , deliveries] of pending) {
            if (deliveries >= maxAttempts) {
              const entries = (await this.options.redis.xrange(key, id, id)) as StreamEntry[];
              await this.deadLetter(key, id, entries[0]?.[1] ?? [], `excedeu ${maxAttempts} tentativas`);
              continue;
            }
            const claimed = (await this.options.redis.xclaim(key, this.options.service, this.consumer, idle, id)) as StreamEntry[];
            for (const entry of claimed) await this.handle(key, entry);
          }
        } catch (error) {
          this.logger.error({ err: error, stream: key }, 'falha ao recuperar pendentes');
        }
      }
    }
  }

  private async handle(stream: string, [id, fields]: StreamEntry): Promise<void> {
    const raw = fields[fields.indexOf('event') + 1];
    let envelope: EventEnvelope;
    try {
      envelope = parseEnvelope(JSON.parse(raw ?? 'null'));
    } catch (error) {
      await this.deadLetter(stream, id, fields, `payload inválido: ${(error as Error).message}`);
      return;
    }
    const handler = this.handlers[envelope.name] as EventHandler<EventName> | undefined;
    if (!handler) {
      await this.options.redis.xack(stream, this.options.service, id);
      return;
    }
    try {
      await handler(envelope);
      await this.options.redis.xack(stream, this.options.service, id);
    } catch (error) {
      this.logger.warn({ err: error, event: envelope.name, eventId: envelope.id }, 'handler falhou, nova tentativa depois');
    }
  }

  private async deadLetter(stream: string, id: string, fields: string[], reason: string): Promise<void> {
    await this.options.redis.xadd(this.deadLetterKey, 'MAXLEN', '~', '10000', '*', 'stream', stream, 'id', id, 'group', this.options.service, 'reason', reason, ...fields);
    await this.options.redis.xack(stream, this.options.service, id);
    this.logger.error({ stream, id, reason }, 'evento enviado para dead-letter');
  }
}
