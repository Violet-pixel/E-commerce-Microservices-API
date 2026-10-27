import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { api, request } from '../api';
import { useAsync } from '../hooks';
import { money } from '../format';
import { PriceTag, ProductTile, SaveButton, Stock, productImage } from './ui';

/** Visualização rápida: abre por cima da loja, sem perder filtros nem a posição da página. */
export const ProductSheet = ({ product, onClose, onAdd, saved, onToggleSaved }) => {
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const closeRef = useRef(null);
  const stock = useAsync(async () => (await request(api.inventory.list, { query: { productIds: product.id } }))[0] ?? null, [product.id]);
  const units = stock.data?.available ?? product.available;
  const max = units === undefined ? 20 : Math.max(0, Math.min(units, 20));
  const out = units !== undefined && units <= 0;

  useEffect(() => closeRef.current?.focus(), []);
  useEffect(() => setQty((q) => Math.min(Math.max(1, q), Math.max(1, max))), [max]);

  const add = async () => {
    setBusy(true);
    const ok = await onAdd(product.id, qty, product.name);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <button ref={closeRef} className="icon-btn sheet-close" onClick={onClose} aria-label="Fechar">
        <X size={18} />
      </button>
      <div className="sheet-media">
        <ProductTile src={productImage(product)} alt={product.name} />
      </div>
      <div className="sheet-info">
        <p className="eyebrow">
          {product.category?.name ?? 'Sem seção'} · <code>{product.sku}</code>
        </p>
        <h2 id="sheet-title">{product.name}</h2>
        <p className="sheet-desc">{product.description || 'Sem descrição.'}</p>
        <div className="sheet-price">
          <PriceTag cents={product.priceCents} currency={product.currency} muted={out} />
          <Stock units={units} />
        </div>
        <div className="sheet-buy">
          <div className="qty" role="group" aria-label="Quantidade">
            <button onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1 || out} aria-label="Diminuir">
              <Minus size={15} />
            </button>
            <output aria-live="polite">{qty}</output>
            <button onClick={() => setQty(Math.min(max, qty + 1))} disabled={qty >= max || out} aria-label="Aumentar">
              <Plus size={15} />
            </button>
          </div>
          <button className="btn primary grow" disabled={busy || out} onClick={() => void add()}>
            {out ? 'Esgotado' : busy ? 'Adicionando…' : `Adicionar · ${money(product.priceCents * qty, product.currency)}`}
          </button>
          <SaveButton saved={saved} onClick={() => onToggleSaved(product)} label={product.name} />
        </div>
        <dl className="sheet-facts">
          <div>
            <dt>Reserva</dt>
            <dd>O estoque só é separado quando você fecha o pedido.</dd>
          </div>
          <div>
            <dt>Preço</dt>
            <dd>O carrinho sempre relê o preço no catálogo antes de cobrar.</dd>
          </div>
        </dl>
      </div>
    </div>
  );
};
