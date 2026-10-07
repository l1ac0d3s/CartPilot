const db = require('../db/pool');
const config = require('../config');
const { activeProvider, getProvider } = require('./payments');
const stripeProvider = require('./payments/stripeProvider');
const { recordStatus } = require('./orderLifecycle');
const { badRequest, conflict, notFound } = require('../utils/errors');

function isPayable(order) {
  return (
    order.payment_method === 'online' &&
    order.order_status === 'CREATED' &&
    ['PENDING', 'FAILED'].includes(order.payment_status)
  );
}

async function loadUserOrder(orderId, userId) {
  const { rows } = await db.query('SELECT * FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
  if (!rows.length) throw notFound('Order not found');
  return rows[0];
}

/** Creates a hosted checkout with the active provider and records a PENDING payment attempt. */
async function startCheckout(order, { email } = {}) {
  if (!isPayable(order)) throw conflict('This order is not awaiting payment', { code: 'NOT_PAYABLE' });
  const provider = activeProvider();
  const { ref, checkoutUrl } = await provider.createCheckout(order, { email });

  await db.withTransaction(async (client) => {
    // A new attempt supersedes any earlier unfinished one.
    await client.query(
      "UPDATE payments SET status = 'EXPIRED', updated_at = now() WHERE order_id = $1 AND status = 'PENDING'",
      [order.id],
    );
    await client.query(
      'INSERT INTO payments (order_id, provider, provider_ref, amount, currency) VALUES ($1, $2, $3, $4, $5)',
      [order.id, provider.name, ref, order.total_amount, config.stripe.currency],
    );
  });
  return { provider: provider.name, checkoutUrl, ref };
}

async function startCheckoutForUser(orderId, user) {
  const order = await loadUserOrder(orderId, user.id);
  return startCheckout(order, { email: user.email });
}

async function refundPayment(payment) {
  const provider = getProvider(payment.provider);
  if (provider && payment.provider_ref) await provider.refund(payment.provider_ref);
  await db.query("UPDATE payments SET status = 'REFUNDED', updated_at = now() WHERE id = $1", [payment.id]);
}

/** Refunds every successful online payment for an order (used when a paid order is cancelled). */
async function refundOrder(orderId) {
  const { rows } = await db.query(
    "SELECT * FROM payments WHERE order_id = $1 AND status = 'SUCCEEDED' AND provider <> 'cod'",
    [orderId],
  );
  for (const payment of rows) await refundPayment(payment);
  await db.query("UPDATE orders SET payment_status = 'REFUNDED', updated_at = now() WHERE id = $1", [orderId]);
}

/**
 * Marks a payment attempt as succeeded and confirms the order. Idempotent, so it is safe for
 * the Stripe webhook and the verify-on-return call to both deliver the same success.
 */
async function markPaid(orderId, { provider, ref }) {
  const outcome = await db.withTransaction(async (client) => {
    const { rows: orders } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!orders.length) throw notFound('Order not found');
    const order = orders[0];

    const { rows: payments } = await client.query(
      'SELECT * FROM payments WHERE order_id = $1 AND provider = $2 AND provider_ref = $3 FOR UPDATE',
      [orderId, provider, ref],
    );
    if (!payments.length) throw notFound('Payment attempt not found');
    const payment = payments[0];
    if (['SUCCEEDED', 'REFUNDED'].includes(payment.status)) return { duplicate: true };

    await client.query(
      "UPDATE payments SET status = 'SUCCEEDED', failure_reason = NULL, updated_at = now() WHERE id = $1",
      [payment.id],
    );

    // Paid twice, or paid after the order already expired: give the money back.
    if (order.payment_status === 'PAID' || order.order_status === 'CANCELLED') {
      return { refund: payment };
    }

    await client.query(
      "UPDATE orders SET payment_status = 'PAID', order_status = 'CONFIRMED', updated_at = now() WHERE id = $1",
      [orderId],
    );
    await recordStatus(client, orderId, 'CONFIRMED', `Payment received via ${provider}`);
    return { confirmed: true };
  });

  if (outcome.refund) await refundPayment(outcome.refund);
  return outcome;
}

