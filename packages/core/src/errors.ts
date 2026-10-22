import { ZodError } from 'zod';
import { errorStatus } from '@cesto/contracts';
import type { ApiErrorBody, ErrorCode } from '@cesto/contracts';
import { ApiCallError } from '@cesto/contracts';

export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = new.target.name;
  }

  get status(): number {
    return errorStatus[this.code];
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super('NOT_FOUND', id ? `${entity} ${id} não encontrado` : `${entity} não encontrado`, id ? { entity, id } : { entity });
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, details);
  }
}

export class UnauthenticatedError extends DomainError {
  constructor(message = 'Autenticação necessária') {
    super('UNAUTHENTICATED', message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Acesso negado', details?: unknown) {
    super('FORBIDDEN', message, details);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_FAILED', message, details);
  }
}

export class InsufficientStockError extends DomainError {
  constructor(productIds: string[]) {
    super('INSUFFICIENT_STOCK', 'Estoque insuficiente para um ou mais itens', { productIds });
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super('INVALID_STATE_TRANSITION', `Não é possível passar de ${from} para ${to}`, { from, to });
  }
}

export class OAuthError extends DomainError {}

const isPrismaKnownError = (error: unknown): error is { code: string; meta?: Record<string, unknown> } =>
  typeof error === 'object' && error !== null && 'code' in error && typeof (error as { code: unknown }).code === 'string' && /^P\d{4}$/.test((error as { code: string }).code);

export const zodDetails = (error: ZodError) =>
  error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message, code: issue.code }));

export interface MappedError {
  status: number;
  body: ApiErrorBody;
  expose: boolean;
}

export const mapError = (error: unknown, requestId?: string): MappedError => {
  const withId = (body: ApiErrorBody): ApiErrorBody => (requestId ? { ...body, requestId } : body);
  if (error instanceof DomainError) {
    return { status: error.status, expose: true, body: withId({ code: error.code, message: error.message, details: error.details }) };
  }
  if (error instanceof ZodError) {
    return { status: 422, expose: true, body: withId({ code: 'VALIDATION_FAILED', message: 'Dados inválidos', details: zodDetails(error) }) };
  }
  if (error instanceof ApiCallError) {
    const status = error.status >= 500 ? 503 : error.status;
    return { status, expose: true, body: withId({ code: error.code, message: error.message, details: error.details }) };
  }
  if (isPrismaKnownError(error)) {
    if (error.code === 'P2002') return { status: 409, expose: true, body: withId({ code: 'CONFLICT', message: 'Registro duplicado', details: error.meta }) };
    if (error.code === 'P2025') return { status: 404, expose: true, body: withId({ code: 'NOT_FOUND', message: 'Registro não encontrado' }) };
    if (error.code === 'P2003') return { status: 409, expose: true, body: withId({ code: 'CONFLICT', message: 'Referência inválida', details: error.meta }) };
  }
  const fastifyError = error as { statusCode?: number; code?: string; message?: string };
  if (fastifyError?.statusCode === 429) {
    return { status: 429, expose: true, body: withId({ code: 'RATE_LIMITED', message: 'Muitas requisições, tente de novo em instantes' }) };
  }
  if (fastifyError?.statusCode && fastifyError.statusCode >= 400 && fastifyError.statusCode < 500) {
    const code: ErrorCode = fastifyError.statusCode === 404 ? 'NOT_FOUND' : fastifyError.statusCode === 401 ? 'UNAUTHENTICATED' : 'VALIDATION_FAILED';
    return { status: fastifyError.statusCode, expose: true, body: withId({ code, message: fastifyError.message ?? 'Requisição inválida' }) };
  }
  return { status: 500, expose: false, body: withId({ code: 'INTERNAL', message: 'Erro interno' }) };
};

export const isUniqueViolation = (error: unknown): boolean => isPrismaKnownError(error) && error.code === 'P2002';
