import { useEffect, useState } from 'react';
import { Bell, LogIn, LogOut, ShoppingBasket } from 'lucide-react';
import type { CartDto } from '@cesto/contracts';
import { api, currentSession, errorMessage, logout, onSession, request } from './api';
import type { Session } from './api';
import { decodeClaims } from './format';
import { useInterval } from './hooks';
import { LogoMark } from './components/Logo';
import { CartPanel } from './components/CartPanel';
import { NotificationsPanel } from './components/NotificationsPanel';
import { Store } from './pages/Store';
import { Orders } from './pages/Orders';
import { Admin } from './pages/Admin';
import { Login } from './pages/Login';

type View = 'store' | 'orders' | 'admin' | 'login';

const initialView = (): View => {
  const hash = window.location.hash.replace('#', '');
  return ['store', 'orders', 'admin', 'login'].includes(hash) ? (hash as View) : 'store';
};

export const App = () => {
  const [session, setSession] = useState<Session | null>(currentSession());
  const [view, setView] = useState<View>(initialView);
  const [cart, setCart] = useState<CartDto | null>(null);
  const [panel, setPanel] = useState<'cart' | 'notes' | null>(null);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const claims = session ? decodeClaims(session.accessToken) : null;
  const admin = claims?.role === 'ADMIN';

  useEffect(() => onSession(setSession), []);
  useEffect(() => {
    window.location.hash = view;
  }, [view]);
  useEffect(() => {
    if (window.location.pathname === '/callback') window.history.replaceState(null, '', '/');
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 3200);
  };

  const refreshCart = async () => {
    if (!currentSession()) return setCart(null);
    try {
      setCart(await request(api.cart.get, {}));
    } catch {
      setCart(null);
    }
  };

  const refreshUnread = async () => {
    if (!currentSession()) return setUnread(0);
    try {
      setUnread((await request(api.notifications.unread, {})).unread);
    } catch {
      setUnread(0);
    }
  };

  useEffect(() => {
    void refreshCart();
    void refreshUnread();
    if (!session && (view === 'orders' || view === 'admin')) setView('login');
  }, [session?.accessToken]);

  useInterval(() => void refreshUnread(), session ? 5000 : null);

  const add = async (productId: string) => {
    if (!currentSession()) {
      notify('Entre para montar seu carrinho');
      setView('login');
      return;
    }
    try {
      setCart(await request(api.cart.add, { body: { productId, quantity: 1 } }));
      notify('Adicionado ao carrinho');
    } catch (e) {
      notify(errorMessage(e));
    }
  };

  const go = (next: View) => {
    setPanel(null);
    setView(next);
  };

  return (
    <div className="app">
      <header className="top">
        <button className="brand" onClick={() => go('store')}>
          <LogoMark size={34} />
          <span>Cesto</span>
        </button>
        <nav>
          <button className={view === 'store' ? 'active' : ''} onClick={() => go('store')}>
            Loja
          </button>
          {session ? (
            <button className={view === 'orders' ? 'active' : ''} onClick={() => go('orders')}>
              Pedidos
            </button>
          ) : null}
          {admin ? (
            <button className={view === 'admin' ? 'active' : ''} onClick={() => go('admin')}>
              Administração
            </button>
          ) : null}
        </nav>
        <div className="top-actions">
          {session ? (
            <>
              <button className="btn ghost icon-only badge-wrap" onClick={() => setPanel(panel === 'notes' ? null : 'notes')} aria-label="Notificações">
                <Bell size={19} />
                {unread ? <span className="badge">{unread}</span> : null}
              </button>
              <button className="btn ghost icon-only badge-wrap" onClick={() => setPanel(panel === 'cart' ? null : 'cart')} aria-label="Carrinho">
                <ShoppingBasket size={19} />
                {cart?.itemCount ? <span className="badge">{cart.itemCount}</span> : null}
              </button>
              <span className="who">{claims?.name}</span>
              <button className="btn ghost icon-only" onClick={() => void logout().then(() => go('store'))} aria-label="Sair">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button className="btn primary icon" onClick={() => go('login')}>
              <LogIn size={18} />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </header>

      <main>
        {view === 'store' ? <Store onAdd={add} canBuy={Boolean(session)} /> : null}
        {view === 'orders' && session ? <Orders notify={notify} /> : null}
        {view === 'admin' && admin ? <Admin notify={notify} /> : null}
        {view === 'login' ? <Login onDone={() => go('store')} /> : null}
      </main>

      {panel ? <div className="scrim" onClick={() => setPanel(null)} /> : null}
      {panel === 'cart' ? (
        <CartPanel
          cart={cart}
          onChange={setCart}
          onClose={() => setPanel(null)}
          onOrdered={(order) => {
            notify(`Pedido #${order.number} recebido`);
            setCart(null);
            go('orders');
            window.setTimeout(() => void refreshCart(), 1500);
          }}
        />
      ) : null}
      {panel === 'notes' ? <NotificationsPanel onClose={() => setPanel(null)} onRead={() => setUnread(0)} /> : null}
      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
      <footer className="foot">
        <span>
          <strong>Cesto 1.1.0</strong>, loja de demonstração da API de e-commerce com microsserviços
        </span>
        <a href="/api/docs" target="_blank" rel="noreferrer">
          Documentação da API
        </a>
      </footer>
    </div>
  );
};
