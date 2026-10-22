import type { Currency, PaymentMethod } from '@cesto/contracts';

export interface ChargeRequest {
  idempotencyKey: string;
  amountCents: number;
  currency: Currency;
  method: PaymentMethod;
  cardToken?: string;
}

export type ChargeResult = { approved: true; reference: string } | { approved: false; reference: string; reason: string };

export interface PaymentGateway {
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(reference: string, amountCents: number): Promise<void>;
}

export const DECLINE_TOKEN = 'tok_declined';

export class SimulatedGateway implements PaymentGateway {
  readonly name = 'simulated';

  constructor(private readonly options: { declineAboveCents: number; delayMs: number }) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (this.options.delayMs) await new Promise((r) => setTimeout(r, this.options.delayMs));
    const reference = `sim_${request.idempotencyKey.replace(/-/g, '').slice(0, 24)}`;
    if (request.method === 'card' && request.cardToken === DECLINE_TOKEN) return { approved: false, reference, reason: 'Cartão recusado pelo emissor' };
    if (request.amountCents > this.options.declineAboveCents) return { approved: false, reference, reason: 'Valor acima do limite aprovado' };
    return { approved: true, reference };
  }

  async refund(): Promise<void> {
    if (this.options.delayMs) await new Promise((r) => setTimeout(r, Math.min(this.options.delayMs, 200)));
  }
}
