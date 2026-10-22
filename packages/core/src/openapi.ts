import { z } from 'zod';
import { envelope } from '@cesto/contracts';
import type { AnyEndpoint } from '@cesto/contracts';

type Registry = Record<string, Record<string, AnyEndpoint>>;

const toJson = (schema: z.ZodType, io: 'input' | 'output') => z.toJSONSchema(schema, { io, unrepresentable: 'any', target: 'openapi-3.0' });

const parameters = (schema: z.ZodType | undefined, location: 'path' | 'query') => {
  if (!schema) return [];
  const json = toJson(schema, 'input') as { properties?: Record<string, unknown>; required?: string[] };
  return Object.entries(json.properties ?? {}).map(([name, property]) => ({
    name,
    in: location,
    required: location === 'path' || (json.required ?? []).includes(name),
    schema: property
  }));
};

export const buildOpenApi = (registry: Registry, info: { title: string; version: string; description?: string }, options: { includeInternal?: boolean } = {}) => {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [group, endpoints] of Object.entries(registry)) {
    for (const [name, endpoint] of Object.entries(endpoints)) {
      if (endpoint.auth === 'service' && !options.includeInternal) continue;
      const path = endpoint.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
      const status = String(endpoint.status ?? 200);
      const responseSchema = endpoint.raw ? endpoint.response : envelope(endpoint.response);
      paths[path] ??= {};
      paths[path][endpoint.method.toLowerCase()] = {
        operationId: `${group}.${name}`,
        summary: endpoint.summary,
        tags: endpoint.tags,
        security: endpoint.auth === 'public' ? [] : [{ oauth2: [...(endpoint.scopes ?? [])] }],
        parameters: [...parameters(endpoint.params, 'path'), ...parameters(endpoint.query, 'query')],
        ...(endpoint.body
          ? { requestBody: { required: true, content: { 'application/json': { schema: toJson(endpoint.body, 'input') } } } }
          : {}),
        responses: {
          [status]: { description: 'Sucesso', content: { 'application/json': { schema: toJson(responseSchema, 'output') } } },
          default: { description: 'Erro de domínio no envelope { ok: false, error }' }
        }
      };
    }
  }
  return {
    openapi: '3.0.3',
    info,
    servers: [{ url: '/' }],
    components: {
      securitySchemes: {
        oauth2: {
          type: 'oauth2',
          flows: {
            authorizationCode: { authorizationUrl: '/oauth/authorize', tokenUrl: '/oauth/token', scopes: {} },
            clientCredentials: { tokenUrl: '/oauth/token', scopes: {} }
          }
        }
      }
    },
    paths
  };
};
