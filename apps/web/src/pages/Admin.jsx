import { useState } from 'react';
import { Download, Plus, Search } from 'lucide-react';
import { api, errorMessage, request } from '../api';
import { useAsync, useInterval } from '../hooks';
import { FINAL, PAYMENT_LABEL, STATUS_LABEL, dateTime, downloadCsv, money } from '../format';
import { Field, ProductTile, productImage } from '../components/ui';
import { OrderCard } from './Orders';

const LOW = 5;
const PAID = ['CONFIRMED', 'SHIPPED', 'DELIVERED'];

const ProductRow = ({ product, stock, onSaved, notify }) => {
  const [price, setPrice] = useState((product.priceCents / 100).toFixed(2).replace('.', ','));
  const [units, setUnits] = useState(String(stock ?? 0));
  const cents = Math.round(Number(price.replace(/\./g, '').replace(',', '.')) * 100);
  const dirty = cents !== product.priceCents || Number(units) !== (stock ?? 0);
  const save = async () => {
    try {
      if (!Number.isFinite(cents) || cents < 0) throw new Error('Preço inválido');
      if (cents !== product.priceCents) await request(api.catalog.updateProduct, { params: { id: product.id }, body: { priceCents: cents } });
      if (Number(units) !== stock) await request(api.inventory.set, { params: { id: product.id }, body: { available: Number(units) } });
      notify(`${product.name} atualizado`, 'good');
      onSaved();
    } catch (e) {
      notify(errorMessage(e), 'bad');
    }
  };
  const toggle = async () => {
    try {
      await request(api.catalog.updateProduct, { params: { id: product.id }, body: { active: !product.active } });
      onSaved();
    } catch (e) {
      notify(errorMessage(e), 'bad');
    }
  };
  return (
    <tr className={product.active ? '' : 'inactive'}>
      <td>
        <div className="prod-cell">
          <ProductTile src={productImage(product)} small />
          <div>
            <strong>{product.name}</strong>
            <code className="muted small">{product.sku}</code>
          </div>
        </div>
      </td>
      <td className="muted small">{product.category?.name ?? '—'}</td>
      <td>
        <input className="short num" value={price} onChange={(e) => setPrice(e.target.value)} aria-label={`Preço de ${product.name}`} inputMode="decimal" />
      </td>
      <td>
        <div className="stock-cell">
          <input className="short num" type="number" min={0} value={units} onChange={(e) => setUnits(e.target.value)} aria-label={`Estoque de ${product.name}`} />
          {(stock ?? 0) <= 0 ? <span className="pill pill-bad">zerado</span> : (stock ?? 0) < LOW ? <span className="pill pill-warn">baixo</span> : null}
        </div>
      </td>
      <td className="actions">
        <button className="btn ghost small" onClick={() => void toggle()}>
          {product.active ? 'Desativar' : 'Ativar'}
        </button>
        <button className="btn primary small" disabled={!dirty} onClick={() => void save()}>
          Salvar
        </button>
      </td>
    </tr>
  );
};

const NewProduct = ({ onCreated, notify }) => {
  const categories = useAsync(() => request(api.catalog.listCategories, {}), []);
  const [form, setForm] = useState({ name: '', sku: '', price: '', categoryId: '', description: '' });
  const slug = form.name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const submit = async () => {
    try {
      await request(api.catalog.createProduct, {
        body: {
          name: form.name,
          sku: form.sku.toUpperCase(),
          slug,
          priceCents: Math.round(Number(form.price.replace(',', '.')) * 100),
          description: form.description,
          categoryId: form.categoryId || null
        }
      });
      notify('Produto criado. Ajuste o estoque na tabela.', 'good');
      setForm({ name: '', sku: '', price: '', categoryId: '', description: '' });
      onCreated();
    } catch (e) {
      notify(errorMessage(e), 'bad');
    }
  };
  return (
    <details className="new-product">
      <summary>
        <Plus size={16} aria-hidden="true" /> Cadastrar produto
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Nome" hint={slug ? `Endereço: ${slug}` : undefined}>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="SKU">
          <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="CAS-NOV-17" />
        </Field>
        <Field label="Preço (R$)">
          <input required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="49,90" inputMode="decimal" />
        </Field>
        <Field label="Seção">
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
            <option value="">Sem seção</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrição">
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <button className="btn primary">Criar produto</button>
      </form>
    </details>
  );
};

const ORDER_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'ship', label: 'Para enviar' },
  { id: 'open', label: 'Em andamento' },
  { id: 'CANCELLED', label: 'Cancelados' }
];

