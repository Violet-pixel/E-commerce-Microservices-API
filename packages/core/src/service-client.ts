import { callEndpoint, TokenResponse } from '@cesto/contracts';
import type { AnyEndpoint, EndpointRequest, EndpointResponse } from '@cesto/contracts';

export interface ServiceClientOptions {
  authUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  timeoutMs?: number;
}

export class ServiceClient {
  private token: { value: string; expiresAt: number } | null = null;
  private pending: Promise<string> | null = null;

  constructor(private readonly options: ServiceClientOptions) {}

  private async fetchToken(): Promise<string> {
    const response = await fetch(`${this.options.authUrl.replace(/\/$/, '')}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        scope: this.options.scope ?? 'internal'
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 5000)
    });
    if (!response.ok) throw new Error(`Falha ao obter token de serviço (${response.status})`);
    const body = TokenResponse.parse(await response.json());
    this.token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 30) * 1000 };
    return body.access_token;
  }

  async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    this.pending ??= this.fetchToken().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  async call<E extends AnyEndpoint>(baseUrl: string, endpoint: E, request: EndpointRequest<E>): Promise<EndpointResponse<E>> {
    const token = await this.accessToken();
    return callEndpoint(endpoint, request, { baseUrl, token, timeoutMs: this.options.timeoutMs ?? 5000 });
  }
}
