import type { ReactNode } from 'react';
import type { OrderStatus } from '@cesto/contracts';
import { STATUS_LABEL, STATUS_TONE, initials } from '../format';

// Cores de hortifrúti para os produtos sem foto: couve, beterraba, abóbora, berinjela, chuchu, batata-doce.
const PRODUCE = ['#3b7a4c', '#8c2b4b', '#b9772f', '#5a3f5e', '#6e7f3a', '#9a5b3c'];
const produceTone = (sku: string) => PRODUCE[[...sku].reduce((n, c) => n + c.charCodeAt(0), 0) % PRODUCE.length] ?? '#3b7a4c';

export const StatusPill = ({ status }: { status: OrderStatus }) => <span className={`pill pill-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;

export const ProductTile = ({ sku, name, imageUrl, small = false }: { sku: string; name: string; imageUrl: string | null; small?: boolean }) =>
  imageUrl ? (
    <img className={small ? 'tile tile-sm' : 'tile'} src={imageUrl} alt="" loading="lazy" />
  ) : (
    <div className={small ? 'tile tile-sm' : 'tile'} style={{ background: produceTone(sku) }} aria-hidden="true">
      <span>{initials(name)}</span>
    </div>
  );

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

export const PriceTag = ({ label, out = false, swing = false }: { label: string; out?: boolean; swing?: boolean }) => {
  const [currency, ...rest] = label.split(/\s/);
  return (
    <span className={`tag${out ? ' tag-out' : ''}${swing ? ' swing' : ''}`}>
      <span className="tag-string" aria-hidden="true" />
      <span className="tag-body">
        {rest.length ? <small>{currency}</small> : null}
        <strong>{rest.length ? rest.join(' ') : label}</strong>
      </span>
    </span>
  );
};
