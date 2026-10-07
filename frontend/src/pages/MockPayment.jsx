import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { Spinner } from '../components/Feedback';
import { money } from '../utils/format';
import { useApi } from '../utils/useApi';

/** Demo payment gateway used when Stripe keys are not configured. */
export default function MockPayment() {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading } = useApi(`/orders/${orderId}`);
  const [busy, setBusy] = useState(false);

  const pay = async (success) => {
    setBusy(true);
    try {
      await api(`/payments/${orderId}/mock-confirm`, {
        method: 'POST',
        body: { success, ref: params.get('ref') || undefined },
      });
      navigate(`/orders/${orderId}?payment=${success ? 'success' : 'failed'}`);
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  if (loading && !data) return <Spinner />;
  const order = data?.order;
  return (
    <div className="page narrow">
      <div className="card pay-card">
        <p className="pill">🔒 CartPilot Pay · test mode</p>
        <h1>Pay {money(order?.totalAmount)}</h1>
        <p className="muted">
          Order #{orderId} · {order?.items?.length} items
        </p>
        <p className="small muted">
          This is a simulated gateway for demos. Configure <code>STRIPE_SECRET_KEY</code> on the API to use real Stripe
          Checkout instead.
        </p>
        <div className="pay-actions">
          <button className="button block" disabled={busy || !order?.canPay} onClick={() => pay(true)}>
            Pay now
          </button>
          <button className="button secondary block" disabled={busy || !order?.canPay} onClick={() => pay(false)}>
            Simulate a failed payment
          </button>
        </div>
        {order && !order.canPay && <p className="muted small">This order is not awaiting payment.</p>}
      </div>
    </div>
  );
}
