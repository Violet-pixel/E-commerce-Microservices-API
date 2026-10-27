import { callEndpoint, TokenResponse } from '@cesto/contracts';

/**
 * Cliente para chamadas entre serviços: obtém (e reaproveita) um token `client_credentials`
 * no serviço de autenticação e chama endpoints declarados com `defineEndpoint`.
 *
 * @typedef {object} ServiceClientOptions
 * @property {string} authUrl
 * @property {string} clientId
 * @property {string} clientSecret
 * @property {string} [scope] padrão `internal`
 * @property {number} [timeoutMs] padrão 5000
 */
export class ServiceClient {
  token = null;
  pending = null;

  /** @param {ServiceClientOptions} options */
  constructor(options) {
    this.options = options;
  }

  async fetchToken() {
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

  async accessToken() {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    this.pending ??= this.fetchToken().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  async call(baseUrl, endpoint, request) {
    const token = await this.accessToken();
    return callEndpoint(endpoint, request, { baseUrl, token, timeoutMs: this.options.timeoutMs ?? 5000 });
  }
}
