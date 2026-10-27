import { ZodError } from 'zod';
import { errorStatus, ApiCallError } from '@cesto/contracts';

/**
 * Erro de regra de negócio. O `code` vira o status HTTP (via `errorStatus`) e o corpo da resposta.
 *
 * @param {import('@cesto/contracts').ErrorCode} code
 * @param {string} message
 * @param {unknown} [details]
 */
export class DomainError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = new.target.name;
  }

  get status() {
    return errorStatus[this.code];
  }
}

export class NotFoundError extends DomainError {
  constructor(entity, id) {
    super('NOT_FOUND', id ? `${entity} ${id} não encontrado` : `${entity} não encontrado`, id ? { entity, id } : { entity });
  }
}

export class ConflictError extends DomainError {
  constructor(message, details) {
    super('CONFLICT', message, details);
  }
}

export class UnauthenticatedError extends DomainError {
  constructor(message = 'Autenticação necessária') {
    super('UNAUTHENTICATED', message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Acesso negado', details) {
    super('FORBIDDEN', message, details);
  }
}

export class ValidationError extends DomainError {
  constructor(message, details) {
    super('VALIDATION_FAILED', message, details);
  }
}

export class InsufficientStockError extends DomainError {
  constructor(productIds) {
    super('INSUFFICIENT_STOCK', 'Estoque insuficiente para um ou mais itens', { productIds });
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(from, to) {
    super('INVALID_STATE_TRANSITION', `Não é possível passar de ${from} para ${to}`, { from, to });
  }
}

export class OAuthError extends DomainError {}

const isPrismaKnownError = (error) =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && /^P\d{4}$/.test(error.code);

export const zodDetails = (error) =>
  error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message, code: issue.code }));

export const mapError = (error, requestId) => {
  const withId = (body) => (requestId ? { ...body, requestId } : body);
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
  const fastifyError = error;
  if (fastifyError?.statusCode === 429) {
    return { status: 429, expose: true, body: withId({ code: 'RATE_LIMITED', message: 'Muitas requisições, tente de novo em instantes' }) };
  }
  if (fastifyError?.statusCode && fastifyError.statusCode >= 400 && fastifyError.statusCode < 500) {
    const code = fastifyError.statusCode === 404 ? 'NOT_FOUND' : fastifyError.statusCode === 401 ? 'UNAUTHENTICATED' : 'VALIDATION_FAILED';
    return { status: fastifyError.statusCode, expose: true, body: withId({ code, message: fastifyError.message ?? 'Requisição inválida' }) };
  }
  return { status: 500, expose: false, body: withId({ code: 'INTERNAL', message: 'Erro interno' }) };
};

export const isUniqueViolation = (error) => isPrismaKnownError(error) && error.code === 'P2002';
