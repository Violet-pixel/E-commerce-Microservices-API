import { useState } from 'react';
import type { OrderDto, OrderStatus } from '@cesto/contracts';
import { api, errorMessage, request } from '../api';
import { useAsync, useInterval } from '../hooks';
import { FINAL, STATUS_LABEL, dateTime, money } from '../format';
import { Empty, StatusPill } from '../components/ui';

const PAYMENT_LABEL: Record<string, string> = { pix: 'Pix', card: 'Cartão', boleto: 'Boleto' };

export const OrderCard = ({ order, actions }: { order: OrderDto; actions?: React.ReactNode }) => (
  <article className="order">
    <header>
      <div>
        <h3>Pedido #{order.number}</h3>
        <p className="order-meta">
          <time>{dateTime(order.createdAt)}</time>
          <span>{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
          <span>
            {order.shippingAddress.city}/{order.shippingAddress.state}
          </span>
        </p>
      </div>
      <StatusPill status={order.status} />
    </header>
    <div className="order-body">
      <ul className="order-items">
        {order.items.map((i) => (
          <li key={i.productId}>
            <span>
              {i.quantity}× {i.name}
            </span>
            <i className="leader" aria-hidden="true" />
            <span>{money(i.subtotalCents, order.currency)}</span>
          </li>
        ))}
        <li className="sum">
          <span>Total</span>
          <i className="leader" aria-hidden="true" />
          <strong>{money(order.totalCents, order.currency)}</strong>
        </li>
      </ul>
      <ol className={FINAL.includes(order.status) ? 'timeline done' : 'timeline'}>
        {order.history.map((h, index) => (
          <li key={`${h.status}-${index}`} className={h.status === 'CANCELLED' ? 'bad' : ''}>
            <strong>{STATUS_LABEL[h.status]}</strong>
            <span>{h.note}</span>
            <time>{dateTime(h.at)}</time>
          </li>
        ))}
      </ol>
    </div>
    {actions ? <footer>{actions}</footer> : null}
  </article>
);

export const Orders = ({ notify }: { notify: (message: string) => void }) => {
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const orders = useAsync(() => request(api.orders.list, { query: { pageSize: 20, status: status || undefined } }), [status]);
  const live = orders.data?.items.some((o) => !FINAL.includes(o.status) && o.status !== 'CONFIRMED' && o.status !== 'SHIPPED');
  useInterval(() => void orders.reload(true), live ? 1500 : 8000);

  const cancel = async (id: string) => {
    try {
      await request(api.orders.cancel, { params: { id }, body: {} });
      notify('Pedido cancelado');
      await orders.reload(true);
    } catch (e) {
      notify(errorMessage(e));
    }
  };

  return (
    <section className="page">
      <div className="row between">
        <h1>Meus pedidos</h1>
        <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | '')} aria-label="Filtrar por status">
          <option value="">Todos</option>
          {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      {orders.error ? <div className="alert">{orders.error}</div> : null}
      {orders.data?.items.length === 0 ? <Empty title="Nenhum pedido ainda">Quando você fechar um pedido, ele aparece aqui com cada etapa.</Empty> : null}
      <div className="orders">
        {orders.data?.items.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            actions={
              o.status === 'PENDING' || o.status === 'AWAITING_PAYMENT' ? (
                <button className="btn ghost" onClick={() => void cancel(o.id)}>
                  Cancelar pedido
                </button>
              ) : null
            }
          />
        ))}
      </div>
    </section>
  );
};
