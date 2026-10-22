import { describe, expect, it } from 'vitest';
import { DomainError } from '@cesto/core';
import { assertTransition, canTransition, holdsStock, priceOrder } from '../src/saga.js';

const id = (n: number) => `7a2e9b10-0000-4b00-9000-${String(n).padStart(12, '0')}`;
const product = (n: number, priceCents: number, active = true) => ({ id: id(n), sku: `SKU-${n}`, name: `P${n}`, priceCents, currency: 'BRL' as const, imageUrl: null, active });

describe('máquina de estados do pedido', () => {
  it('segue o caminho feliz', () => {
    expect(canTransition('PENDING', 'AWAITING_PAYMENT')).toBe(true);
    expect(canTransition('AWAITING_PAYMENT', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'SHIPPED')).toBe(true);
    expect(canTransition('SHIPPED', 'DELIVERED')).toBe(true);
  });

  it('bloqueia saltos e estados finais', () => {
    expect(canTransition('PENDING', 'CONFIRMED')).toBe(false);
    expect(canTransition('DELIVERED', 'CANCELLED')).toBe(false);
    expect(canTransition('CANCELLED', 'CONFIRMED')).toBe(false);
    expect(() => assertTransition('SHIPPED', 'CANCELLED')).toThrow(DomainError);
  });

  it('sabe quando há estoque a devolver', () => {
    expect(holdsStock('PENDING')).toBe(false);
    expect(holdsStock('AWAITING_PAYMENT')).toBe(true);
    expect(holdsStock('CONFIRMED')).toBe(true);
  });
});

describe('precificação no checkout', () => {
  it('usa o preço atual do catálogo', () => {
    const priced = priceOrder({ userId: 'u', items: [{ productId: id(1), quantity: 2 }, { productId: id(2), quantity: 1 }] }, [product(1, 1990), product(2, 500)]);
    expect(priced.totalCents).toBe(4480);
    expect(priced.lines).toHaveLength(2);
  });

  it('recusa carrinho vazio e itens inativos', () => {
    expect(() => priceOrder({ userId: 'u', items: [] }, [])).toThrow(expect.objectContaining({ code: 'EMPTY_CART' }));
    expect(() => priceOrder({ userId: 'u', items: [{ productId: id(1), quantity: 1 }] }, [product(1, 100, false)])).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
    expect(() => priceOrder({ userId: 'u', items: [{ productId: id(3), quantity: 1 }] }, [])).toThrow(expect.objectContaining({ code: 'VALIDATION_FAILED' }));
  });
});
