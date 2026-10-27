import { describe, expect, it } from 'vitest';
import { STATUS_LABEL, STATUS_TONE, decodeClaims, money, plural } from '../src/format.js';

describe('formatação da loja', () => {
  it('formata centavos em reais', () => {
    expect(money(38990).replace(/\s/g, ' ')).toBe('R$ 389,90');
    expect(money(0).replace(/\s/g, ' ')).toBe('R$ 0,00');
  });

  it('escolhe singular ou plural', () => {
    expect(plural(1, 'item', 'itens')).toBe('1 item');
    expect(plural(3, 'item', 'itens')).toBe('3 itens');
    expect(plural(1200, 'produto', 'produtos')).toBe('1.200 produtos');
  });

  it('tem rótulo e tom para todo status de pedido', () => {
    for (const status of ['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']) {
      expect(STATUS_LABEL[status]).toBeTruthy();
      expect(STATUS_TONE[status]).toBeTruthy();
    }
  });

  it('lê as claims de um JWT com acentos e ignora token inválido', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', name: 'Conceição', role: 'ADMIN' })).toString('base64url');
    expect(decodeClaims(`x.${payload}.y`)).toMatchObject({ name: 'Conceição', role: 'ADMIN' });
    expect(decodeClaims('lixo')).toBeNull();
  });
});
