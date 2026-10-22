import type { z } from 'zod';
import { envelope } from './dto.js';
import type { ApiErrorBody } from './dto.js';
import { buildPath, buildQuery } from './endpoint.js';
import type { AnyEndpoint, EndpointRequest, EndpointResponse } from './endpoint.js';
import type { ErrorCode } from './errors.js';

export class ApiCallError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'ApiCallError';
  }

  static from(status: number, body: ApiErrorBody): ApiCallError {
    return new ApiCallError(status, body.code, body.message, body.details, body.requestId);
  }
}

export interface CallOptions {
  baseUrl: string;
  token?: string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

type LooseRequest = { params?: Record<string, unknown>; query?: Record<string, unknown>; body?: unknown };

export const callEndpoint = async <E extends AnyEndpoint>(
  endpoint: E,
  request: EndpointRequest<E>,
  options: CallOptions
): Promise<EndpointResponse<E>> => {
  const req = request as LooseRequest;
  const url = `${options.baseUrl.replace(/\/$/, '')}${buildPath(endpoint.path, req.params)}${buildQuery(req.query)}`;
  const headers: Record<string, string> = { accept: 'application/json', ...options.headers };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const hasBody = endpoint.method !== 'GET' && endpoint.method !== 'DELETE';
  if (hasBody) headers['content-type'] = 'application/json';
  const signal = options.signal ?? (options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined);
  const doFetch = options.fetch ?? fetch;
  let response: Response;
  try {
    response = await doFetch(url, {
      method: endpoint.method,
      headers,
      body: hasBody ? JSON.stringify(req.body ?? {}) : undefined,
      signal
    });
  } catch (cause) {
    throw new ApiCallError(503, 'UPSTREAM_UNAVAILABLE', `Falha ao chamar ${endpoint.method} ${endpoint.path}: ${(cause as Error).message}`);
  }
  const text = await response.text();
  const json: unknown = text ? JSON.parse(text) : null;
  if (endpoint.raw) {
    if (!response.ok) {
      const body = (json ?? {}) as { error?: string; error_description?: string };
      throw new ApiCallError(response.status, 'INVALID_GRANT', body.error_description ?? body.error ?? response.statusText);
    }
    return endpoint.response.parse(json) as EndpointResponse<E>;
  }
  const parsed = envelope(endpoint.response).safeParse(json);
  if (!parsed.success) {
    throw new ApiCallError(response.status || 502, 'UPSTREAM_UNAVAILABLE', `Resposta inválida de ${endpoint.path}`, parsed.error.issues);
  }
  const body = parsed.data as { ok: true; data: z.output<E['response']> } | { ok: false; error: ApiErrorBody };
  if (!body.ok) throw ApiCallError.from(response.status, body.error);
  return body.data as EndpointResponse<E>;
};
