import { X } from 'lucide-react';
import { api, request } from '../api';
import { useAsync } from '../hooks';
import { dateTime } from '../format';
import { Empty } from './ui';

export const NotificationsPanel = ({ onClose, onRead }: { onClose: () => void; onRead: () => void }) => {
  const list = useAsync(() => request(api.notifications.list, { query: { pageSize: 30 } }), []);
  const readAll = async () => {
    await request(api.notifications.markAll, { body: {} });
    await list.reload(true);
    onRead();
  };
  return (
    <aside className="panel" aria-label="Notificações">
      <header>
        <h2>Notificações</h2>
        <div className="row">
          <button className="link" onClick={() => void readAll()}>
            Marcar todas como lidas
          </button>
          <button className="btn ghost icon-only" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
      </header>
      {list.data?.items.length === 0 ? <Empty title="Nada por aqui">Os eventos dos seus pedidos aparecem nesta lista.</Empty> : null}
      <ul className="notes">
        {list.data?.items.map((n) => (
          <li key={n.id} className={n.readAt ? '' : 'unread'}>
            <strong>{n.title}</strong>
            <p>{n.body}</p>
            <time>{dateTime(n.createdAt)}</time>
          </li>
        ))}
      </ul>
    </aside>
  );
};
