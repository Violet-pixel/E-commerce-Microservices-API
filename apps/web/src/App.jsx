import { useEffect, useState } from 'react';
import { Activity, Bell, LogIn, LogOut, Moon, ShoppingBasket, Sun } from 'lucide-react';
import { api, currentSession, errorMessage, logout, onSession, request } from './api';
import { decodeClaims } from './format';
import { useInterval, useKey, useStored } from './hooks';
import { LogoMark } from './components/Logo';
import { CartPanel } from './components/CartPanel';
import { NotificationsPanel } from './components/NotificationsPanel';
import { ProductSheet } from './components/ProductSheet';
import { Store } from './pages/Store';
import { Saved } from './pages/Saved';
import { Orders } from './pages/Orders';
import { Admin } from './pages/Admin';
import { Login } from './pages/Login';
import { Services } from './pages/Services';

const VIEWS = ['store', 'saved', 'orders', 'admin', 'services', 'login'];

const initialView = () => {
  const hash = window.location.hash.replace('#', '');
  return VIEWS.includes(hash) ? hash : 'store';
};

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

export const App = () => {
  const [session, setSession] = useState(currentSession());
  const [view, setView] = useState(initialView);
  const [cart, setCart] = useState(null);
  const [panel, setPanel] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useStored('cesto.tema', null);
  const claims = session ? decodeClaims(session.accessToken) : null;
  const admin = claims?.role === 'ADMIN';
  const [saved, setSaved] = useStored(`cesto.guardados.${claims?.sub ?? 'visitante'}`, []);
  const dark = theme ? theme === 'dark' : systemDark();

  useEffect(() => onSession(setSession), []);
  // Voltar e avançar do navegador trocam de seção.
  useEffect(() => {
    const onHash = () => {
      setPanel(null);
      setSheet(null);
      setView(initialView());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    window.location.hash = view;
    window.scrollTo({ top: 0 });
  }, [view]);
  useEffect(() => {
    if (window.location.pathname === '/callback') window.history.replaceState(null, '', '/');
  }, []);
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);

  useKey('Escape', () => {
    setPanel(null);
    setSheet(null);
  });

  const notify = (message, tone = 'neutral') => {
    setToast({ message, tone, at: Date.now() });
    window.setTimeout(() => setToast((current) => (current?.message === message ? null : current)), 3400);
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

  const add = async (productId, quantity = 1, name) => {
    if (!currentSession()) {
      notify('Entre na sua conta para montar o carrinho');
      setSheet(null);
      setView('login');
      return false;
    }
    try {
      setCart(await request(api.cart.add, { body: { productId, quantity } }));
      notify(name ? `${quantity > 1 ? `${quantity}× ` : ''}${name} no carrinho` : 'Adicionado ao carrinho', 'good');
      return true;
    } catch (e) {
      notify(errorMessage(e), 'bad');
      return false;
    }
  };

  const isSaved = (id) => saved.some((p) => p.id === id);
  const toggleSaved = (product) => {
    const present = isSaved(product.id);
    setSaved((list) =>
      present
        ? list.filter((p) => p.id !== product.id)
        : [
            {
              id: product.id,
              name: product.name,
              sku: product.sku,
              slug: product.slug,
              imageUrl: product.imageUrl ?? null,
              priceCents: product.priceCents,
              currency: product.currency ?? 'BRL',
              category: product.category ?? null,
              savedAt: new Date().toISOString()
            },
            ...list
          ]
    );
    notify(present ? 'Removido dos guardados' : 'Guardado para depois');
  };

  const go = (next) => {
    setPanel(null);
    setSheet(null);
    setView(next);
  };

  const nav = [
    { id: 'store', label: 'Loja', show: true },
    { id: 'saved', label: 'Guardados', show: true, count: saved.length },
    { id: 'orders', label: 'Pedidos', show: Boolean(session) },
    { id: 'admin', label: 'Administração', show: admin },
    { id: 'services', label: 'Serviços', show: true }
  ].filter((n) => n.show);

  return (
    <div className="app">
      <a className="skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="top">
        <button className="brand" onClick={() => go('store')} aria-label="Cesto, voltar para a loja">
          <LogoMark size={32} />
          <span>Cesto</span>
        </button>
        <nav aria-label="Seções">
          {nav.map((n) => (
            <button key={n.id} className={view === n.id ? 'active' : ''} aria-current={view === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
              {n.label}
              {n.count ? <span className="nav-count">{n.count}</span> : null}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button className="icon-btn" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'} title={dark ? 'Tema claro' : 'Tema escuro'}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {session ? (
            <>
              <button className="icon-btn" onClick={() => setPanel(panel === 'notes' ? null : 'notes')} aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`}>
                <Bell size={18} />
                {unread ? <span className="dot">{unread > 9 ? '9+' : unread}</span> : null}
              </button>
              <button className="basket-btn" onClick={() => setPanel(panel === 'cart' ? null : 'cart')} aria-label="Abrir carrinho">
                <ShoppingBasket size={18} />
                <span className="basket-count">{cart?.itemCount ?? 0}</span>
              </button>
              <div className="who" title={claims?.email}>
                <span className="avatar" aria-hidden="true">
                  {(claims?.name ?? '?').slice(0, 1).toUpperCase()}
                </span>
                <span className="who-name">{claims?.name?.split(' ')[0]}</span>
              </div>
              <button className="icon-btn" onClick={() => void logout().then(() => go('store'))} aria-label="Sair" title="Sair">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button className="btn primary" onClick={() => go('login')}>
              <LogIn size={17} aria-hidden="true" />
              Entrar
            </button>
          )}
        </div>
      </header>

      <main id="conteudo">
        {view === 'store' ? <Store onAdd={add} onOpen={setSheet} isSaved={isSaved} onToggleSaved={toggleSaved} /> : null}
        {view === 'saved' ? <Saved items={saved} onAdd={add} onOpen={setSheet} onToggleSaved={toggleSaved} onBrowse={() => go('store')} /> : null}
        {view === 'orders' && session ? <Orders notify={notify} onCartChanged={refreshCart} /> : null}
        {view === 'admin' && admin ? <Admin notify={notify} /> : null}
        {view === 'services' ? <Services /> : null}
        {view === 'login' ? <Login onDone={() => go('store')} /> : null}
      </main>

      {panel || sheet ? (
        <div
          className="scrim"
          onClick={() => {
            setPanel(null);
            setSheet(null);
          }}
        />
      ) : null}
      {sheet ? <ProductSheet product={sheet} onClose={() => setSheet(null)} onAdd={add} saved={isSaved(sheet.id)} onToggleSaved={toggleSaved} /> : null}
      {panel === 'cart' ? (
        <CartPanel
          cart={cart}
          onChange={setCart}
          onClose={() => setPanel(null)}
          onSaveForLater={async (item) => {
            toggleSaved({ id: item.productId, name: item.name, sku: item.sku, priceCents: item.unitPriceCents });
            try {
              setCart(await request(api.cart.update, { params: { productId: item.productId }, body: { quantity: 0 } }));
            } catch (e) {
              notify(errorMessage(e), 'bad');
            }
          }}
          onOrdered={(order) => {
            notify(`Pedido #${order.number} recebido. Acompanhe a reserva e o pagamento aqui.`, 'good');
            setCart(null);
            go('orders');
            window.setTimeout(() => void refreshCart(), 1500);
          }}
        />
      ) : null}
      {panel === 'notes' ? <NotificationsPanel onClose={() => setPanel(null)} onRead={() => void refreshUnread()} /> : null}
      {toast ? (
        <div className={`toast toast-${toast.tone}`} role="status" key={toast.at}>
          {toast.message}
        </div>
      ) : null}
      <footer className="foot">
        <div>
          <strong>Cesto 1.2.0</strong>
          <span>Loja de demonstração. Cada clique aqui passa pelo gateway e por um dos oito serviços.</span>
        </div>
        <div className="foot-links">
          <button className="link" onClick={() => go('services')}>
            <Activity size={14} aria-hidden="true" /> Saúde dos serviços
          </button>
          <a href="/api/docs" target="_blank" rel="noreferrer">
            Documentação da API
          </a>
          <span className="kbd-hint">
            <kbd>/</kbd> busca · <kbd>Esc</kbd> fecha
          </span>
        </div>
      </footer>
    </div>
  );
};

