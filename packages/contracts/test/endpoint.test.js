import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { api, buildPath, buildQuery, defineEndpoint, envelope, paginated, toPage } from '../src/index.js';

describe('tipos de endpoint', () => {
  it('extrai parâmetros do caminho em tempo de compilação', () => {
    expectTypeOf().toEqualTypeOf();
    expectTypeOf().toEqualTypeOf();
  });

  it('infere corpo, parâmetros e resposta a partir do contrato', () => {
    expectTypeOf().toEqualTypeOf();
    expectTypeOf().toEqualTypeOf();
    expectTypeOf().toEqualTypeOf();
    expectTypeOf().toExtend();
    expectTypeOf().toHaveProperty('params').toEqualTypeOf();
  });

  it('mantém o literal do método e do caminho', () => {
    const e = defineEndpoint({ method: 'GET', path: '/x/:slug', summary: 'x', tags: [], auth: 'public', response: z.string() });
    expectTypeOf(e.method).toEqualTypeOf();
    expectTypeOf().toEqualTypeOf();
  });
});

describe('montagem de URL', () => {
  it('substitui e codifica parâmetros', () => {
    expect(buildPath('/a/:id/b/:name', { id: '1', name: 'café com leite' })).toBe('/a/1/b/caf%C3%A9%20com%20leite');
  });

  it('falha quando falta parâmetro', () => {
    expect(() => buildPath('/a/:id', {})).toThrow(/id/);
  });

  it('ignora valores vazios e repete arrays', () => {
    expect(buildQuery({ q: 'x', empty: '', none: undefined, tags: ['a', 'b'], page: 2 })).toBe('?q=x&tags=a&tags=b&page=2');
    expect(buildQuery({})).toBe('');
  });
});

describe('DTOs genéricos', () => {
  it('calcula páginas', () => {
    expect(toPage([1, 2], 41, 2, 20)).toEqual({ items: [1, 2], page: 2, pageSize: 20, total: 41, totalPages: 3 });
    expect(toPage([], 0, 1, 20).totalPages).toBe(1);
  });

  it('valida o envelope de sucesso e de erro', () => {
    const schema = envelope(paginated(z.object({ id: z.number() })));
    expect(schema.parse({ ok: true, data: { items: [{ id: 1 }], page: 1, pageSize: 1, total: 1, totalPages: 1 } }).ok).toBe(true);
    expect(schema.parse({ ok: false, error: { code: 'NOT_FOUND', message: 'x' } }).ok).toBe(false);
    expect(schema.safeParse({ ok: false, error: { code: 'INVENTADO', message: 'x' } }).success).toBe(false);
  });
});
