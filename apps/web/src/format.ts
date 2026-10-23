import type { OrderStatus } from '@cesto/contracts';

export const money = (cents: number, currency = 'BRL') => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Reservando',
  AWAITING_PAYMENT: 'Aguardando pagamento',
  CONFIRMED: 'Confirmado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado'
};

export const STATUS_TONE: Record<OrderStatus, 'neutral' | 'info' | 'good' | 'bad'> = {
  PENDING: 'neutral',
  AWAITING_PAYMENT: 'info',
  CONFIRMED: 'good',
  SHIPPED: 'good',
  DELIVERED: 'good',
  CANCELLED: 'bad'
};

export const FINAL: OrderStatus[] = ['DELIVERED', 'CANCELLED'];

export const decodeClaims = (token: string): { sub: string; role?: string; name?: string; email?: string } | null => {
  try {
    const payload = token.split('.')[1] ?? '';
    return JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))));
  } catch {
    return null;
  }
};
