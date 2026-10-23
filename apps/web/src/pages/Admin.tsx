import { useState } from 'react';
import type { CreateProductBody, ProductDto } from '@cesto/contracts';
import { api, errorMessage, request } from '../api';
import { useAsync, useInterval } from '../hooks';
import { money } from '../format';
import { Field, ProductTile, productImage } from '../components/ui';
import { OrderCard } from './Orders';

type Tab = 'orders' | 'products';

const ProductRow = ({ product, stock, onSaved, notify }: { product: ProductDto; stock: number | undefined; onSaved: () => void; notify: (m: string) => void }) => {
  const [price, setPrice] = useState((product.priceCents / 100).toFixed(2));
  const [units, setUnits] = useState(String(stock ?? 0));
  const save = async () => {
    try {
      const cents = Math.round(Number(price.replace(',', '.')) * 100);
      if (cents !== product.priceCents) await request(api.catalog.updateProduct, { params: { id: product.id }, body: { priceCents: cents } });
      if (Number(units) !== stock) await request(api.inventory.set, { params: { id: product.id }, body: { available: Number(units) } });
      notify(`${product.name} atualizado`);
      onSaved();
    } catch (e) {
      notify(errorMessage(e));
    }
  };
  const toggle = async () => {
    try {
      await request(api.catalog.updateProduct, { params: { id: product.id }, body: { active: !product.active } });
      onSaved();
    } catch (e) {
      notify(errorMessage(e));
    }
  };
  return (
    <tr className={product.active ? '' : 'inactive'}>
      <td>
        <div className="row">
          <ProductTile src={productImage(product)} small />
          <div>
            <strong>{product.name}</strong>
            <span className="muted small">{product.sku}</span>
          </div>
        </div>
      </td>
      <td>
        <input className="short" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Preço" />
      </td>
      <td>
        <input className="short" type="number" min={0} value={units} onChange={(e) => setUnits(e.target.value)} aria-label="Estoque" />
      </td>
      <td className="actions">
        <button className="btn ghost" onClick={() => void toggle()}>
          {product.active ? 'Desativar' : 'Ativar'}
        </button>
        <button className="btn primary" onClick={() => void save()}>
          Salvar
        </button>
      </td>
    </tr>
  );
};

const NewProduct = ({ onCreated, notify }: { onCreated: () => void; notify: (m: string) => void }) => {
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
      const body: Partial<CreateProductBody> & Pick<CreateProductBody, 'sku' | 'name' | 'slug' | 'priceCents'> = {
        name: form.name,
        sku: form.sku.toUpperCase(),
        slug,
        priceCents: Math.round(Number(form.price.replace(',', '.')) * 100),
        description: form.description,
        categoryId: form.categoryId || null
      };
      await request(api.catalog.createProduct, { body });
      notify('Produto criado');
      setForm({ name: '', sku: '', price: '', categoryId: '', description: '' });
      onCreated();
    } catch (e) {
      notify(errorMessage(e));
    }
  };
  return (
    <form
      className="new-product"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Field label="Nome">
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="SKU">
        <input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="CAS-NOV-17" />
      </Field>
      <Field label="Preço (R$)">
        <input required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="49,90" />
      </Field>
      <Field label="Categoria">
        <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
          <option value="">Sem categoria</option>
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
  );
};

export const Admin = ({ notify }: { notify: (message: string) => void }) => {
  const [tab, setTab] = useState<Tab>('orders');
  const orders = useAsync(() => request(api.orders.list, { query: { scope: 'all', pageSize: 30 } }), []);
  const products = useAsync(() => request(api.catalog.listProducts, { query: { pageSize: 100, sort: 'name', includeInactive: 'true' } }), []);
  const stock = useAsync(() => request(api.inventory.list, { query: {} }), []);
  const units = new Map((stock.data ?? []).map((s) => [s.productId, s.available]));
  useInterval(() => void orders.reload(true), tab === 'orders' ? 3000 : null);

  const move = async (id: string, status: 'SHIPPED' | 'DELIVERED' | 'CANCELLED') => {
    try {
      await request(api.orders.updateStatus, { params: { id }, body: { status } });
      await orders.reload(true);
    } catch (e) {
      notify(errorMessage(e));
    }
  };

  const refreshProducts = () => {
    void products.reload(true);
    void stock.reload(true);
  };

  return (
    <section className="page">
      <div className="row between">
        <h1>Administração</h1>
        <div className="segmented">
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>
            Pedidos
          </button>
          <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
            Produtos e estoque
          </button>
        </div>
      </div>
      {tab === 'orders' ? (
        <div className="orders">
          {orders.data?.items.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
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
                  <span className="muted small grow">Total {money(o.totalCents)}</span>
                </>
              }
            />
          ))}
        </div>
      ) : (
        <>
          <NewProduct onCreated={refreshProducts} notify={notify} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Preço (R$)</th>
                  <th>Disponível</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.data?.items.map((p) => (
                  <ProductRow key={`${p.id}-${p.updatedAt}-${units.get(p.id)}`} product={p} stock={units.get(p.id)} onSaved={refreshProducts} notify={notify} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
