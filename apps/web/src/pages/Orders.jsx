import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { api, errorMessage, request } from '../api';
import { useAsync, useInterval } from '../hooks';
import { FINAL, PAYMENT_LABEL, dateTime, money } from '../format';
import { Empty, ProductTile, StatusPill, productImage } from '../components/ui';

// Cada etapa da saga e o serviço que a resolve. O pedido chega numa etapa quando o status aparece no histórico.
const SAGA = [
  { status: 'PENDING', label: 'Pedido recebido', service: 'orders' },
  { status: 'AWAITING_PAYMENT', label: 'Estoque reservado', service: 'inventory' },
  { status: 'CONFIRMED', label: 'Pagamento aprovado', service: 'payments' },
  { status: 'SHIPPED', label: 'Enviado', service: 'orders' },
  { status: 'DELIVERED', label: 'Entregue', service: 'orders' }
];

export const SagaTrack = ({ order }) => {
  const reached = new Map(order.history.map((h) => [h.status, h]));
  const cancelled = reached.get('CANCELLED');
  const lastIndex = SAGA.reduce((last, s, i) => (reached.has(s.status) ? i : last), -1);
  return (
    <ol className={cancelled ? 'saga cancelled' : 'saga'} aria-label="Etapas do pedido">
      {SAGA.map((s, i) => {
        const hit = reached.get(s.status);
        const failed = cancelled && i === lastIndex + 1;
        const state = hit ? 'done' : failed ? 'failed' : !cancelled && i === lastIndex + 1 ? 'next' : '';
        return (
          <li key={s.status} className={state}>
            <span className="saga-dot" aria-hidden="true">
              {hit ? <Check size={12} strokeWidth={3} /> : failed ? <X size={12} strokeWidth={3} /> : null}
            </span>
            <strong>{failed ? (i === 1 ? 'Sem estoque' : i === 2 ? 'Pagamento recusado' : 'Cancelado') : s.label}</strong>
            <code>{s.service}</code>
            <time>{hit ? dateTime(hit.at) : failed ? dateTime(cancelled.at) : state === 'next' ? 'aguardando…' : ''}</time>
          </li>
        );
      })}
    </ol>
  );
};

export const OrderCard = ({ order, actions, admin = false }) => {
  const note = [...order.history].reverse().find((h) => h.note)?.note;
  return (
    <article className={`order status-${order.status.toLowerCase()}`}>
      <header>
        <div>
          <h3>
            Pedido <code>#{order.number}</code>
          </h3>
          <p className="order-meta">
            <time>{dateTime(order.createdAt)}</time>
            <span>{PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}</span>
            <span>
              {admin ? `${order.shippingAddress.recipient} · ` : ''}
              {order.shippingAddress.city}/{order.shippingAddress.state}
            </span>
          </p>
        </div>
        <div className="order-head-right">
          <StatusPill status={order.status} />
          <strong className="order-total">{money(order.totalCents, order.currency)}</strong>
        </div>
      </header>
      <SagaTrack order={order} />
      {order.status === 'CANCELLED' && (order.cancelReason || note) ? <p className="order-note">{order.cancelReason ?? note}</p> : null}
      <ul className="order-items">
        {order.items.map((i) => (
          <li key={i.productId}>
            <ProductTile src={productImage({ productId: i.productId, sku: i.sku })} small />
            <span>
              {i.quantity}× {i.name}
            </span>
            <span>{money(i.subtotalCents, order.currency)}</span>
          </li>
        ))}
      </ul>
      {actions ? <footer>{actions}</footer> : null}
    </article>
  );
};

const FILTERS = [
  { id: '', label: 'Todos' },
  { id: 'open', label: 'Em andamento' },
  { id: 'DELIVERED', label: 'Entregues' },
  { id: 'CANCELLED', label: 'Cancelados' }
];

export const Orders = ({ notify, onCartChanged }) => {
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(null);
  const status = filter === 'open' ? undefined : filter || undefined;
  const orders = useAsync(() => request(api.orders.list, { query: { pageSize: 30, status } }), [filter]);
  const list = (orders.data?.items ?? []).filter((o) => filter !== 'open' || !FINAL.includes(o.status));
  const live = list.some((o) => o.status === 'PENDING' || o.status === 'AWAITING_PAYMENT');
  useInterval(() => void orders.reload(true), live ? 1500 : 8000);

  const cancel = async (o) => {
    if (!window.confirm(`Cancelar o pedido #${o.number}? A reserva de estoque volta para a loja.`)) return;
    try {
      await request(api.orders.cancel, { params: { id: o.id }, body: {} });
      notify('Pedido cancelado. O estoque reservado foi devolvido.');
      await orders.reload(true);
    } catch (e) {
      notify(errorMessage(e), 'bad');
    }
  };

  const again = async (o) => {
    setBusy(o.id);
    let ok = 0;
    for (const i of o.items) {
      try {
        await request(api.cart.add, { body: { productId: i.productId, quantity: i.quantity } });
        ok++;
      } catch {}
    }
    await onCartChanged();
    setBusy(null);
    notify(ok === o.items.length ? `Itens do pedido #${o.number} de volta no carrinho` : `${ok} de ${o.items.length} itens voltaram; o resto está sem estoque`, ok ? 'good' : 'bad');
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Histórico</p>
          <h1>Meus pedidos</h1>
          <p className="muted">Cada pedido mostra a saga etapa por etapa e qual serviço resolveu cada uma.</p>
        </div>
        <div className="segmented" role="tablist" aria-label="Filtrar pedidos">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
      </header>
      {orders.error ? <div className="alert">{orders.error}</div> : null}
      {orders.data && list.length === 0 ? (
        <Empty title={filter ? 'Nenhum pedido neste filtro' : 'Nenhum pedido ainda'}>Quando você fechar um pedido, ele aparece aqui com cada etapa.</Empty>
      ) : null}
      <div className="orders">
        {list.map((o) => (
          <OrderCard
            key={o.id}
            order={o}
            actions={
              <>
                {o.status === 'PENDING' || o.status === 'AWAITING_PAYMENT' ? (
                  <button className="btn ghost" onClick={() => void cancel(o)}>
                    Cancelar pedido
                  </button>
                ) : null}
                <button className="btn ghost" disabled={busy === o.id} onClick={() => void again(o)}>
                  <RotateCcw size={15} aria-hidden="true" /> Comprar de novo
                </button>
                <span className="muted small grow">Atualizado {dateTime(o.updatedAt)}</span>
              </>
            }
          />
        ))}
      </div>
    </section>
  );
};

