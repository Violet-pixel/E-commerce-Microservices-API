import { useState, type ReactNode } from 'react';
import { Package } from 'lucide-react';
import { DEMO_PRODUCTS, type OrderStatus } from '@cesto/contracts';
import { STATUS_LABEL, STATUS_TONE } from '../format';

// Ilustração padrão de cada produto do catálogo de demonstração: public/produtos/<slug>.svg.
// Itens de carrinho e de pedido não trazem o slug, então ele é achado pelo SKU ou pelo id.
const DEMO_SLUG = new Map<string, string>(DEMO_PRODUCTS.flatMap((p) => [[p.sku, p.slug] as const, [p.id, p.slug] as const]));

export const productImage = ({ imageUrl, slug, sku, productId }: { imageUrl?: string | null; slug?: string; sku?: string; productId?: string }) => {
  if (imageUrl) return imageUrl;
  const key = slug ?? DEMO_SLUG.get(sku ?? '') ?? DEMO_SLUG.get(productId ?? '');
  return key ? `/produtos/${key}.svg` : null;
};

export const StatusPill = ({ status }: { status: OrderStatus }) => <span className={`pill pill-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;

export const ProductTile = ({ src, small = false }: { src: string | null; small?: boolean }) => {
  const [broken, setBroken] = useState<string | null>(null);
  const className = small ? 'tile tile-sm' : 'tile';
  if (!src || broken === src) {
    return (
      <div className={`${className} tile-empty`} aria-hidden="true">
        <Package size={small ? 18 : 32} strokeWidth={1.25} />
      </div>
    );
  }
  return <img className={className} src={src} alt="" loading="lazy" onError={() => setBroken(src)} />;
};

export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => (
  <div className="empty">
    <strong>{title}</strong>
    {children ? <p>{children}</p> : null}
  </div>
);

export const Field = ({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {hint ? <small>{hint}</small> : null}
  </label>
);
