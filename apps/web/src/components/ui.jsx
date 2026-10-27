import { useState } from 'react';
import { Heart, Package } from 'lucide-react';
import { DEMO_PRODUCTS } from '@cesto/contracts';
import { STATUS_LABEL, STATUS_TONE, money } from '../format';

// Ilustração padrão de cada produto do catálogo de demonstração: public/produtos/<slug>.svg.
// Itens de carrinho e de pedido não trazem o slug, então ele é achado pelo SKU ou pelo id.
const DEMO_SLUG = new Map(
  DEMO_PRODUCTS.flatMap((p) => [
    [p.sku, p.slug],
    [p.id, p.slug]
  ])
);

export const productImage = ({ imageUrl, slug, sku, productId, id }) => {
  if (imageUrl) return imageUrl;
  const key = slug ?? DEMO_SLUG.get(sku ?? '') ?? DEMO_SLUG.get(productId ?? '') ?? DEMO_SLUG.get(id ?? '');
  return key ? `/produtos/${key}.svg` : null;
};

export const StatusPill = ({ status }) => <span className={`pill pill-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;

export const ProductTile = ({ src, small = false, alt = '' }) => {
  const [broken, setBroken] = useState(null);
  const className = small ? 'tile tile-sm' : 'tile';
  if (!src || broken === src) {
    return (
      <div className={`${className} tile-empty`} aria-hidden="true">
        <Package size={small ? 18 : 32} strokeWidth={1.25} />
      </div>
    );
  }
  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setBroken(src)} />;
};

/** Etiqueta de preço pendurada, como as de empório. */
export const PriceTag = ({ cents, currency = 'BRL', muted = false }) => {
  const [whole, fraction] = money(cents, currency).replace(/\s/g, ' ').split(',');
  return (
    <span className={muted ? 'tag muted' : 'tag'}>
      <span className="tag-hole" aria-hidden="true" />
      {whole}
      <small>,{fraction}</small>
    </span>
  );
};

/** Quantas unidades restam, com uma régua curta quando está acabando. */
export const Stock = ({ units }) => {
  if (units === undefined) return <span className="stock">Consultando estoque…</span>;
  if (units <= 0) return <span className="stock out">Esgotado</span>;
  if (units < 10)
    return (
      <span className="stock low">
        <span className="meter" aria-hidden="true">
          <span style={{ width: `${Math.max(10, units * 10)}%` }} />
        </span>
        {units === 1 ? 'Última unidade' : `Restam ${units}`}
      </span>
    );
  return <span className="stock">{units} em estoque</span>;
};

export const SaveButton = ({ saved, onClick, label }) => (
  <button className={saved ? 'save on' : 'save'} onClick={onClick} aria-pressed={saved} aria-label={saved ? `Tirar ${label} dos guardados` : `Guardar ${label}`} title={saved ? 'Guardado' : 'Guardar para depois'}>
    <Heart size={17} strokeWidth={1.8} fill={saved ? 'currentColor' : 'none'} />
  </button>
);

export const Empty = ({ title, children, action }) => (
  <div className="empty">
    <strong>{title}</strong>
    {children ? <p>{children}</p> : null}
    {action ?? null}
  </div>
);

export const Field = ({ label, children, hint }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>
);

export const Skeleton = ({ count = 8 }) => (
  <div className="grid" aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="card skeleton">
        <div className="tile" />
        <div className="sk-line" />
        <div className="sk-line short" />
      </div>
    ))}
  </div>
);
