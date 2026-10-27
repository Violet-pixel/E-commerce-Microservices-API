import { useState } from 'react';
import { ArrowLeft, Check, Heart, Minus, Plus, Trash2, X } from 'lucide-react';
import { api, errorMessage, request } from '../api';
import { useStored } from '../hooks';
import { PAYMENT_LABEL, money, plural } from '../format';
import { Empty, Field, ProductTile, productImage } from './ui';

const blankAddress = { recipient: '', street: '', number: '', complement: '', district: '', city: '', state: '', postalCode: '' };
const STEPS = [
  { id: 'cart', label: 'Carrinho' },
  { id: 'address', label: 'Entrega' },
  { id: 'payment', label: 'Pagamento' },
  { id: 'review', label: 'Revisão' }
];
const PAYMENT_HINT = {
  pix: 'Aprovação na hora. O código aparece no pedido.',
  card: 'Cobrança simulada no cartão de teste.',
  boleto: 'O pedido aguarda o pagamento do boleto.'
};

const formatCep = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

export const CartPanel = ({ cart, onChange, onClose, onOrdered, onSaveForLater }) => {
  const [step, setStep] = useState('cart');
  const [lastAddress, setLastAddress] = useStored('cesto.endereco', null);
  const [address, setAddress] = useState(lastAddress ?? blankAddress);
  const [method, setMethod] = useState('pix');
  const [decline, setDecline] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const index = STEPS.findIndex((s) => s.id === step);
  const items = cart?.items ?? [];
  const blocked = items.some((i) => !i.available);
  const set = (key) => (e) => setAddress({ ...address, [key]: key === 'postalCode' ? formatCep(e.target.value) : key === 'state' ? e.target.value.toUpperCase() : e.target.value });

  const setQty = async (productId, quantity) => {
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
      const body = {
        shippingAddress: { ...address, complement: address.complement || undefined },
        paymentMethod: method,
        ...(method === 'card' ? { cardToken: decline ? 'tok_declined' : 'tok_visa' } : {})
      };
      const order = await request(api.orders.checkout, { body });
      setLastAddress(address);
      setStep('cart');
      onOrdered(order);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const next = (e) => {
    e?.preventDefault();
    setError(null);
    setStep(STEPS[index + 1].id);
  };

  return (
    <aside className="panel cart" aria-label="Carrinho">
      <header>
        {index > 0 ? (
          <button className="icon-btn" onClick={() => setStep(STEPS[index - 1].id)} aria-label="Voltar">
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <h2>{index === 0 ? 'Seu cesto' : 'Fechar pedido'}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Fechar">
          <X size={18} />
        </button>
      </header>
      {index > 0 ? (
        <ol className="steps" aria-label="Etapas do checkout">
          {STEPS.slice(1).map((s, i) => (
            <li key={s.id} className={i + 1 < index ? 'done' : i + 1 === index ? 'current' : ''} aria-current={i + 1 === index ? 'step' : undefined}>
              <span>{i + 1 < index ? <Check size={12} /> : i + 1}</span>
              {s.label}
            </li>
          ))}
        </ol>
      ) : null}
      {error ? (
        <div className="alert" role="alert">
          {error}
        </div>
      ) : null}

      {step === 'cart' ? (
        <>
          {items.length === 0 ? (
            <Empty title="Seu cesto está vazio">Escolha alguma coisa na loja. Os itens ficam guardados na sua conta.</Empty>
          ) : (
            <ul className="lines">
              {items.map((i) => (
                <li key={i.productId} className={i.available ? '' : 'unavailable'}>
                  <ProductTile src={productImage(i)} small />
                  <div className="line-info">
                    <strong>{i.name}</strong>
                    <span className="muted small">
                      <code>{i.sku}</code> · {money(i.unitPriceCents)} cada
                    </span>
                    {!i.available ? <span className="warn small">Indisponível no catálogo. Remova para continuar.</span> : null}
                    <div className="line-actions">
                      <div className="qty small" role="group" aria-label={`Quantidade de ${i.name}`}>
                        <button onClick={() => void setQty(i.productId, i.quantity - 1)} aria-label="Diminuir">
                          <Minus size={13} />
                        </button>
                        <output>{i.quantity}</output>
                        <button onClick={() => void setQty(i.productId, i.quantity + 1)} aria-label="Aumentar">
                          <Plus size={13} />
                        </button>
                      </div>
                      <button className="link small" onClick={() => onSaveForLater(i)} title="Tira do carrinho e guarda para depois">
                        <Heart size={13} aria-hidden="true" /> Guardar
                      </button>
                      <button className="link small danger" onClick={() => void setQty(i.productId, 0)} aria-label={`Remover ${i.name}`}>
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <strong className="line-total">{money(i.subtotalCents)}</strong>
                </li>
              ))}
            </ul>
          )}
          <footer className="receipt">
            <div className="receipt-row">
              <span>{plural(cart?.itemCount ?? 0, 'item', 'itens')}</span>
              <span>{money(cart?.totalCents ?? 0)}</span>
            </div>
            <div className="receipt-row muted">
              <span>Frete</span>
              <span>combinado na entrega</span>
            </div>
            <div className="receipt-total">
              <span>Total</span>
              <strong>{money(cart?.totalCents ?? 0)}</strong>
            </div>
            <button className="btn primary block" disabled={!items.length || blocked} onClick={() => next()}>
              Fechar pedido
            </button>
          </footer>
        </>
      ) : null}

      {step === 'address' ? (
        <form className="checkout" onSubmit={next}>
          {lastAddress && JSON.stringify(lastAddress) !== JSON.stringify(address) ? (
            <button type="button" className="memory" onClick={() => setAddress(lastAddress)}>
              <strong>Usar o último endereço</strong>
              <span>
                {lastAddress.street}, {lastAddress.number} · {lastAddress.city}/{lastAddress.state}
              </span>
            </button>
          ) : null}
          <Field label="Quem recebe">
            <input required value={address.recipient} onChange={set('recipient')} autoComplete="name" />
          </Field>
          <div className="row">
            <Field label="CEP">
              <input required value={address.postalCode} onChange={set('postalCode')} placeholder="00000-000" inputMode="numeric" pattern="\d{5}-?\d{3}" autoComplete="postal-code" />
            </Field>
            <Field label="UF">
              <input required maxLength={2} value={address.state} onChange={set('state')} className="short" autoComplete="address-level1" />
            </Field>
          </div>
          <div className="row">
            <Field label="Rua">
              <input required value={address.street} onChange={set('street')} autoComplete="address-line1" />
            </Field>
            <Field label="Número">
              <input required value={address.number} onChange={set('number')} className="short" />
            </Field>
          </div>
          <div className="row">
            <Field label="Bairro">
              <input required value={address.district} onChange={set('district')} />
            </Field>
            <Field label="Complemento">
              <input value={address.complement} onChange={set('complement')} placeholder="Opcional" />
            </Field>
          </div>
          <Field label="Cidade">
            <input required value={address.city} onChange={set('city')} autoComplete="address-level2" />
          </Field>
          <button
            type="button"
            className="link small"
            onClick={() =>
              setAddress({ recipient: 'Cliente Demonstração', street: 'Rua do Exemplo', number: '123', complement: '', district: 'Centro', city: 'Rio de Janeiro', state: 'RJ', postalCode: '20000-000' })
            }
          >
            Preencher com um endereço de exemplo
          </button>
          <footer>
            <button className="btn primary block">Continuar para o pagamento</button>
          </footer>
        </form>
      ) : null}

      {step === 'payment' ? (
        <form className="checkout" onSubmit={next}>
          <div className="choices" role="radiogroup" aria-label="Forma de pagamento">
            {['pix', 'card', 'boleto'].map((m) => (
              <label key={m} className={method === m ? 'choice active' : 'choice'}>
                <input type="radio" name="pagamento" checked={method === m} onChange={() => setMethod(m)} />
                <strong>{PAYMENT_LABEL[m]}</strong>
                <span>{PAYMENT_HINT[m]}</span>
              </label>
            ))}
          </div>
          {method === 'card' ? (
            <label className="switch">
              <input type="checkbox" checked={decline} onChange={(e) => setDecline(e.target.checked)} />
              <span className="switch-track" aria-hidden="true" />
              Simular cartão recusado (para ver a saga desfazer a reserva)
            </label>
          ) : null}
          <p className="muted small">O pagamento é simulado pelo serviço payments. Nenhum dado real sai daqui.</p>
          <footer>
            <button className="btn primary block">Revisar pedido</button>
          </footer>
        </form>
      ) : null}

      {step === 'review' ? (
        <div className="checkout">
          <section className="review-block">
            <div className="row between">
              <h3>Entrega</h3>
              <button className="link small" onClick={() => setStep('address')}>
                Alterar
              </button>
            </div>
            <p>
              {address.recipient}
              <br />
              {address.street}, {address.number}
              {address.complement ? ` · ${address.complement}` : ''}
              <br />
              {address.district} · {address.city}/{address.state} · {address.postalCode}
            </p>
          </section>
          <section className="review-block">
            <div className="row between">
              <h3>Pagamento</h3>
              <button className="link small" onClick={() => setStep('payment')}>
                Alterar
              </button>
            </div>
            <p>
              {PAYMENT_LABEL[method]}
              {method === 'card' && decline ? ' · vai ser recusado' : ''}
            </p>
          </section>
          <footer className="receipt">
            <ul className="receipt-lines">
              {items.map((i) => (
                <li key={i.productId}>
                  <span>
                    {i.quantity}× {i.name}
                  </span>
                  <span>{money(i.subtotalCents)}</span>
                </li>
              ))}
            </ul>
            <div className="receipt-total">
              <span>Total</span>
              <strong>{money(cart?.totalCents ?? 0)}</strong>
            </div>
            <button className="btn primary block" disabled={busy || !items.length} onClick={() => void submit()}>
              {busy ? 'Enviando…' : `Confirmar pedido de ${money(cart?.totalCents ?? 0)}`}
            </button>
          </footer>
        </div>
      ) : null}
    </aside>
  );
};
