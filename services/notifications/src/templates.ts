import type { EventEnvelope, EventName, NotificationKind } from '@cesto/contracts';

export interface Rendered {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  orderId: string | null;
}

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const NOTIFIED_EVENTS = ['user.registered', 'order.placed', 'order.confirmed', 'order.cancelled', 'order.shipped', 'order.delivered'] as const satisfies readonly EventName[];

export const render = (event: EventEnvelope): Rendered | null => {
  switch (event.name) {
    case 'user.registered': {
      const p = (event as EventEnvelope<'user.registered'>).payload;
      return { userId: p.userId, kind: 'WELCOME', title: 'Boas-vindas ao Cesto', body: `Olá, ${p.name}! Sua conta está pronta.`, orderId: null };
    }
    case 'order.placed': {
      const p = (event as EventEnvelope<'order.placed'>).payload;
      return { userId: p.userId, kind: 'ORDER_PLACED', title: `Pedido #${p.number} recebido`, body: `Recebemos seu pedido de ${brl(p.totalCents)}. Estamos reservando os itens.`, orderId: p.orderId };
    }
    case 'order.confirmed': {
      const p = (event as EventEnvelope<'order.confirmed'>).payload;
      return { userId: p.userId, kind: 'ORDER_CONFIRMED', title: `Pedido #${p.number} confirmado`, body: `Pagamento de ${brl(p.totalCents)} aprovado. Agora é com a expedição.`, orderId: p.orderId };
    }
    case 'order.cancelled': {
      const p = (event as EventEnvelope<'order.cancelled'>).payload;
      const declined = p.reason.startsWith('Pagamento recusado');
      return { userId: p.userId, kind: declined ? 'PAYMENT_DECLINED' : 'ORDER_CANCELLED', title: `Pedido #${p.number} cancelado`, body: p.reason, orderId: p.orderId };
    }
    case 'order.shipped': {
      const p = (event as EventEnvelope<'order.shipped'>).payload;
      return { userId: p.userId, kind: 'ORDER_SHIPPED', title: `Pedido #${p.number} enviado`, body: 'Seu pedido saiu para entrega.', orderId: p.orderId };
    }
    case 'order.delivered': {
      const p = (event as EventEnvelope<'order.delivered'>).payload;
      return { userId: p.userId, kind: 'ORDER_DELIVERED', title: `Pedido #${p.number} entregue`, body: 'Esperamos que você goste!', orderId: p.orderId };
    }
    default:
      return null;
  }
};
