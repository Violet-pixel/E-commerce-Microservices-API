import { useState } from 'react';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import type { CartDto, CheckoutBody, OrderDto, PaymentMethod } from '@cesto/contracts';
import { api, errorMessage, request } from '../api';
import { money } from '../format';
import { Empty, Field, ProductTile } from './ui';

const blankAddress = { recipient: '', street: '', number: '', complement: '', district: '', city: '', state: '', postalCode: '' };

export const CartPanel = ({ cart, onChange, onClose, onOrdered }: { cart: CartDto | null; onChange: (cart: CartDto) => void; onClose: () => void; onOrdered: (order: OrderDto) => void }) => {
  const [step, setStep] = useState<'cart' | 'checkout'>('cart');
  const [address, setAddress] = useState(blankAddress);
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [decline, setDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setQty = async (productId: string, quantity: number) => {
    try {
      onChange(await request(api.cart.update, { params: { productId }, body: { quantity } }));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const body: CheckoutBody = {
        shippingAddress: { ...address, complement: address.complement || undefined },
        paymentMethod: method,
        ...(method === 'card' ? { cardToken: decline ? 'tok_declined' : 'tok_visa' } : {})
      };
      const order = await request(api.orders.checkout, { body });
      setStep('cart');
      onOrdered(order);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const fill = () =>
    setAddress({ recipient: 'Cliente Demonstração', street: 'Rua do Exemplo', number: '123', complement: '', district: 'Centro', city: 'Rio de Janeiro', state: 'RJ', postalCode: '20000-000' });

  return (
    <aside className="panel" aria-label="Carrinho">
      <header>
        <h2>{step === 'cart' ? 'Carrinho' : 'Fechar pedido'}</h2>
        <button className="btn ghost icon-only" onClick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>
      </header>
      {error ? <div className="alert">{error}</div> : null}
      {step === 'cart' ? (
        <>
          {!cart || cart.items.length === 0 ? (
            <Empty title="Seu carrinho está vazio">Adicione produtos na loja.</Empty>
          ) : (
            <ul className="lines">
              {cart.items.map((i) => (
                <li key={i.productId} className={i.available ? '' : 'unavailable'}>
                  <ProductTile sku={i.sku} name={i.name} imageUrl={i.imageUrl} small />
                  <div>
                    <strong>{i.name}</strong>
                    <span className="muted small">{money(i.unitPriceCents)} cada</span>
                    <div className="stepper">
                      <button onClick={() => void setQty(i.productId, i.quantity - 1)} aria-label="Diminuir">
                        <Minus size={14} />
                      </button>
                      <span>{i.quantity}</span>
                      <button onClick={() => void setQty(i.productId, i.quantity + 1)} aria-label="Aumentar">
                        <Plus size={14} />
                      </button>
                      <button onClick={() => void setQty(i.productId, 0)} aria-label="Remover">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <strong>{money(i.subtotalCents)}</strong>
                </li>
              ))}
            </ul>
          )}
          <footer>
            <div className="total">
              <span>Total</span>
              <strong>{money(cart?.totalCents ?? 0)}</strong>
            </div>
            <button className="btn primary block" disabled={!cart || cart.itemCount === 0} onClick={() => setStep('checkout')}>
              Continuar
            </button>
          </footer>
        </>
      ) : (
        <form
          className="checkout"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="row between">
            <h3>Entrega</h3>
            <button type="button" className="link" onClick={fill}>
              Preencher exemplo
            </button>
          </div>
          <Field label="Destinatário">
            <input required value={address.recipient} onChange={(e) => setAddress({ ...address, recipient: e.target.value })} />
          </Field>
          <div className="row">
            <Field label="Rua">
              <input required value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
            </Field>
            <Field label="Número">
              <input required value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} className="short" />
            </Field>
          </div>
          <div className="row">
            <Field label="Bairro">
              <input required value={address.district} onChange={(e) => setAddress({ ...address, district: e.target.value })} />
            </Field>
            <Field label="Complemento">
              <input value={address.complement} onChange={(e) => setAddress({ ...address, complement: e.target.value })} />
            </Field>
          </div>
          <div className="row">
            <Field label="Cidade">
              <input required value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            </Field>
            <Field label="UF">
              <input required maxLength={2} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className="short" />
            </Field>
            <Field label="CEP">
              <input required value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} placeholder="00000-000" />
            </Field>
          </div>
          <h3>Pagamento</h3>
          <div className="segmented">
            {(['pix', 'card', 'boleto'] as const).map((m) => (
              <button type="button" key={m} className={method === m ? 'active' : ''} onClick={() => setMethod(m)}>
                {m === 'pix' ? 'Pix' : m === 'card' ? 'Cartão' : 'Boleto'}
              </button>
            ))}
          </div>
          {method === 'card' ? (
            <label className="check">
              <input type="checkbox" checked={decline} onChange={(e) => setDecline(e.target.checked)} />
              Simular cartão recusado
            </label>
          ) : null}
          <p className="muted small">O pagamento é simulado. Nenhum dado real é enviado.</p>
          <footer>
            <div className="total">
              <span>Total</span>
              <strong>{money(cart?.totalCents ?? 0)}</strong>
            </div>
            <div className="row">
              <button type="button" className="btn ghost" onClick={() => setStep('cart')}>
                Voltar
              </button>
              <button className="btn primary grow" disabled={busy}>
                {busy ? 'Enviando…' : 'Confirmar pedido'}
              </button>
            </div>
          </footer>
        </form>
      )}
    </aside>
  );
};
