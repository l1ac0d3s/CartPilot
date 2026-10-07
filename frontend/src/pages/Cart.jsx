import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, trackEvent } from '../api/client';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import BillSummary from '../components/BillSummary';
import ProductVisual from '../components/ProductVisual';
import QuantityStepper from '../components/QuantityStepper';
import Recommendations from '../components/Recommendations';
import { EmptyState } from '../components/Feedback';
import { money } from '../utils/format';
import { useApi } from '../utils/useApi';

const ISSUE_TEXT = {
  OUT_OF_STOCK: 'Out of stock',
  UNAVAILABLE: 'No longer available',
  INSUFFICIENT_STOCK: 'Not enough stock',
};

export default function Cart() {
  const { cart, refresh, remove } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: couponData } = useApi('/coupons');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('online');
  const [placing, setPlacing] = useState(false);
  const tracked = useRef(false);

  // Re-price the cart whenever the coupon or the cart contents change.
  const itemsKey = cart.items.map((i) => `${i.product.id}:${i.quantity}`).join(',');
  useEffect(() => {
    refresh(coupon || undefined).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon, itemsKey]);

  useEffect(() => {
    if (cart.items.length && !tracked.current) {
      tracked.current = true;
      trackEvent('checkout_started');
    }
  }, [cart.items.length]);

  const bill = cart.bill;
  const couponState = bill?.coupon;

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const { order, payment } = await api('/orders', {
        method: 'POST',
        body: {
          couponCode: couponState?.applied ? couponState.code : undefined,
          paymentMethod,
          deliveryAddress: address || undefined,
        },
      });
      await refresh();
      if (payment?.checkoutUrl) {
        if (payment.provider === 'stripe') {
          window.location.assign(payment.checkoutUrl);
          return;
        }
        navigate(new URL(payment.checkoutUrl).pathname + new URL(payment.checkoutUrl).search);
      } else {
        if (payment?.error) toast.error(payment.error);
        navigate(`/orders/${order.id}?placed=1`);
      }
    } catch (err) {
      toast.error(err.message);
      refresh(coupon || undefined).catch(() => {});
    } finally {
      setPlacing(false);
    }
  };

  if (!cart.items.length) {
    return (
      <div className="page">
        <EmptyState
          title="Your cart is empty"
          action={
            <Link to="/" className="button">
              Start shopping
            </Link>
          }
        >
          Add a few things — we&apos;ll suggest the rest of your usual basket.
        </EmptyState>
        <Recommendations title="Buy it again" />
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Your cart</h1>
      <div className="cart-layout">
        <div className="cart-main">
          {bill?.amountToFreeDelivery > 0 && (
            <div className="free-delivery">
              <span>
                Add <strong>{money(bill.amountToFreeDelivery)}</strong> more for free delivery
              </span>
              <span className="progress" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (bill.subtotal / bill.freeDeliveryThreshold) * 100)}%` }} />
              </span>
            </div>
          )}
          <ul className="cart-items">
            {cart.items.map((item) => (
              <li key={item.product.id} className={item.issue ? 'has-issue' : ''}>
                <ProductVisual product={item.product} size="sm" />
                <div className="cart-item-info">
                  <Link to={`/products/${item.product.id}`}>{item.product.name}</Link>
                  <span className="muted small">{item.product.unit}</span>
                  {item.issue && (
                    <span className="issue">
                      {ISSUE_TEXT[item.issue]} ·{' '}
                      <button className="link-button" onClick={() => remove(item.product.id)}>
                        Remove
                      </button>
                    </span>
                  )}
                </div>
                <QuantityStepper product={item.product} compact />
                <strong className="cart-line-total">{money(item.lineTotal)}</strong>
              </li>
            ))}
          </ul>
          <Recommendations />
        </div>

        <aside className="cart-side">
          <section className="card">
            <h2 className="h3">Coupons</h2>
            <form
              className="coupon-form"
              onSubmit={(e) => {
                e.preventDefault();
                setCoupon(couponInput.trim().toUpperCase());
              }}
            >
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder="Enter coupon code"
                aria-label="Coupon code"
              />
              <button className="button secondary" type="submit">
                Apply
              </button>
            </form>
            {couponState && (
              <p className={couponState.applied ? 'coupon-ok' : 'coupon-bad'}>
                {couponState.applied ? '✓ ' : '✕ '}
                {couponState.code}: {couponState.message}
                {couponState.applied && (
                  <button
                    className="link-button"
                    onClick={() => {
                      setCoupon('');
                      setCouponInput('');
                    }}
                  >
                    Remove
                  </button>
                )}
              </p>
            )}
            <ul className="coupon-list">
              {(couponData?.coupons || []).map((c) => (
                <li key={c.code}>
                  <button
                    className="coupon-chip"
                    onClick={() => {
                      setCouponInput(c.code);
                      setCoupon(c.code);
                    }}
                  >
                    <strong>{c.code}</strong>
                    <span>{c.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2 className="h3">Bill details</h2>
            <BillSummary bill={{ ...bill, couponCode: couponState?.applied ? couponState.code : null }} />
          </section>

          <section className="card">
            <h2 className="h3">Delivery & payment</h2>
            <label className="field">
              <span>Delivery address</span>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Flat, building, area"
                maxLength={300}
              />
            </label>
            <fieldset className="radio-group">
              <legend>Payment method</legend>
              <label>
                <input
                  type="radio"
                  name="payment"
                  value="online"
                  checked={paymentMethod === 'online'}
                  onChange={() => setPaymentMethod('online')}
                />
                Pay online (card / UPI)
              </label>
              <label>
                <input
                  type="radio"
                  name="payment"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                />
                Cash on delivery
              </label>
            </fieldset>
            {cart.hasIssues && <p className="coupon-bad">Remove unavailable items to continue.</p>}
            <button className="button block" onClick={placeOrder} disabled={!cart.canCheckout || placing}>
              {placing ? 'Placing order…' : `Place order · ${money(bill?.total)}`}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
