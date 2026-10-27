/**
 * Contrato que qualquer adquirente (real ou simulado) precisa cumprir.
 *
 * @typedef {object} ChargeRequest
 * @property {string} idempotencyKey
 * @property {number} amountCents
 * @property {import('@cesto/contracts').Currency} currency
 * @property {import('@cesto/contracts').PaymentMethod} method
 * @property {string} [cardToken]
 *
 * @typedef {{ approved: true, reference: string } | { approved: false, reference: string, reason: string }} ChargeResult
 *
 * @typedef {object} PaymentGateway
 * @property {string} name
 * @property {(request: ChargeRequest) => Promise<ChargeResult>} charge
 * @property {(reference: string, amountCents: number) => Promise<void>} refund
 */

export const DECLINE_TOKEN = 'tok_declined';

/** @implements {PaymentGateway} */
export class SimulatedGateway {
  name = 'simulated';

  constructor(options) {
    this.options = options;
  }

  async charge(request) {
    if (this.options.delayMs) await new Promise((r) => setTimeout(r, this.options.delayMs));
    const reference = `sim_${request.idempotencyKey.replace(/-/g, '').slice(0, 24)}`;
    if (request.method === 'card' && request.cardToken === DECLINE_TOKEN) return { approved: false, reference, reason: 'Cartão recusado pelo emissor' };
    if (request.amountCents > this.options.declineAboveCents) return { approved: false, reference, reason: 'Valor acima do limite aprovado' };
    return { approved: true, reference };
  }

  async refund() {
    if (this.options.delayMs) await new Promise((r) => setTimeout(r, Math.min(this.options.delayMs, 200)));
  }
}
