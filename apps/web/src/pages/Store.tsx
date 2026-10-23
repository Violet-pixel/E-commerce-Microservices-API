import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { ProductQuery } from '@cesto/contracts';
import { api, request } from '../api';
import { useAsync } from '../hooks';
import { money } from '../format';
import { Empty, ProductTile, productImage } from '../components/ui';

type Sort = ProductQuery['sort'];

export const Store = ({ onAdd, canBuy }: { onAdd: (productId: string) => Promise<void>; canBuy: boolean }) => {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [sort, setSort] = useState<Sort>('newest');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);

  const categories = useAsync(() => request(api.catalog.listCategories, {}), []);
  const products = useAsync(
    () => request(api.catalog.listProducts, { query: { q: term || undefined, category, sort, page, pageSize: 12 } }),
    [term, category, sort, page]
  );
  const ids = products.data?.items.map((p) => p.id) ?? [];
  const stock = useAsync(async () => (ids.length ? request(api.inventory.list, { query: { productIds: ids.join(',') } }) : []), [ids.join(',')]);
  const available = new Map((stock.data ?? []).map((s) => [s.productId, s.available]));

  const add = async (id: string) => {
    setBusy(id);
    try {
      await onAdd(id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="store">
      <div className="hero">
        <div>
          <h1>Loja de demonstração</h1>
          <p>Catálogo, carrinho, estoque, pagamento e notificações conversando por eventos. Cada botão aqui chama a API do gateway.</p>
        </div>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setTerm(q.trim());
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, descrição ou SKU" aria-label="Buscar produtos" />
        </form>
      </div>

      <div className="toolbar">
        <div className="chips" role="tablist">
          <button className={!category ? 'chip active' : 'chip'} onClick={() => (setCategory(undefined), setPage(1))}>
            Tudo
          </button>
          {categories.data?.map((c) => (
            <button key={c.id} className={category === c.slug ? 'chip active' : 'chip'} onClick={() => (setCategory(c.slug), setPage(1))}>
              {c.name}
              <em>{c.productCount}</em>
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
          <option value="newest">Mais recentes</option>
          <option value="name">Nome</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
        </select>
      </div>

      {products.error ? <div className="alert">{products.error}</div> : null}
      {products.data && products.data.items.length === 0 ? <Empty title="Nada encontrado">Tente outro termo ou outra categoria.</Empty> : null}

      <div className="grid">
        {products.data?.items.map((p) => {
          const units = available.get(p.id);
          const out = units !== undefined && units <= 0;
          return (
            <article key={p.id} className="card">
              <ProductTile src={productImage(p)} />
              <div className="card-body">
                <span className="card-meta">
                  <span className="cat">{p.category?.name ?? 'Sem categoria'}</span>
                  <span className="sku">{p.sku}</span>
                </span>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
              </div>
              <div className="card-foot">
                <div className="price-block">
                  <strong className={out ? 'price out' : 'price'}>{money(p.priceCents, p.currency)}</strong>
                  <span className={out ? 'stock out' : units !== undefined && units < 5 ? 'stock low' : 'stock'}>
                    {units === undefined ? '…' : out ? 'Sem estoque' : `${units} em estoque`}
                  </span>
                </div>
                <button className="btn icon add" disabled={busy === p.id || out} onClick={() => void add(p.id)} title={canBuy ? 'Adicionar ao carrinho' : 'Entre para comprar'}>
                  <Plus size={16} aria-hidden="true" />
                  <span>Adicionar</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {products.data && products.data.totalPages > 1 ? (
        <div className="pager">
          <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Anterior
          </button>
          <span>
            Página {products.data.page} de {products.data.totalPages}
          </span>
          <button className="btn ghost" disabled={page >= products.data.totalPages} onClick={() => setPage(page + 1)}>
            Próxima
          </button>
        </div>
      ) : null}
    </section>
  );
};
