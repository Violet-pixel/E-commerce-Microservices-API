import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { errorMessage, login, register } from '../api';
import { Field } from '../components/ui';
import { LogoMark } from '../components/Logo';

const DEMO = [
  { label: 'Cliente', email: 'cliente@cesto.dev', what: 'compra, acompanha pedidos e recebe avisos' },
  { label: 'Administração', email: 'admin@cesto.dev', what: 'tudo isso, mais produtos, estoque e expedição' }
];

export const Login = ({ onDone }) => {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') await register(email, name, password);
      await login(email, password);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="login">
      <form className="login-card" onSubmit={submit}>
        <LogoMark size={44} />
        <h1>{mode === 'login' ? 'Entrar no Cesto' : 'Criar uma conta'}</h1>
        <p className="muted">{mode === 'login' ? 'Use uma das contas de demonstração ou a sua.' : 'Leva meio minuto. A conta nasce como cliente.'}</p>
        {error ? (
          <div className="alert" role="alert">
            {error}
          </div>
        ) : null}
        {mode === 'register' ? (
          <Field label="Nome">
            <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
        ) : null}
        <Field label="E-mail">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="voce@exemplo.com" />
        </Field>
        <Field label="Senha" hint={mode === 'register' ? 'Mínimo de 8 caracteres, com letras e números' : undefined}>
          <span className="password">
            <input
              required
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? 'Esconder senha' : 'Mostrar senha'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </Field>
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar e entrar'}
        </button>
        <button type="button" className="link" onClick={() => (setMode(mode === 'login' ? 'register' : 'login'), setError(null))}>
          {mode === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tenho conta'}
        </button>
      </form>

      <aside className="login-side">
        {mode === 'login' ? (
          <div className="demo">
            <h2>Contas de demonstração</h2>
            <p className="muted small">
              Senha das duas: <code>Cesto@2026</code>. Um clique preenche o formulário.
            </p>
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                className={email === d.email ? 'demo-account active' : 'demo-account'}
                onClick={() => {
                  setEmail(d.email);
                  setPassword('Cesto@2026');
                }}
              >
                <strong>{d.label}</strong>
                <code>{d.email}</code>
                <span>{d.what}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="how">
          <h2>O que acontece ao entrar</h2>
          <ol>
            <li>
              <span>
                O navegador cria um <em>code verifier</em> e manda só o hash dele (PKCE) para <code>/oauth/authorize</code>.
              </span>
            </li>
            <li>
              <span>
                O serviço <code>auth</code> confere a senha e devolve um código de uso único.
              </span>
            </li>
            <li>
              <span>O código e o verifier viram um JWT RS256 de 15 minutos e um refresh token que muda a cada uso.</span>
            </li>
          </ol>
        </div>
      </aside>
    </section>
  );
};
