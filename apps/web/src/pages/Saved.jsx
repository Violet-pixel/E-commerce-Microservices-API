import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { shortDate, plural, money } from '../format';
import { Empty, PriceTag, ProductTile, productImage } from '../components/ui';

/** Lista de produtos guardados. Fica no navegador, separada por conta, e não precisa de login. */
export const Saved = ({ items, onAdd, onOpen, onToggleSaved, onBrowse }) => {
  const [busy, setBusy] = useState(null);
  const total = items.reduce((sum, p) => sum + p.priceCents, 0);

  const addAll = async () => {
    setBusy('all');
    for (const p of items) {
      if (!(await onAdd(p.id, 1, p.name))) break;
    }
    setBusy(null);
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Para decidir depois</p>
          <h1>Guardados</h1>
          <p className="muted">
            {items.length ? `${plural(items.length, 'produto', 'produtos')}, ${money(total)} no preço de quando você guardou.` : 'Toque no coração de um produto para guardá-lo aqui.'}
          </p>
        </div>
        {items.length > 1 ? (
          <button className="btn primary" disabled={busy === 'all'} onClick={() => void addAll()}>
            <Plus size={16} aria-hidden="true" /> Pôr tudo no carrinho
          </button>
        ) : null}
      </header>
      {items.length === 0 ? (
        <Empty
          title="Nada guardado ainda"
          action={
            <button className="btn ghost" onClick={onBrowse}>
              Ver a loja
            </button>
          }
        >
          Os guardados ficam neste navegador, separados por conta.
        </Empty>
      ) : (
        <ul className="saved-list">
          {items.map((p) => (
            <li key={p.id}>
              <button className="saved-media" onClick={() => onOpen(p)} aria-label={`Ver ${p.name}`}>
                <ProductTile src={productImage(p)} small />
              </button>
              <div className="saved-info">
                <button className="title-link" onClick={() => onOpen(p)}>
                  {p.name}
                </button>
                <span className="muted small">
                  <code>{p.sku}</code> · guardado em {shortDate(p.savedAt ?? new Date().toISOString())}
                </span>
              </div>
              <PriceTag cents={p.priceCents} currency={p.currency} />
              <div className="saved-actions">
                <button
                  className="btn add"
                  disabled={busy === p.id}
                  onClick={async () => {
                    setBusy(p.id);
                    if (await onAdd(p.id, 1, p.name)) onToggleSaved(p);
                    setBusy(null);
                  }}
                >
                  <Plus size={16} aria-hidden="true" /> Carrinho
                </button>
                <button className="icon-btn" onClick={() => onToggleSaved(p)} aria-label={`Tirar ${p.name} dos guardados`}>
                  <Trash2 size={16} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
