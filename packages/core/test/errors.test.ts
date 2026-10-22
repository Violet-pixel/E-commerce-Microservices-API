import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiCallError } from '@cesto/contracts';
import { ConflictError, DomainError, InsufficientStockError, NotFoundError, isUniqueViolation, mapError } from '../src/index.js';

describe('mapeamento de erros de domínio', () => {
  it('usa o status do código', () => {
    expect(mapError(new NotFoundError('Pedido', 'x'), 'req-1')).toEqual({
      status: 404,
      expose: true,
      body: { code: 'NOT_FOUND', message: 'Pedido x não encontrado', details: { entity: 'Pedido', id: 'x' }, requestId: 'req-1' }
    });
    expect(mapError(new InsufficientStockError(['a'])).status).toBe(409);
    expect(mapError(new DomainError('PAYMENT_DECLINED', 'recusado')).status).toBe(402);
    expect(mapError(new ConflictError('dup')).body.code).toBe('CONFLICT');
  });

  it('transforma ZodError em 422 com detalhes por campo', () => {
    const result = z.object({ email: z.email() }).safeParse({ email: 'x' });
    const mapped = mapError(result.error);
    expect(mapped.status).toBe(422);
    expect(mapped.body.details).toEqual([expect.objectContaining({ path: 'email' })]);
  });

  it('traduz erros conhecidos do Prisma', () => {
    expect(mapError({ code: 'P2002', meta: { target: ['email'] } }).status).toBe(409);
    expect(mapError({ code: 'P2025' }).status).toBe(404);
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
  });

  it('propaga falhas de serviços vizinhos como 503', () => {
    expect(mapError(new ApiCallError(500, 'INTERNAL', 'x')).status).toBe(503);
    expect(mapError(new ApiCallError(404, 'NOT_FOUND', 'x')).status).toBe(404);
  });

  it('esconde erros inesperados', () => {
    const mapped = mapError(new Error('segredo do banco'));
    expect(mapped).toMatchObject({ status: 500, expose: false, body: { code: 'INTERNAL', message: 'Erro interno' } });
  });
});
