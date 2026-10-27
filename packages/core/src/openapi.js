import { z } from 'zod';
import { envelope } from '@cesto/contracts';

const toJson = (schema, io) => z.toJSONSchema(schema, { io, unrepresentable: 'any', target: 'openapi-3.0' });

const parameters = (schema, location) => {
  if (!schema) return [];
  const json = toJson(schema, 'input');
  return Object.entries(json.properties ?? {}).map(([name, property]) => ({
    name,
    in: location,
    required: location === 'path' || (json.required ?? []).includes(name),
    schema: property
  }));
};

export const buildOpenApi = (registry, info, options = {}) => {
  const paths = {};
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
