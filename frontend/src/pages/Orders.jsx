import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { OrderStatusBadge } from '../components/StatusBadge';
import { EmptyState, ErrorNote, Spinner } from '../components/Feedback';
import { dateTime, money } from '../utils/format';
import { useApi } from '../utils/useApi';

export default function Orders() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi('/orders', { page, limit: 10 });
  const { setCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const reorder = async (orderId) => {
    try {
      const result = await api(`/orders/${orderId}/reorder`, { method: 'POST' });
      setCart(result.cart);
      toast.success(`Added ${result.added.length} item(s) to your cart`);
      if (result.skipped.length) toast.show(`${result.skipped.length} item(s) unavailable`);
      navigate('/cart');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading && !data) return <Spinner />;
  if (data && !data.items.length) {
    return (
      <EmptyState icon="📦" title="No orders yet" action={<Link to="/" className="button">Start shopping</Link>} />
    );
  }

  return (
    <div className="page narrow">
      <h1>Your orders</h1>
      <ErrorNote error={error} onRetry={reload} />
      <ul className="order-list">
        {data?.items.map((order) => (
          <li key={order.id} className="card order-card">
            <div className="order-card-head">
              <div>
                <Link to={`/orders/${order.id}`} className="order-id">
                  Order #{order.id}
                </Link>
                <span className="muted small">{dateTime(order.createdAt)}</span>
              </div>
              <OrderStatusBadge status={order.orderStatus} />
            </div>
            <p className="order-preview">
              {order.items
                .slice(0, 4)
                .map((i) => `${i.quantity} × ${i.name}`)
                .join(', ')}
              {order.items.length > 4 && ` +${order.items.length - 4} more`}
            </p>
            <div className="order-card-foot">
              <strong>{money(order.totalAmount)}</strong>
              <div className="row-gap">
                <button className="button secondary small" onClick={() => reorder(order.id)}>
                  Reorder
                </button>
                <Link className="button small" to={`/orders/${order.id}`}>
                  {order.canPay ? 'Complete payment' : 'View details'}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {data?.totalPages > 1 && (
        <div className="pagination">
          <button className="button secondary small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span className="muted">
            Page {page} of {data.totalPages}
          </span>
          <button className="button secondary small" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}
