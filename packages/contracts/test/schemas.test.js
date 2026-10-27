import { describe, expect, it } from 'vitest';
import { CheckoutBody, CreateProductBody, ProductQuery, RegisterBody, StockQuery, TokenBody, createEnvelope, parseEnvelope } from '../src/index.js';

const address = { recipient: 'Ana', street: 'Rua A', number: '1', district: 'Centro', city: 'Niterói', state: 'rj', postalCode: '24020-000' };

describe('validação estrita', () => {
  it('normaliza o endereço e rejeita campos extras', () => {
    expect(CheckoutBody.parse({ shippingAddress: address, paymentMethod: 'pix' }).shippingAddress.state).toBe('RJ');
    expect(CheckoutBody.safeParse({ shippingAddress: { ...address, extra: 1 }, paymentMethod: 'pix' }).success).toBe(false);
    expect(CheckoutBody.safeParse({ shippingAddress: { ...address, postalCode: '123' }, paymentMethod: 'pix' }).success).toBe(false);
  });

  it('converte e limita a paginação', () => {
    const q = ProductQuery.parse({ page: '2', pageSize: '10' });
    expect(q).toMatchObject({ page: 2, pageSize: 10, sort: 'newest' });
    expect(ProductQuery.safeParse({ pageSize: '500' }).success).toBe(false);
    expect(ProductQuery.safeParse({ minPrice: '500', maxPrice: '100' }).success).toBe(false);
  });

  it('aplica padrões no cadastro de produto', () => {
    const p = CreateProductBody.parse({ sku: 'ABC-1', name: 'Item', slug: 'item', priceCents: 1000 });
    expect(p).toMatchObject({ currency: 'BRL', active: true, imageUrl: null, categoryId: null, description: '' });
    expect(CreateProductBody.safeParse({ sku: 'abc', name: 'Item', slug: 'Item X', priceCents: -1 }).success).toBe(false);
  });

  it('exige senha com letras e números', () => {
    expect(RegisterBody.safeParse({ email: 'A@B.COM', name: 'Ana', password: 'abcdefgh' }).success).toBe(false);
    expect(RegisterBody.parse({ email: ' A@B.COM ', name: 'Ana', password: 'abcd1234' }).email).toBe('a@b.com');
  });

  it('discrimina os grant types', () => {
    expect(TokenBody.safeParse({ grant_type: 'client_credentials', client_id: 'x', client_secret: '12345678' }).success).toBe(true);
    expect(TokenBody.safeParse({ grant_type: 'password', username: 'a', password: 'b' }).success).toBe(false);
  });

  it('transforma listas separadas por vírgula', () => {
    const id = '7a2e9b10-0000-4b00-9000-000000000001';
    expect(StockQuery.parse({ productIds: `${id},${id}` }).productIds).toEqual([id, id]);
    expect(StockQuery.safeParse({ productIds: 'x' }).success).toBe(false);
  });
});

describe('eventos', () => {
  it('valida o payload ao criar e ao ler', () => {
    const env = createEnvelope('inventory.reserved', { orderId: '7a2e9b10-0000-4b00-9000-000000000001' });
    expect(parseEnvelope(JSON.parse(JSON.stringify(env)))).toEqual(env);
    expect(() => parseEnvelope({ ...env, payload: { orderId: 'x' } })).toThrow();
    expect(() => parseEnvelope({ ...env, name: 'evento.desconhecido' })).toThrow();
  });
});
