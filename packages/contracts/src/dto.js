import { z } from 'zod';
import { ErrorCode } from './errors.js';

/**
 * @template {import('zod').ZodType} S
 * @typedef {import('zod').output<S>} Dto valor já validado de um schema Zod
 */

/**
 * @template T
 * @typedef {{ items: T[], page: number, pageSize: number, total: number, totalPages: number }} Paginated
 */

/**
 * @template T, E
 * @typedef {{ ok: true, value: T } | { ok: false, error: E }} Result
 */

export const paginated = (item) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int()
  });

export const success = (data) => z.object({ ok: z.literal(true), data });

export const failure = z.object({
  ok: z.literal(false),
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional()
  })
});

export const envelope = (data) => z.discriminatedUnion('ok', [success(data), failure]);

/**
 * @template T
 * @param {T[]} items
 * @param {number} total
 * @param {number} page
 * @param {number} pageSize
 * @returns {Paginated<T>}
 */
export const toPage = (items, total, page, pageSize) => ({
  items,
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize))
});

export const ok = (value) => ({ ok: true, value });
export const err = (error) => ({ ok: false, error });