async function markFailed(orderId, { provider, ref, reason, status = 'FAILED' }) {
  await db.withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE payments SET status = $4, failure_reason = $5, updated_at = now()
        WHERE order_id = $1 AND provider = $2 AND provider_ref = $3 AND status = 'PENDING'
        RETURNING id`,
      [orderId, provider, ref, status, reason],
    );
    if (!rows.length) return;
    await client.query(
      `UPDATE orders SET payment_status = 'FAILED', updated_at = now()
        WHERE id = $1 AND order_status = 'CREATED' AND payment_status = 'PENDING'`,
      [orderId],
    );
  });
}

/** Demo-mode endpoint backing the frontend's simulated payment page. */
async function confirmMockPayment(orderId, user, { ref, success }) {
  await loadUserOrder(orderId, user.id);
  const { rows } = await db.query(
    `SELECT provider_ref FROM payments
      WHERE order_id = $1 AND provider = 'mock' AND status = 'PENDING' AND ($2::text IS NULL OR provider_ref = $2)
      ORDER BY created_at DESC LIMIT 1`,
    [orderId, ref || null],
  );
  if (!rows.length) throw conflict('No pending payment for this order', { code: 'NO_PENDING_PAYMENT' });
  const paymentRef = rows[0].provider_ref;
  if (success) await markPaid(orderId, { provider: 'mock', ref: paymentRef });
  else await markFailed(orderId, { provider: 'mock', ref: paymentRef, reason: 'Payment declined (simulated)' });
}

/** Called when the customer returns from Stripe Checkout, so confirmation doesn't depend on webhooks alone. */
async function verifyStripePayment(orderId, user, sessionId) {
  await loadUserOrder(orderId, user.id);
  const { rows } = await db.query(
    "SELECT id FROM payments WHERE order_id = $1 AND provider = 'stripe' AND provider_ref = $2",
    [orderId, sessionId],
  );
  if (!rows.length) throw notFound('Payment attempt not found');

  const session = await stripeProvider.retrieve(sessionId);
  if (session.status === 'SUCCEEDED') await markPaid(orderId, { provider: 'stripe', ref: sessionId });
  else if (session.status === 'EXPIRED') {
    await markFailed(orderId, { provider: 'stripe', ref: sessionId, reason: 'Checkout expired', status: 'EXPIRED' });
  }
  return session.status;
}

async function handleStripeWebhook(rawBody, signature) {
  if (!config.stripe.webhookSecret) throw badRequest('Stripe webhook secret is not configured');
  let event;
  try {
    event = stripeProvider.constructEvent(rawBody, signature);
  } catch (err) {
    throw badRequest(`Webhook signature verification failed: ${err.message}`);
  }

  const session = event.data.object;
  const orderId = Number(session.metadata?.orderId);
  if (!orderId) return { ignored: true };
  const ref = { provider: 'stripe', ref: session.id };

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (session.payment_status === 'paid') await markPaid(orderId, ref);
        break;
      case 'checkout.session.async_payment_failed':
        await markFailed(orderId, { ...ref, reason: 'Payment failed' });
        break;
      case 'checkout.session.expired':
        await markFailed(orderId, { ...ref, reason: 'Checkout expired', status: 'EXPIRED' });
        break;
      default:
        return { ignored: true };
    }
  } catch (err) {
    // Unknown order/payment: acknowledge so Stripe stops retrying, but leave a trace.
    if (err.status === 404) {
      console.warn(`stripe webhook ${event.type} for unknown payment ${session.id}`);
      return { ignored: true };
    }
    throw err;
  }
  return { handled: event.type };
}

module.exports = {
  isPayable,
  startCheckout,
  startCheckoutForUser,
  markPaid,
  markFailed,
  refundOrder,
  confirmMockPayment,
  verifyStripePayment,
  handleStripeWebhook,
};