export const Admin = ({ notify }) => {
  const [tab, setTab] = useState('orders');
  const [orderFilter, setOrderFilter] = useState('all');
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const orders = useAsync(() => request(api.orders.list, { query: { scope: 'all', pageSize: 100 } }), []);
  const products = useAsync(() => request(api.catalog.listProducts, { query: { pageSize: 100, sort: 'name', includeInactive: 'true' } }), []);
  const stock = useAsync(() => request(api.inventory.list, { query: {} }), []);
  const units = new Map((stock.data ?? []).map((s) => [s.productId, s.available]));
  useInterval(() => void orders.reload(true), tab === 'orders' ? 3000 : null);

  const all = orders.data?.items ?? [];
  const paid = all.filter((o) => PAID.includes(o.status));
  const revenue = paid.reduce((sum, o) => sum + o.totalCents, 0);
  const open = all.filter((o) => !FINAL.includes(o.status));
  const toShip = all.filter((o) => o.status === 'CONFIRMED');
  const low = (products.data?.items ?? []).filter((p) => p.active && (units.get(p.id) ?? 0) < LOW);
  const shownOrders = all.filter((o) =>
    orderFilter === 'all' ? true : orderFilter === 'ship' ? o.status === 'CONFIRMED' : orderFilter === 'open' ? !FINAL.includes(o.status) : o.status === orderFilter
  );
  const term = q.trim().toLowerCase();
  const shownProducts = (products.data?.items ?? []).filter(
    (p) => (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)) && (!lowOnly || (units.get(p.id) ?? 0) < LOW)
  );

  const move = async (id, status) => {
    try {
      await request(api.orders.updateStatus, { params: { id }, body: { status } });
      await orders.reload(true);
    } catch (e) {
      notify(errorMessage(e), 'bad');
    }
  };

  const refreshProducts = () => {
    void products.reload(true);
    void stock.reload(true);
  };

  const exportCsv = () => {
    const rows = [['Pedido', 'Data', 'Status', 'Cliente', 'Cidade', 'UF', 'Pagamento', 'Itens', 'Total (R$)']];
    for (const o of shownOrders) {
      rows.push([
        o.number,
        dateTime(o.createdAt),
        STATUS_LABEL[o.status],
        o.shippingAddress.recipient,
        o.shippingAddress.city,
        o.shippingAddress.state,
        PAYMENT_LABEL[o.paymentMethod] ?? o.paymentMethod,
        o.items.reduce((s, i) => s + i.quantity, 0),
        (o.totalCents / 100).toFixed(2).replace('.', ',')
      ]);
    }
    downloadCsv(`cesto-pedidos-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    notify(`${shownOrders.length} pedidos exportados`);
  };

  return (
    <section className="page wide">
      <header className="page-head">
        <div>
          <p className="eyebrow">Balcão da loja</p>
          <h1>Administração</h1>
        </div>
        <div className="segmented" role="tablist" aria-label="Área">
          <button role="tab" aria-selected={tab === 'orders'} className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
            Pedidos
          </button>
          <button role="tab" aria-selected={tab === 'products'} className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
            Produtos e estoque
          </button>
        </div>
      </header>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-label">Receita confirmada</span>
          <strong className="kpi-value">{money(revenue)}</strong>
          <span>{paid.length} pedidos pagos</span>
        </div>
        <div className="kpi">
          <span className="kpi-label">Ticket médio</span>
          <strong className="kpi-value">{money(paid.length ? Math.round(revenue / paid.length) : 0)}</strong>
          <span>entre os pagos</span>
        </div>
        <button className="kpi kpi-btn" onClick={() => (setTab('orders'), setOrderFilter('ship'))}>
          <span className="kpi-label">Para enviar</span>
          <strong className="kpi-value">{toShip.length}</strong>
          <span>{open.length} em andamento no total</span>
        </button>
        <button className={low.length ? 'kpi kpi-btn warn' : 'kpi kpi-btn'} onClick={() => (setTab('products'), setLowOnly(true))}>
          <span className="kpi-label">Estoque baixo</span>
          <strong className="kpi-value">{low.length}</strong>
          <span>menos de {LOW} unidades</span>
        </button>
      </div>

      {tab === 'orders' ? (
        <>
          <div className="toolbar">
            <div className="chips">
              {ORDER_FILTERS.map((f) => (
                <button key={f.id} className={orderFilter === f.id ? 'chip active' : 'chip'} onClick={() => setOrderFilter(f.id)}>
                  {f.label}
                </button>
              ))}
            </div>
            <button className="btn ghost" onClick={exportCsv} disabled={!shownOrders.length}>
              <Download size={15} aria-hidden="true" /> Exportar CSV
            </button>
          </div>
          <div className="orders">
            {shownOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                admin
                actions={
                  <>
                    {o.status === 'CONFIRMED' ? (
                      <button className="btn primary" onClick={() => void move(o.id, 'SHIPPED')}>
                        Marcar como enviado
                      </button>
                    ) : null}
                    {o.status === 'SHIPPED' ? (
                      <button className="btn primary" onClick={() => void move(o.id, 'DELIVERED')}>
                        Marcar como entregue
                      </button>
                    ) : null}
                    {['PENDING', 'AWAITING_PAYMENT', 'CONFIRMED'].includes(o.status) ? (
                      <button className="btn ghost" onClick={() => void move(o.id, 'CANCELLED')}>
                        Cancelar
                      </button>
                    ) : null}
                  </>
                }
              />
            ))}
            {orders.data && !shownOrders.length ? <p className="muted">Nenhum pedido neste filtro.</p> : null}
          </div>
        </>
      ) : (
        <>
          <div className="toolbar">
            <div className="search small">
              <Search size={16} aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome ou SKU" aria-label="Buscar produto" />
            </div>
            <label className="switch">
              <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
              <span className="switch-track" aria-hidden="true" />
              Só estoque baixo
            </label>
          </div>
          <NewProduct onCreated={refreshProducts} notify={notify} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Seção</th>
                  <th>Preço (R$)</th>
                  <th>Disponível</th>
                  <th>
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shownProducts.map((p) => (
                  <ProductRow key={`${p.id}-${p.updatedAt}-${units.get(p.id)}`} product={p} stock={units.get(p.id)} onSaved={refreshProducts} notify={notify} />
                ))}
              </tbody>
            </table>
            {products.data && !shownProducts.length ? <p className="muted pad">Nenhum produto com esses filtros.</p> : null}
          </div>
        </>
      )}
    </section>
  );
};
