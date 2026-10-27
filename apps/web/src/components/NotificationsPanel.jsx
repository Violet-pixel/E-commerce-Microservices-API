import { CheckCheck, X } from 'lucide-react';
import { api, request } from '../api';
import { useAsync } from '../hooks';
import { dateTime } from '../format';
import { Empty } from './ui';

const TONE = {
  ORDER_CONFIRMED: 'good',
  ORDER_SHIPPED: 'good',
  ORDER_DELIVERED: 'good',
  ORDER_CANCELLED: 'bad',
  PAYMENT_DECLINED: 'bad'
};

export const NotificationsPanel = ({ onClose, onRead }) => {
  const list = useAsync(() => request(api.notifications.list, { query: { pageSize: 30 } }), []);
  const unread = list.data?.items.filter((n) => !n.readAt).length ?? 0;
  const readAll = async () => {
    await request(api.notifications.markAll, { body: {} });
    await list.reload(true);
    onRead();
  };
  const readOne = async (n) => {
    if (n.readAt) return;
    await request(api.notifications.markRead, { params: { id: n.id }, body: {} }).catch(() => null);
    await list.reload(true);
    onRead();
  };
  return (
    <aside className="panel" aria-label="Notificações">
      <header>
        <h2>Avisos</h2>
        {unread ? (
          <button className="link small" onClick={() => void readAll()}>
            <CheckCheck size={14} aria-hidden="true" /> Marcar {unread} como lidas
          </button>
        ) : null}
        <button className="icon-btn" onClick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>
      </header>
      {list.data?.items.length === 0 ? <Empty title="Nada por aqui">Os eventos dos seus pedidos viram avisos nesta lista.</Empty> : null}
      <ul className="notes">
        {list.data?.items.map((n) => (
          <li key={n.id} className={`${n.readAt ? '' : 'unread'} tone-${TONE[n.kind] ?? 'neutral'}`}>
            <button onClick={() => void readOne(n)}>
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              <time>{dateTime(n.createdAt)}</time>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
};
