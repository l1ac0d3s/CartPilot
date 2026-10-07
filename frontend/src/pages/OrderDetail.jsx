import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import BillSummary from '../components/BillSummary';
import StatusTimeline from '../components/StatusTimeline';
import { OrderStatusBadge, PaymentBadge } from '../components/StatusBadge';
import { EmptyState, Spinner } from '../components/Feedback';
import { dateTime, money, time } from '../utils/format';
import { useApi } from '../utils/useApi';

const LIVE_STATUSES = ['CREATED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY'];

export default function OrderDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { setCart } = useCart();
  const { data, error, loading, reload, setData } = useApi(`/orders/${id}`);
  const [busy, setBusy] = useState(false);
  const verified = useRef(false);

  // Returning from Stripe Checkout: confirm the session server-side (the webhook may lag).
  useEffect(() => {
    const sessionId = params.get('session_id');
    if (params.get('payment') === 'success' && sessionId && !verified.current) {
      verified.current = true;
      api(`/payments/${id}/verify`, { method: 'POST', body: { sessionId } })
        .then((result) => setData({ order: result.order }))
        .catch((err) => toast.error(err.message));
    }
  }, [params, id, setData, toast]);

  const announced = useRef(false);
  useEffect(() => {
    if (announced.current) return; // StrictMode runs effects twice in development
    announced.current = true;
    const payment = params.get('payment');
    if (payment === 'success') toast.success('Payment successful — your order is confirmed!');
    if (payment === 'failed') toast.error('Payment failed. You can retry below.');
    if (payment === 'cancelled') toast.show('Payment cancelled. You can retry below.');
    if (params.get('placed')) toast.success('Order placed!');
    if (payment || params.get('placed')) setParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll while the order is moving so admin status updates show up live.
  const status = data?.order?.orderStatus;
  useEffect(() => {
    if (!LIVE_STATUSES.includes(status)) return undefined;
    const handle = setInterval(reload, 10000);
    return () => clearInterval(handle);
  }, [status, reload]);

  const act = async (fn, successMessage) => {
    setBusy(true);
    try {
      await fn();
      if (successMessage) toast.success(successMessage);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Spinner />;
  if (error) {
    return <EmptyState icon="📦" title="Order not found" action={<Link to="/orders" className="button">My orders</Link>} />;
  }
  const order = data.order;
  const bill = {
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    tax: order.taxAmount,
    discount: order.discountAmount,
    total: order.totalAmount,
    couponCode: order.couponCode,
  };

  const retryPayment = () =>
    act(async () => {
      const { payment } = await api(`/payments/${order.id}/checkout`, { method: 'POST' });
      if (payment.provider === 'stripe') window.location.assign(payment.checkoutUrl);
      else navigate(new URL(payment.checkoutUrl).pathname + new URL(payment.checkoutUrl).search);
    });
  const cancel = () =>
    act(async () => {
      if (!window.confirm('Cancel this order?')) return;
      const result = await api(`/orders/${order.id}/cancel`, { method: 'POST', body: {} });
      setData({ order: result.order });
    }, 'Order cancelled');
  const reorder = () =>
    act(async () => {
      const result = await api(`/orders/${order.id}/reorder`, { method: 'POST' });
      setCart(result.cart);
      navigate('/cart');
    });

  return (
    <div className="page narrow">
      <Link to="/orders" className="muted small">
        ← All orders
      </Link>
      <div className="order-head">
        <div>
          <h1>Order #{order.id}</h1>
          <p className="muted">Placed {dateTime(order.createdAt)}</p>
        </div>
        <OrderStatusBadge status={order.orderStatus} />
      </div>

      {order.canPay && (
        <div className="card attention">
          <div>
            <strong>Payment pending</strong>
            <p className="muted small">
              {order.paymentStatus === 'FAILED' ? 'Your last payment attempt failed. ' : ''}
              Complete payment by {time(order.paymentDeadline)} or the order will be cancelled automatically.
            </p>
          </div>
          <button className="button" onClick={retryPayment} disabled={busy}>
            Pay {money(order.totalAmount)}
          </button>
        </div>
      )}

      <div className="order-grid">
        <section className="card">
          <h2 className="h3">Order status</h2>
          <StatusTimeline order={order} />
        </section>

        <section className="card">
          <h2 className="h3">Payment</h2>
          <p className="row-between">
            <span>{order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online payment'}</span>
            <PaymentBadge status={order.paymentStatus} method={order.paymentMethod} />
          </p>
          {order.deliveryAddress && (
            <>
              <h2 className="h3">Delivering to</h2>
              <p>{order.deliveryAddress}</p>
            </>
          )}
          <BillSummary bill={bill} compact />
        </section>
      </div>

      <section className="card">
        <h2 className="h3">{order.items.length} items</h2>
        <ul className="order-items">
          {order.items.map((item) => (
            <li key={item.productId}>
              <span className="order-item-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="grow">
                <Link to={`/products/${item.productId}`}>{item.name}</Link>
                <span className="muted small">
                  {item.unit} · {item.quantity} × {money(item.price)}
                </span>
              </span>
              <strong>{money(item.lineTotal)}</strong>
            </li>
          ))}
        </ul>
      </section>

      <div className="row-gap">
        <button className="button" onClick={reorder} disabled={busy}>
          Reorder these items
        </button>
        {order.canCancel && (
          <button className="button danger" onClick={cancel} disabled={busy}>
            Cancel order
          </button>
        )}
      </div>
    </div>
  );
}
