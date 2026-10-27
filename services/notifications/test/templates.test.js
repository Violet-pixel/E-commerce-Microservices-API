import { describe, expect, it } from 'vitest';
import { createEnvelope } from '@cesto/contracts';
import { render } from '../src/templates.js';

const orderId = '7a2e9b10-0000-4b00-9000-000000000001';

describe('modelos de notificação', () => {
  it('formata valores em reais', () => {
    const n = render(createEnvelope('order.confirmed', { orderId, userId: 'u', number: 7, totalCents: 123456 }));
    expect(n).toMatchObject({ kind: 'ORDER_CONFIRMED', title: 'Pedido #7 confirmado', orderId });
    expect(n?.body).toContain('1.234,56');
  });

  it('diferencia pagamento recusado de cancelamento comum', () => {
    expect(render(createEnvelope('order.cancelled', { orderId, userId: 'u', number: 1, reason: 'Pagamento recusado: limite', releaseStock: true }))?.kind).toBe('PAYMENT_DECLINED');
    expect(render(createEnvelope('order.cancelled', { orderId, userId: 'u', number: 1, reason: 'Cancelado pelo cliente', releaseStock: true }))?.kind).toBe('ORDER_CANCELLED');
  });

  it('ignora eventos sem notificação', () => {
    expect(render(createEnvelope('inventory.reserved', { orderId }))).toBeNull();
  });
});
