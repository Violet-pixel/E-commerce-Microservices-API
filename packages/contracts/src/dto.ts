import { z } from 'zod';
import { ErrorCode } from './errors.js';

export type Schema = z.ZodType;
export type Dto<S extends Schema> = z.output<S>;
export type DtoInput<S extends Schema> = z.input<S>;

export type Mutable<T> = { -readonly [K in keyof T]: T[K] };
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
export type Merge<A, B> = Omit<A, keyof B> & B;

export type CreateDto<T, Server extends keyof T = never> = Omit<T, Server | 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateDto<T, Server extends keyof T = never> = Partial<CreateDto<T, Server>>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiFailure {
  ok: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const paginated = <S extends Schema>(item: S) =>
  z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int()
  });

export const success = <S extends Schema>(data: S) => z.object({ ok: z.literal(true), data });

export const failure = z.object({
  ok: z.literal(false),
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional()
  })
});

export const envelope = <S extends Schema>(data: S) => z.discriminatedUnion('ok', [success(data), failure]);

export const toPage = <T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> => ({
  items,
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize))
});

export type Result<T, E = ApiErrorBody> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
