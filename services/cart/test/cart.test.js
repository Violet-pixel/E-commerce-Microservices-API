import { describe, expect, it } from 'vitest';
import { buildCart } from '../src/cart.js';

const id = (n) => `7a2e9b10-0000-4b00-9000-${String(n).padStart(12, '0')}`;

describe('carrinho', () => {
  it('soma apenas itens disponíveis e descarta produtos removidos', () => {
    const cart = buildCart(
      'u',
      [
        { productId: id(1), quantity: 2 },
        { productId: id(2), quantity: 1 },
        { productId: id(3), quantity: 5 }
      ],
      [
        { id: id(1), sku: 'A-1', name: 'A', priceCents: 1000, currency: 'BRL', imageUrl: null, active: true },
        { id: id(2), sku: 'B-1', name: 'B', priceCents: 700, currency: 'BRL', imageUrl: null, active: false }
      ]
    );
    expect(cart.items).toHaveLength(2);
    expect(cart.totalCents).toBe(2000);
    expect(cart.itemCount).toBe(2);
    expect(cart.items[1]?.available).toBe(false);
  });
});
