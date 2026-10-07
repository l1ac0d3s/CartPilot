import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import Modal from '../../components/Modal';
import { ErrorNote, Spinner } from '../../components/Feedback';
import { money } from '../../utils/format';
import { useApi, useDebounced } from '../../utils/useApi';

const EMPTY = {
  name: '', brand: '', unit: '', description: '', categoryId: '', price: '', mrp: '', costPrice: '',
  stock: 0, reorderLevel: 10, maxStock: 100, isAvailable: true,
};
const NUMERIC = ['price', 'mrp', 'costPrice', 'stock', 'reorderLevel', 'maxStock', 'categoryId'];

function ProductForm({ initial, categories, onSaved, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const editing = Boolean(initial.id);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    const body = {};
    for (const key of Object.keys(EMPTY)) {
      const value = form[key];
      if (value === '' || value == null) {
        if (['brand', 'unit', 'description', 'mrp', 'costPrice'].includes(key)) body[key] = null;
        continue;
      }
      body[key] = NUMERIC.includes(key) ? Number(value) : value;
    }
    try {
      const { product } = editing
        ? await api(`/admin/products/${initial.id}`, { method: 'PUT', body })
        : await api('/admin/products', { method: 'POST', body });
      toast.success(`${product.name} ${editing ? 'updated' : 'created'}`);
      onSaved(product);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  const field = (key, label, props = {}) => (
    <label className="field">
      <span>{label}</span>
      <input value={form[key] ?? ''} onChange={set(key)} {...props} />
    </label>
  );

  return (
    <Modal title={editing ? `Edit ${initial.name}` : 'New product'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        {field('name', 'Name', { required: true, minLength: 2 })}
        {field('brand', 'Brand')}
        {field('unit', 'Pack size', { placeholder: 'e.g. 500 ml' })}
        <label className="field">
          <span>Category</span>
          <select value={form.categoryId} onChange={set('categoryId')} required>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </label>
        {field('price', 'Price (₹)', { type: 'number', min: 0, step: '0.01', required: true })}
        {field('mrp', 'MRP (₹)', { type: 'number', min: 0, step: '0.01' })}
        {field('costPrice', 'Cost price (₹)', { type: 'number', min: 0, step: '0.01' })}
        {field('stock', 'Stock', { type: 'number', min: 0, step: 1, required: true })}
        {field('reorderLevel', 'Reorder level', { type: 'number', min: 0, step: 1, required: true })}
        {field('maxStock', 'Max stock', { type: 'number', min: 1, step: 1, required: true })}
        <label className="field span-all">
          <span>Description</span>
          <textarea rows={2} value={form.description ?? ''} onChange={set('description')} />
        </label>
        <label className="checkbox span-all">
          <input type="checkbox" checked={form.isAvailable} onChange={set('isAvailable')} /> Available for sale
        </label>
        <div className="row-gap span-all">
          <button className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save product'}
          </button>
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminProducts() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const debounced = useDebounced(search);
  const { data: categoryData } = useApi('/categories');
  const { data, error, loading, reload } = useApi('/admin/products', {
    search: debounced, category, lowStock: lowStock || undefined, sort, page, limit: 50,
  });
  const categories = categoryData?.categories || [];

  const patch = async (product, body, message) => {
    try {
      await api(`/admin/products/${product.id}`, { method: 'PUT', body });
      if (message) toast.success(message);
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (product) => {
    if (!window.confirm(`Delete ${product.name}? It will be hidden from the store; order history is kept.`)) return;
    try {
      await api(`/admin/products/${product.id}`, { method: 'DELETE' });
      toast.success('Product deleted');
      reload();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="row-between">
        <h1>Products</h1>
        <button className="button" onClick={() => setEditing(EMPTY)}>
          + New product
        </button>
      </div>
      <div className="filter-row">
        <input
          type="search"
          placeholder="Search name, brand, SKU…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          aria-label="Search products"
        />
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="name">Name</option>
          <option value="stock_asc">Lowest stock</option>
          <option value="popular">Best sellers (30d)</option>
          <option value="price_desc">Price: high to low</option>
          <option value="newest">Newest</option>
        </select>
        <label className="checkbox">
          <input type="checkbox" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1); }} /> Low stock only
        </label>
      </div>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data && <Spinner />}
      {data && (
        <div className={`card table-card ${loading ? 'dim' : ''}`}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="num">Price</th>
                  <th className="num">Stock</th>
                  <th className="num">Reorder at</th>
                  <th className="num">Sold (30d)</th>
                  <th>Available</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <span className="muted small block">
                        {p.sku} · {p.unit}
                      </span>
                    </td>
                    <td>
                      {p.category.icon} {p.category.name}
                    </td>
                    <td className="num">{money(p.price)}</td>
                    <td className="num">
                      <span className={p.stock === 0 ? 'stock-out' : p.lowStock ? 'stock-low' : ''}>
                        {p.stock === 0 ? '✕ ' : p.lowStock ? '! ' : ''}
                        {p.stock}
                      </span>
                    </td>
                    <td className="num">{p.reorderLevel}</td>
                    <td className="num">{p.unitsSold30d}</td>
                    <td>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={p.isAvailable}
                          onChange={(e) =>
                            patch(p, { isAvailable: e.target.checked }, `${p.name} marked ${e.target.checked ? 'available' : 'unavailable'}`)
                          }
                          aria-label={`${p.name} available`}
                        />
                        <span />
                      </label>
                    </td>
                    <td className="actions">
                      <button
                        className="link-button"
                        onClick={() =>
                          setEditing({ ...p, categoryId: p.category.id, mrp: p.mrp ?? '', costPrice: p.costPrice ?? '' })
                        }
                      >
                        Edit
                      </button>
                      <button className="link-button danger-text" onClick={() => remove(p)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span className="muted small">{data.total} products</span>
            <button className="button secondary small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span className="muted small">
              Page {page} of {Math.max(1, data.totalPages)}
            </span>
            <button className="button secondary small" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
      {editing && (
        <ProductForm
          initial={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
