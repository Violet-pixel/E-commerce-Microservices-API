import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from 'jose';
import { api } from '@cesto/contracts';
import { BaseEnv, NotFoundError, createService, createVerifier, route } from '../src/index.js';

let app;
let sign;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  sign = (claims, sub) =>
    new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer('cesto-auth').setAudience('cesto-api').setSubject(sub).setExpirationTime('5m').sign(privateKey);
  const env = BaseEnv.parse({ PORT: '3999', LOG_LEVEL: 'silent' });
  app = await createService({
    name: 'teste',
    env,
    verifier: createVerifier({ jwksUrl: 'local', issuer: 'cesto-auth', audience: 'cesto-api', keySource: createLocalJWKSet({ keys: [jwk] }) })
  });
  route(app, api.catalog.listProducts, ({ query }) => ({ items: [], page: query.page, pageSize: query.pageSize, total: 0, totalPages: 1 }));
  route(app, api.catalog.getProduct, ({ params }) => {
    throw new NotFoundError('Produto', params.id);
  });
  route(app, api.catalog.createProduct, ({ body }) => ({
    id: '7a2e9b10-0000-4b00-9000-000000000099',
    ...body,
    category: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  await app.ready();
});

afterAll(() => app?.close());

const product = { sku: 'TST-01', name: 'Teste', slug: 'teste', priceCents: 1000 };

describe('rotas tipadas', () => {
  it('converte a query e envelopa a resposta', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/catalog/products?page=3&pageSize=5' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, data: { items: [], page: 3, pageSize: 5, total: 0, totalPages: 1 } });
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('responde 422 para entrada inválida', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/catalog/products?pageSize=0' });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('VALIDATION_FAILED');
  });

  it('mapeia erro de domínio para HTTP', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/catalog/products/7a2e9b10-0000-4b00-9000-000000000001' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  it('exige token, papel e escopo', async () => {
    const anonymous = await app.inject({ method: 'POST', url: '/api/v1/catalog/products', payload: product });
    expect(anonymous.statusCode).toBe(401);
    const customer = await sign({ scope: 'orders:read', client_id: 'web', role: 'CUSTOMER' }, 'u1');
    expect((await app.inject({ method: 'POST', url: '/api/v1/catalog/products', payload: product, headers: { authorization: `Bearer ${customer}` } })).statusCode).toBe(403);
    const noScope = await sign({ scope: 'orders:read', client_id: 'web', role: 'ADMIN' }, 'u2');
    const res = await app.inject({ method: 'POST', url: '/api/v1/catalog/products', payload: product, headers: { authorization: `Bearer ${noScope}` } });
    expect(res.json().error).toMatchObject({ code: 'FORBIDDEN', details: { missing: ['catalog:write'] } });
    const admin = await sign({ scope: 'catalog:write', client_id: 'web', role: 'ADMIN' }, 'u3');
    const created = await app.inject({ method: 'POST', url: '/api/v1/catalog/products', payload: product, headers: { authorization: `Bearer ${admin}` } });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({ sku: 'TST-01', currency: 'BRL', active: true });
  });

  it('recusa token adulterado', async () => {
    const token = await sign({ scope: 'catalog:write', client_id: 'web', role: 'ADMIN' }, 'u3');
    const tampered = `${token.slice(0, -4)}abcd`;
    const res = await app.inject({ method: 'POST', url: '/api/v1/catalog/products', payload: product, headers: { authorization: `Bearer ${tampered}` } });
    expect(res.statusCode).toBe(401);
  });

  it('expõe a saúde do serviço', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.json()).toEqual({ status: 'ok', service: 'teste', checks: {} });
  });
});
