import { createRemoteJWKSet, jwtVerify } from 'jose';
import { TokenClaims } from '@cesto/contracts';
import { ForbiddenError, UnauthenticatedError } from './errors.js';

export const createVerifier = (options) => {
  const keys = options.keySource ?? createRemoteJWKSet(new URL(options.jwksUrl), { cooldownDuration: 10_000, cacheMaxAge: 600_000 });
  return {
    async verify(token) {
      let payload;
      try {
        ({ payload } = await jwtVerify(token, keys, { issuer: options.issuer, audience: options.audience, algorithms: ['RS256'] }));
      } catch {
        throw new UnauthenticatedError('Token inválido ou expirado');
      }
      const claims = TokenClaims.safeParse(payload);
      if (!claims.success) throw new UnauthenticatedError('Token com formato inválido');
      const scopes = new Set(claims.data.scope.split(' ').filter(Boolean));
      if (claims.data.role) {
        return {
          kind: 'user',
          id: claims.data.sub,
          role: claims.data.role,
          scopes,
          clientId: claims.data.client_id,
          name: claims.data.name,
          email: claims.data.email
        };
      }
      return { kind: 'service', id: claims.data.sub, scopes, clientId: claims.data.client_id };
    }
  };
};

export const bearer = (header) => {
  if (!header) return null;
  const [type, value] = header.split(' ');
  return type?.toLowerCase() === 'bearer' && value ? value : null;
};

export const enforce = (endpoint, principal) => {
  if (endpoint.auth === 'public') return;
  if (!principal) throw new UnauthenticatedError();
  if (endpoint.auth === 'service' && principal.kind !== 'service') throw new ForbiddenError('Rota exclusiva para serviços');
  if (endpoint.auth === 'user' && principal.kind !== 'user') throw new ForbiddenError('Rota exclusiva para usuários');
  if (endpoint.auth === 'admin' && (principal.kind !== 'user' || principal.role !== 'ADMIN')) throw new ForbiddenError('Rota exclusiva para administradores');
  const missing = (endpoint.scopes ?? []).filter((scope) => !principal.scopes.has(scope));
  if (missing.length > 0) throw new ForbiddenError('Escopo insuficiente', { missing });
};

export const isAdmin = (principal) => principal?.kind === 'user' && principal.role === 'ADMIN';
