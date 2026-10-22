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

const TILE_TONES = ['#2b3540', '#5e7350', '#a65a6a', '#4a5a6b', '#8395a7', '#b0a08c'];

export const tileTone = (sku: string) => TILE_TONES[[...sku].reduce((n, c) => n + c.charCodeAt(0), 0) % TILE_TONES.length] ?? '#2b3540';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
