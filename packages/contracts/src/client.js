import { envelope } from './dto.js';
import { buildPath, buildQuery } from './endpoint.js';

export class ApiCallError extends Error {
  constructor(status, code, message, details, requestId) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.name = 'ApiCallError';
  }

  static from(status, body) {
    return new ApiCallError(status, body.code, body.message, body.details, body.requestId);
  }
}

export const callEndpoint = async (endpoint, request, options) => {
  const req = request;
  const url = `${options.baseUrl.replace(/\/$/, '')}${buildPath(endpoint.path, req.params)}${buildQuery(req.query)}`;
  const headers = { accept: 'application/json', ...options.headers };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const hasBody = endpoint.method !== 'GET' && endpoint.method !== 'DELETE';
  if (hasBody) headers['content-type'] = 'application/json';
  const signal = options.signal ?? (options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined);
  const doFetch = options.fetch ?? fetch;
  let response;
  try {
    response = await doFetch(url, {
      method: endpoint.method,
      headers,
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      signal
    });
  } catch (cause) {
    throw new ApiCallError(503, 'UPSTREAM_UNAVAILABLE', `Falha ao chamar ${endpoint.method} ${endpoint.path}: ${cause.message}`);
  }
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (endpoint.raw) {
    if (!response.ok) {
      const body = json ?? {};
      throw new ApiCallError(response.status, 'INVALID_GRANT', body.error_description ?? body.error ?? response.statusText);
    }
    return endpoint.response.parse(json);
  }
  const parsed = envelope(endpoint.response).safeParse(json);
  if (!parsed.success) {
    throw new ApiCallError(response.status || 502, 'UPSTREAM_UNAVAILABLE', `Resposta inválida de ${endpoint.path}`, parsed.error.issues);
  }
  const body = parsed.data;
  if (!body.ok) throw ApiCallError.from(response.status, body.error);
  return body.data;
};
