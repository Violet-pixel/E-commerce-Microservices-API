import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useInterval } from '../hooks';

// Os nomes batem com as checagens que o gateway faz em /health (um GET em /health de cada serviço, com 2 s de limite).
const SERVICES = [
  { name: 'gateway', port: 8000, role: 'Porta única da API: roteamento, rate limit, request-id e Swagger' },
  { name: 'auth', port: 4001, role: 'Contas, OAuth2 com PKCE, JWT RS256 e JWKS' },
  { name: 'catalog', port: 4002, role: 'Produtos, seções, busca e paginação' },
  { name: 'inventory', port: 4003, role: 'Saldo, reservas por pedido e devolução' },
  { name: 'cart', port: 4004, role: 'Carrinho no Redis com preço relido do catálogo' },
  { name: 'orders', port: 4005, role: 'Checkout, máquina de estados e saga' },
  { name: 'payments', port: 4006, role: 'Cobrança simulada e estorno' },
  { name: 'notifications', port: 4007, role: 'Avisos gerados a partir dos eventos' },
  { name: 'redis', port: 6379, role: 'Streams de eventos, carrinho e rate limit' }
];

export const Services = () => {
  const [state, setState] = useState({ checks: null, ms: null, at: null, error: null, history: [] });
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setBusy(true);
    const started = performance.now();
    try {
      const res = await fetch('/health', { cache: 'no-store' });
      const body = await res.json();
      const ms = Math.round(performance.now() - started);
      setState((s) => ({ checks: { gateway: true, ...body.checks }, ms, at: new Date(), error: null, history: [...s.history, { ms, ok: res.ok }].slice(-30) }));
    } catch (e) {
      setState((s) => ({ ...s, checks: null, at: new Date(), error: 'O gateway não respondeu', history: [...s.history, { ms: 0, ok: false }].slice(-30) }));
    } finally {
      setBusy(false);
    }
  };

  useInterval(() => void check(), 5000);
  useEffect(() => {
    void check();
  }, []);

  const up = state.checks ? SERVICES.filter((s) => state.checks[s.name]).length : 0;
  const max = Math.max(50, ...state.history.map((h) => h.ms));

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Bastidores</p>
          <h1>Saúde dos serviços</h1>
          <p className="muted">
            Lido de <code>/health</code> no gateway a cada 5 segundos. Um serviço fora do ar aparece aqui antes de alguém reclamar.
          </p>
        </div>
        <button className="btn ghost" onClick={() => void check()} disabled={busy}>
          <RefreshCw size={15} aria-hidden="true" className={busy ? 'spin' : ''} /> Verificar agora
        </button>
      </header>

      <div className={state.error || (state.checks && up < SERVICES.length) ? 'health-summary bad' : 'health-summary'} aria-live="polite">
        <strong>{state.error ? state.error : state.checks ? (up === SERVICES.length ? 'Tudo respondendo' : `${SERVICES.length - up} com problema`) : 'Verificando…'}</strong>
        <span>
          {state.checks ? `${up} de ${SERVICES.length} ok` : ''}
          {state.ms !== null ? ` · ${state.ms} ms no gateway` : ''}
          {state.at ? ` · ${state.at.toLocaleTimeString('pt-BR')}` : ''}
        </span>
        <div className="spark" aria-label="Tempo de resposta das últimas verificações">
          {state.history.map((h, i) => (
            <span key={i} className={h.ok ? '' : 'bad'} style={{ height: `${Math.max(8, (h.ms / max) * 100)}%` }} title={`${h.ms} ms`} />
          ))}
        </div>
      </div>

      <ul className="services">
        {SERVICES.map((s) => {
          const ok = state.checks ? Boolean(state.checks[s.name]) : null;
          return (
            <li key={s.name} className={ok === null ? 'unknown' : ok ? 'ok' : 'down'}>
              <span className="led" aria-hidden="true" />
              <div>
                <strong>
                  <code>{s.name}</code>
                </strong>
                <p>{s.role}</p>
              </div>
              <span className="svc-state">{ok === null ? '—' : ok ? 'no ar' : 'fora'}</span>
              <code className="svc-port">:{s.port}</code>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
