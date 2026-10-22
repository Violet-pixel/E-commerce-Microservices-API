import { ADMIN_SCOPES, CUSTOMER_SCOPES } from '@cesto/contracts';
import type { Role } from '@cesto/contracts';
import { OAuthError } from '@cesto/core';

export const parseScope = (scope: string | undefined): string[] => (scope ?? '').split(' ').map((s) => s.trim()).filter(Boolean);

export const allowedForRole = (role: Role): readonly string[] => (role === 'ADMIN' ? ADMIN_SCOPES : CUSTOMER_SCOPES);

export const grantScopes = (requested: string | undefined, clientScopes: readonly string[], roleScopes?: readonly string[]): string => {
  const allowed = clientScopes.filter((s) => !roleScopes || roleScopes.includes(s));
  const wanted = parseScope(requested);
  if (wanted.length === 0) return allowed.join(' ');
  const invalid = wanted.filter((s) => !clientScopes.includes(s));
  if (invalid.length) throw new OAuthError('INVALID_SCOPE', `Escopos não permitidos: ${invalid.join(', ')}`);
  return wanted.filter((s) => allowed.includes(s)).join(' ');
};

export const narrowScopes = (requested: string | undefined, original: string): string => {
  const wanted = parseScope(requested);
  if (wanted.length === 0) return original;
  const current = parseScope(original);
  const invalid = wanted.filter((s) => !current.includes(s));
  if (invalid.length) throw new OAuthError('INVALID_SCOPE', `O refresh token não cobre: ${invalid.join(', ')}`);
  return wanted.join(' ');
};
