import { Fragment, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import StatusTimeline from '../../components/StatusTimeline';
import { OrderStatusBadge, PaymentBadge } from '../../components/StatusBadge';
import { ErrorNote, Spinner } from '../../components/Feedback';
import { dateTime, money, STATUS_LABELS } from '../../utils/format';
import { useApi, useDebounced } from '../../utils/useApi';

const FILTERS = ['', 'CREATED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
const NEXT = {
  CONFIRMED: ['PREPARING', 'Start preparing'],
  PREPARING: ['OUT_FOR_DELIVERY', 'Hand to rider'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'Mark delivered'],
};
const CANCELLABLE = ['CREATED', 'CONFIRMED', 'PREPARING'];

function OrderDetailRow({ id }) {
  const { data } = useApi(`/admin/orders/${id}`);
  if (!data) return <Spinner />;
  const order = data.order;
  return (
    <div className="order-expand">
      <StatusTimeline order={order} />
      <div>
        <h4>Items</h4>
        <ul className="plain-list">
          {order.items.map((item) => (
            <li key={item.productId}>
              {item.quantity} × {item.name} <span className="muted">· {money(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {order.deliveryAddress && <p className="muted small">📍 {order.deliveryAddress}</p>}
        {order.couponCode && <p className="muted small">🏷️ {order.couponCode} (−{money(order.discountAmount)})</p>}
      </div>
    </div>
  );
}

export default function AdminOrders() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(null);
  const debounced = useDebounced(search);
  const { data, error, loading, reload } = useApi('/admin/orders', { status, search: debounced, page, limit: 25 });

  const update = async (order, next, note) => {
    setBusy(order.id);
    try {
      await api(`/admin/orders/${order.id}/status`, { method: 'PUT', body: { status: next, note } });
      toast.success(`Order #${order.id}: ${STATUS_LABELS[next]}`);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h1>Orders</h1>
      <div className="filter-row">
        <div className="chips-scroll">
          {FILTERS.map((f) => (
            <button key={f || 'all'} className={`chip ${status === f ? 'active' : ''}`} onClick={() => { setStatus(f); setPage(1); }}>
              {f ? STATUS_LABELS[f] : 'All'}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Order #, customer name or email"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          aria-label="Search orders"
        />
      </div>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data && <Spinner />}
      {data && (
        <div className={`card table-card ${loading ? 'dim' : ''}`}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="num">Items</th>
                  <th className="num">Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((order) => {
                  const next = NEXT[order.orderStatus];
                  return (
                    <Fragment key={order.id}>
                      <tr>
                        <td>
                          <button className="link-button" onClick={() => setExpanded(expanded === order.id ? null : order.id)} aria-expanded={expanded === order.id}>
                            #{order.id} {expanded === order.id ? '▾' : '▸'}
                          </button>
                          <span className="muted small block">{dateTime(order.createdAt)}</span>
                        </td>
                        <td>
                          {order.customer?.name}
                          <span className="muted small block">{order.customer?.email}</span>
                        </td>
                        <td className="num">{order.itemCount}</td>
                        <td className="num">{money(order.totalAmount)}</td>
                        <td>
                          <PaymentBadge status={order.paymentStatus} method={order.paymentMethod} />
                        </td>
                        <td>
                          <OrderStatusBadge status={order.orderStatus} />
                        </td>
                        <td className="actions">
                          {next && (
                            <button className="button small" disabled={busy === order.id} onClick={() => update(order, next[0])}>
                              {next[1]}
                            </button>
                          )}
                          {CANCELLABLE.includes(order.orderStatus) && (
                            <button
                              className="link-button danger-text"
                              disabled={busy === order.id}
                              onClick={() => {
                                const note = window.prompt('Reason for cancelling?', 'Item unavailable at store');
                                if (note !== null) update(order, 'CANCELLED', note || undefined);
                              }}
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                      {expanded === order.id && (
                        <tr className="expand-row">
                          <td colSpan={7}>
                            <OrderDetailRow id={order.id} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span className="muted small">{data.total} orders</span>
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
    </div>
  );
}
