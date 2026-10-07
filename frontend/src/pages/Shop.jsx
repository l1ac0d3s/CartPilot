import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProductCard from '../components/ProductCard';
import Recommendations from '../components/Recommendations';
import { EmptyState, ErrorNote, Spinner } from '../components/Feedback';
import { useApi } from '../utils/useApi';

const SORTS = [
  ['popular', 'Popular'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['name', 'Name'],
];
const PAGE_SIZE = 24;

export default function Shop() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const search = params.get('search') || '';
  const sort = params.get('sort') || 'popular';
  const { data: categoryData } = useApi('/categories');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  useEffect(() => setPage(1), [category, search, sort]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api('/products', { query: { category, search, sort, page, limit: PAGE_SIZE } })
      .then((data) => {
        if (!active) return;
        setResult((prev) => (page === 1 ? data : { ...data, items: [...prev.items, ...data.items] }));
      })
      .catch((err) => active && setError(err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [category, search, sort, page]);

  const categories = categoryData?.categories || [];
  const activeCategory = categories.find((c) => c.slug === category);
  const heading = search ? `Results for “${search}”` : activeCategory ? activeCategory.name : 'All products';

  return (
    <div className="page">
      {!search && !category && (
        <section className="hero">
          <div>
            <h1>Groceries at your door in minutes</h1>
            <p>Fresh produce, daily essentials and snacks — with a cart that already knows what you need.</p>
          </div>
          <div className="hero-badges">
            <span>⚡ 10-min delivery</span>
            <span>🆓 Free delivery above ₹199</span>
            <span>🏷️ WELCOME50 on your first order</span>
          </div>
        </section>
      )}

      {user && !search && !category && <Recommendations title="Buy it again" k={10} />}

      <nav className="category-bar" aria-label="Categories">
        <button className={`chip ${!category ? 'active' : ''}`} onClick={() => update('category', '')}>
          🛍️ All
        </button>
        {categories.map((c) => (
          <button
            key={c.slug}
            className={`chip ${category === c.slug ? 'active' : ''}`}
            onClick={() => update('category', c.slug)}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </nav>

      <div className="section-head">
        <div>
          <h2>{heading}</h2>
          <p className="muted">{result.total} products</p>
        </div>
        <label className="sort">
          <span className="sr-only">Sort by</span>
          <select value={sort} onChange={(e) => update('sort', e.target.value)}>
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ErrorNote error={error} onRetry={() => setPage(1)} />
      {!loading && !error && result.items.length === 0 ? (
        <EmptyState icon="🔍" title="No products found">
          Try a different search or category.
        </EmptyState>
      ) : (
        <div className={`product-grid ${loading && page === 1 ? 'dim' : ''}`}>
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
      {loading && result.items.length === 0 && <Spinner />}
      {page < result.totalPages && (
        <div className="center">
          <button className="button secondary" onClick={() => setPage((p) => p + 1)} disabled={loading}>
            {loading ? 'Loading…' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  );
}
