export const money = (cents, currency = 'BRL') => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency });

export const dateTime = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const STATUS_LABEL = {
  PENDING: 'Reservando',
  AWAITING_PAYMENT: 'Aguardando pagamento',
  CONFIRMED: 'Confirmado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado'
};

export const STATUS_TONE = {
  PENDING: 'neutral',
  AWAITING_PAYMENT: 'info',
  CONFIRMED: 'good',
  SHIPPED: 'good',
  DELIVERED: 'good',
  CANCELLED: 'bad'
};

export const FINAL = ['DELIVERED', 'CANCELLED'];

export const decodeClaims = (token) => {
  try {
    const payload = token.split('.')[1] ?? '';
    return JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))));
  } catch {
    return null;
  }
};

export const PAYMENT_LABEL = { pix: 'Pix', card: 'Cartão', boleto: 'Boleto' };

export const shortDate = (iso) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export const plural = (n, one, many) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`;

/** Monta um CSV com separador ";" (abre direto no Excel em português) e dispara o download. */
export const downloadCsv = (filename, rows) => {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
