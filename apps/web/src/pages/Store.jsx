import { useEffect, useRef, useState } from 'react';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { api, request } from '../api';
import { useAsync, useDebounced, useKey } from '../hooks';
import { plural } from '../format';
import { Empty, PriceTag, ProductTile, SaveButton, Skeleton, Stock, productImage } from '../components/ui';

// Faixas em centavos. O filtro vai para a API (minPrice/maxPrice), não é feito no navegador.
const PRICE_BANDS = [
  { id: 'all', label: 'Qualquer preço' },
  { id: 'ate-80', label: 'Até R$ 80', max: 8000 },
  { id: '80-200', label: 'R$ 80 a R$ 200', min: 8000, max: 20000 },
  { id: 'acima-200', label: 'Acima de R$ 200', min: 20000 }
];

const SORTS = [
  { id: 'newest', label: 'Chegaram agora' },
  { id: 'name', label: 'Nome, A a Z' },
  { id: 'price_asc', label: 'Menor preço' },
  { id: 'price_desc', label: 'Maior preço' }
];

export const Store = ({ onAdd, onOpen, isSaved, onToggleSaved }) => {
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 300);
  const [category, setCategory] = useState();
  const [band, setBand] = useState('all');
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef(null);

  useKey('/', (e) => {
    e.preventDefault();
    searchRef.current?.focus();
  });
  useEffect(() => setPage(1), [term, category, band, sort]);

  const price = PRICE_BANDS.find((b) => b.id === band) ?? PRICE_BANDS[0];
  const categories = useAsync(() => request(api.catalog.listCategories, {}), []);
  const products = useAsync(
    () =>
      request(api.catalog.listProducts, {
        query: { q: term || undefined, category, sort, page, pageSize: 12, minPrice: price.min, maxPrice: price.max }
      }),
    [term, category, sort, page, band]
  );
  const ids = products.data?.items.map((p) => p.id) ?? [];
  const stock = useAsync(async () => (ids.length ? request(api.inventory.list, { query: { productIds: ids.join(',') } }) : []), [ids.join(',')]);
  const available = new Map((stock.data ?? []).map((s) => [s.productId, s.available]));
  const items = (products.data?.items ?? []).filter((p) => !inStock || (available.get(p.id) ?? 1) > 0);
  const total = categories.data?.reduce((sum, c) => sum + c.productCount, 0) ?? 0;
  const active = [
    category ? { key: 'cat', label: categories.data?.find((c) => c.slug === category)?.name ?? category, clear: () => setCategory(undefined) } : null,
    band !== 'all' ? { key: 'band', label: price.label, clear: () => setBand('all') } : null,
    inStock ? { key: 'stock', label: 'Só com estoque', clear: () => setInStock(false) } : null,
    term ? { key: 'q', label: `“${term}”`, clear: () => setQ('') } : null
  ].filter(Boolean);

  const add = async (p) => {
    setBusy(p.id);
    try {
      await onAdd(p.id, 1, p.name);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="store">
      <header className="store-head">
        <div>
          <p className="eyebrow">Empório de demonstração · {plural(total, 'produto', 'produtos')}</p>
          <h1>Coisas boas para a casa, a mesa e o caderno.</h1>
        </div>
        <div className="search">
          <Search size={18} aria-hidden="true" />
          <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, descrição ou SKU" aria-label="Buscar produtos" />
          {q ? (
            <button className="search-clear" onClick={() => setQ('')} aria-label="Limpar busca">
              <X size={15} />
            </button>
          ) : (
            <kbd aria-hidden="true">/</kbd>
          )}
        </div>
      </header>

      <div className="store-body">
        <aside className={filtersOpen ? 'filters open' : 'filters'} aria-label="Filtros">
          <div className="filters-head">
            <h2>Filtrar</h2>
            <button className="icon-btn only-mobile" onClick={() => setFiltersOpen(false)} aria-label="Fechar filtros">
              <X size={18} />
            </button>
          </div>
          <fieldset>
            <legend>Seção</legend>
            <button className={!category ? 'facet active' : 'facet'} onClick={() => setCategory(undefined)}>
              <span>Tudo</span>
              <em>{total}</em>
            </button>
            {categories.data?.map((c) => (
              <button key={c.id} className={category === c.slug ? 'facet active' : 'facet'} onClick={() => setCategory(category === c.slug ? undefined : c.slug)}>
                <span>{c.name}</span>
                <em>{c.productCount}</em>
              </button>
            ))}
          </fieldset>
          <fieldset>
            <legend>Preço</legend>
            {PRICE_BANDS.map((b) => (
              <label key={b.id} className="radio">
                <input type="radio" name="faixa" checked={band === b.id} onChange={() => setBand(b.id)} />
                {b.label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Disponibilidade</legend>
            <label className="switch">
              <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
              <span className="switch-track" aria-hidden="true" />
              Só com estoque
            </label>
          </fieldset>
        </aside>

        <div className="results">
          <div className="results-bar">
            <button className="btn ghost only-mobile" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal size={16} aria-hidden="true" /> Filtros{active.length ? ` (${active.length})` : ''}
            </button>
            <p className="results-count" aria-live="polite">
              {products.loading && !products.data ? 'Carregando…' : plural(products.data?.total ?? 0, 'resultado', 'resultados')}
            </p>
            <div className="active-filters">
              {active.map((f) => (
                <button key={f.key} className="chip" onClick={f.clear} aria-label={`Remover filtro ${f.label}`}>
                  {f.label}
                  <X size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
            <label className="sort">
              <span>Ordenar</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {products.error ? <div className="alert">{products.error}</div> : null}
          {products.loading && !products.data ? <Skeleton /> : null}
          {products.data && items.length === 0 ? (
            <Empty
              title="Nada com esses filtros"
              action={
                active.length ? (
                  <button
                    className="btn ghost"
                    onClick={() => {
                      setCategory(undefined);
                      setBand('all');
                      setInStock(false);
                      setQ('');
                    }}
                  >
                    Limpar filtros
                  </button>
                ) : null
              }
            >
              Tente outro termo, outra seção ou uma faixa de preço maior.
            </Empty>
          ) : null}

          <div className="grid">
            {items.map((p) => {
              const units = available.get(p.id);
              const out = units !== undefined && units <= 0;
              return (
                <article key={p.id} className={out ? 'card is-out' : 'card'}>
                  <button className="card-media" onClick={() => onOpen({ ...p, available: units })} aria-label={`Ver detalhes de ${p.name}`}>
                    <ProductTile src={productImage(p)} />
                    <PriceTag cents={p.priceCents} currency={p.currency} muted={out} />
                  </button>
                  <SaveButton saved={isSaved(p.id)} onClick={() => onToggleSaved(p)} label={p.name} />
                  <div className="card-body">
                    <span className="card-meta">
                      <span>{p.category?.name ?? 'Sem seção'}</span>
                      <code>{p.sku}</code>
                    </span>
                    <h3>
                      <button className="title-link" onClick={() => onOpen({ ...p, available: units })}>
                        {p.name}
                      </button>
                    </h3>
                    <p>{p.description}</p>
                  </div>
                  <div className="card-foot">
                    <Stock units={units} />
                    <button className="btn add" disabled={busy === p.id || out} onClick={() => void add(p)} aria-label={`Adicionar ${p.name} ao carrinho`}>
                      <Plus size={16} aria-hidden="true" />
                      {out ? 'Esgotado' : 'Adicionar'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {products.data && products.data.totalPages > 1 ? (
            <nav className="pager" aria-label="Páginas">
              <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Anterior
              </button>
              <span>
                Página {products.data.page} de {products.data.totalPages}
              </span>
              <button className="btn ghost" disabled={page >= products.data.totalPages} onClick={() => setPage(page + 1)}>
                Próxima
              </button>
            </nav>
          ) : null}
        </div>
      </div>
    </section>
  );
};
