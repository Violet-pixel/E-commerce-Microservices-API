import { z } from 'zod';

/**
 * Declara um endpoint da API. É a fonte única de verdade para validação no servidor,
 * documentação OpenAPI e chamadas tipadas pelo cliente.
 *
 * @typedef {'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'} HttpMethod
 * @typedef {object} EndpointSpec
 * @property {HttpMethod} method
 * @property {string} path caminho com parâmetros no formato `:nome`
 * @property {string} summary
 * @property {readonly string[]} tags
 * @property {'public' | 'user' | 'admin' | 'service'} auth
 * @property {readonly string[]} [scopes]
 * @property {import('zod').ZodType} [params]
 * @property {import('zod').ZodType} [query]
 * @property {import('zod').ZodType} [body]
 * @property {import('zod').ZodType} response
 * @property {number} [status]
 * @property {boolean} [raw] resposta enviada sem o envelope `{ ok, data }`
 */

/**
 * @template {EndpointSpec} E
 * @param {E} spec
 * @returns {E}
 */
export const defineEndpoint = (spec) => spec;

export const buildPath = (path, params) =>
  path.replace(/:([A-Za-z0-9_]+)/g, (_, name) => {
    const value = params?.[name];
    if (value === undefined || value === null) throw new Error(`Missing path parameter "${name}" for ${path}`);
    return encodeURIComponent(String(value));
  });

export const buildQuery = (query) => {
  if (!query) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)));
    else search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
};
