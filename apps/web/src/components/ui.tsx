import type { ReactNode } from 'react';
import type { OrderStatus } from '@cesto/contracts';
import { STATUS_LABEL, STATUS_TONE, initials, tileTone } from '../format';

export const StatusPill = ({ status }: { status: OrderStatus }) => <span className={`pill pill-${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;

export const ProductTile = ({ sku, name, imageUrl, small = false }: { sku: string; name: string; imageUrl: string | null; small?: boolean }) =>
  imageUrl ? (
    <img className={small ? 'tile tile-sm' : 'tile'} src={imageUrl} alt="" loading="lazy" />
  ) : (
    <div className={small ? 'tile tile-sm' : 'tile'} style={{ background: tileTone(sku) }} aria-hidden="true">
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
