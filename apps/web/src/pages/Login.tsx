import { useState } from 'react';
import { errorMessage, login, register } from '../api';
import { Field } from '../components/ui';
import { LogoMark } from '../components/Logo';

export const Login = ({ onDone }: { onDone: () => void }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('cliente@cesto.dev');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('Cesto@2026');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') await register(email, name, password);
      await login(email, password);
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="login">
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <LogoMark size={56} />
        <h1>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h1>
        <p className="muted">OAuth2 com Authorization Code + PKCE, tokens JWT RS256 e refresh token com rotação.</p>
        {error ? <div className="alert">{error}</div> : null}
        {mode === 'register' ? (
          <Field label="Nome">
            <input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </Field>
        ) : null}
        <Field label="E-mail">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Senha" hint={mode === 'register' ? 'Mínimo de 8 caracteres, com letras e números' : undefined}>
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </Field>
        <button className="btn primary block" disabled={busy}>
          {busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar e entrar'}
        </button>
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tenho conta'}
        </button>
        {mode === 'login' ? (
          <div className="demo">
            <span>Contas de demonstração (senha Cesto@2026)</span>
            <div className="row">
              <button type="button" className="chip" onClick={() => setEmail('cliente@cesto.dev')}>
                Cliente
              </button>
              <button type="button" className="chip" onClick={() => setEmail('admin@cesto.dev')}>
                Administrador
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </section>
  );
};
