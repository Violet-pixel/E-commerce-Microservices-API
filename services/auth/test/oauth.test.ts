import { describe, expect, it } from 'vitest';
import { hashSecret, pkceChallenge, verifyPkce, verifySecret } from '../src/crypto.js';
import { grantScopes, narrowScopes } from '../src/scopes.js';

describe('segredos', () => {
  it('gera hash com sal e confere', async () => {
    const a = await hashSecret('Cesto@2026');
    const b = await hashSecret('Cesto@2026');
    expect(a).not.toBe(b);
    expect(await verifySecret('Cesto@2026', a)).toBe(true);
    expect(await verifySecret('errada', a)).toBe(false);
    expect(await verifySecret('x', 'formato-invalido')).toBe(false);
  });
});

describe('PKCE S256', () => {
  it('confere o verificador do RFC 7636', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(pkceChallenge(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(verifyPkce(verifier, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')).toBe(true);
    expect(verifyPkce(`${verifier}x`, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')).toBe(false);
  });
});

describe('escopos', () => {
  const client = ['orders:read', 'orders:write', 'catalog:write'];
  it('limita ao papel do usuário', () => {
    expect(grantScopes(undefined, client, ['orders:read', 'orders:write'])).toBe('orders:read orders:write');
    expect(grantScopes('orders:read catalog:write', client, ['orders:read'])).toBe('orders:read');
  });
  it('recusa escopo fora do cliente', () => {
    expect(() => grantScopes('internal', client)).toThrow(expect.objectContaining({ code: 'INVALID_SCOPE' }));
  });
  it('só reduz escopos no refresh', () => {
    expect(narrowScopes('orders:read', 'orders:read orders:write')).toBe('orders:read');
    expect(() => narrowScopes('catalog:write', 'orders:read')).toThrow();
  });
});
