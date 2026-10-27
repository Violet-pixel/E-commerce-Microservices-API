import { SCOPES } from '@cesto/contracts';
import { hashSecret } from './crypto.js';

export const DEMO_USERS = [
  { id: '0b7c4f3e-1a52-4c1e-9d4b-6a0f1e2d3c01', email: 'admin@cesto.dev', name: 'Administração Cesto', role: 'ADMIN' },
  { id: '0b7c4f3e-1a52-4c1e-9d4b-6a0f1e2d3c02', email: 'cliente@cesto.dev', name: 'Cliente Demonstração', role: 'CUSTOMER' }
];

export const seed = async (db, env) => {
  const userScopes = SCOPES.filter((s) => s !== 'internal');
  await db.oAuthClient.upsert({
    where: { id: 'cesto-web' },
    update: { redirectUris: env.WEB_REDIRECT_URIS.split(',').map((s) => s.trim()), scopes: [...userScopes] },
    create: {
      id: 'cesto-web',
      name: 'Interface web',
      secretHash: null,
      redirectUris: env.WEB_REDIRECT_URIS.split(',').map((s) => s.trim()),
      grantTypes: ['authorization_code', 'refresh_token'],
      scopes: [...userScopes]
    }
  });
  const secretHash = await hashSecret(env.SERVICE_CLIENT_SECRET);
  await db.oAuthClient.upsert({
    where: { id: env.SERVICE_CLIENT_ID },
    update: { secretHash },
    create: { id: env.SERVICE_CLIENT_ID, name: 'Comunicação entre serviços', secretHash, redirectUris: [], grantTypes: ['client_credentials'], scopes: ['internal'] }
  });
  if (!env.SEED_DEMO) return;
  if ((await db.user.count()) > 0) return;
  const passwordHash = await hashSecret(env.DEMO_PASSWORD);
  await db.user.createMany({ data: DEMO_USERS.map((u) => ({ ...u, passwordHash })) });
};
