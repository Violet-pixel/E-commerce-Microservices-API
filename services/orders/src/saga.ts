import type { OrderStatus, ProductSnapshot, RawCart } from '@cesto/contracts';
import { DomainError, InvalidTransitionError, ValidationError } from '@cesto/core';

export const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: []
};

export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['PENDING', 'AWAITING_PAYMENT'];

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => TRANSITIONS[from].includes(to);

export const assertTransition = (from: OrderStatus, to: OrderStatus): void => {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
};

export const holdsStock = (status: OrderStatus): boolean => status === 'AWAITING_PAYMENT' || status === 'CONFIRMED';

export interface PricedLine {
  productId: string;
  sku: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export interface PricedOrder {
  lines: PricedLine[];
  totalCents: number;
  currency: ProductSnapshot['currency'];
}

export const priceOrder = (cart: RawCart, products: ProductSnapshot[]): PricedOrder => {
  if (cart.items.length === 0) throw new DomainError('EMPTY_CART', 'O carrinho está vazio');
  const byId = new Map(products.map((p) => [p.id, p]));
  const unavailable = cart.items.filter((i) => !byId.get(i.productId)?.active).map((i) => i.productId);
  if (unavailable.length) throw new ValidationError('Há produtos indisponíveis no carrinho', { productIds: unavailable });
  const currencies = new Set(cart.items.map((i) => byId.get(i.productId)!.currency));
  if (currencies.size > 1) throw new ValidationError('O carrinho mistura moedas diferentes');
  const lines = cart.items.map((i) => {
    const p = byId.get(i.productId)!;
    return { productId: p.id, sku: p.sku, name: p.name, unitPriceCents: p.priceCents, quantity: i.quantity };
  });
  return {
    lines,
    totalCents: lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0),
    currency: [...currencies][0] ?? 'BRL'
  };
};
