import { ApiCallError, api, callEndpoint } from '@cesto/contracts';

const STORAGE_KEY = 'cesto.session';
const CLIENT_ID = 'cesto-web';

const listeners = new Set();

const read = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

let session = read();

const save = (next) => {
  session = next;
  try {
    if (next) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
  listeners.forEach((l) => l(next));
};

export const onSession = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const currentSession = () => session;

const fromToken = (t) => ({
  accessToken: t.access_token,
  refreshToken: t.refresh_token ?? '',
  expiresAt: Date.now() + t.expires_in * 1000,
  scope: t.scope
});

const redirectUri = () => `${window.location.origin}/callback`;

const randomString = (bytes) => {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const challengeFor = async (verifier) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const login = async (email, password) => {
  const verifier = randomString(48);
  const state = randomString(12);
  const authorized = await callEndpoint(
    api.auth.authorize,
    {
      body: {
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: redirectUri(),
        code_challenge: await challengeFor(verifier),
        code_challenge_method: 'S256',
        state,
        email,
        password
      }
    },
    { baseUrl: '' }
  );
  if (authorized.state !== state) throw new Error('Resposta de autorização inválida');
  const token = await callEndpoint(
    api.auth.token,
    {
      body: {
        grant_type: 'authorization_code',
        code: authorized.code,
        redirect_uri: redirectUri(),
        client_id: CLIENT_ID,
        code_verifier: verifier
      }
    },
    { baseUrl: '' }
  );
  save(fromToken(token));
};

export const register = (email, name, password) => callEndpoint(api.auth.register, { body: { email, name, password } }, { baseUrl: '' });

let refreshing = null;

const refresh = async () => {
  const current = session;
  if (!current?.refreshToken) return null;
  refreshing ??= callEndpoint(
    api.auth.token,
    { body: { grant_type: 'refresh_token', refresh_token: current.refreshToken, client_id: CLIENT_ID } },
    { baseUrl: '' }
  )
    .then((t) => {
      const next = fromToken(t);
      save(next);
      return next;
    })
    .catch(() => {
      save(null);
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

export const logout = async () => {
  const current = session;
  save(null);
  if (current?.refreshToken) {
    await callEndpoint(api.auth.revoke, { body: { token: current.refreshToken, client_id: CLIENT_ID } }, { baseUrl: '' }).catch(() => null);
  }
};

export const request = async (endpoint, req) => {
  let active = session;
  if (active && active.expiresAt - 15_000 < Date.now()) active = await refresh();
  try {
    return await callEndpoint(endpoint, req, { baseUrl: '', token: active?.accessToken });
  } catch (error) {
    if (error instanceof ApiCallError && error.status === 401 && active) {
      const renewed = await refresh();
      if (renewed) return callEndpoint(endpoint, req, { baseUrl: '', token: renewed.accessToken });
    }
    throw error;
  }
};

export const errorMessage = (error) => {
  if (error instanceof ApiCallError) {
    const details = Array.isArray(error.details) ? error.details : [];
    const first = details.find((d) => d.message);
    return first ? `${error.message}: ${first.path ? `${first.path} ` : ''}${first.message}` : error.message;
  }
  return error instanceof Error ? error.message : 'Algo deu errado';
};

export { api };
