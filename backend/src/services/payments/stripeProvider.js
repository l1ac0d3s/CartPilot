const Stripe = require('stripe');
const config = require('../../config');
const { toPaise } = require('../../utils/money');

let client = null;
function stripe() {
  if (!client) client = new Stripe(config.stripe.secretKey);
  return client;
}

/** Stripe Checkout (hosted payment page). Payment is confirmed by webhook or by verify-on-return. */
module.exports = {
  name: 'stripe',

  async createCheckout(order, { email } = {}) {
    const session = await stripe().checkout.sessions.create({
      mode: 'payment',
      client_reference_id: String(order.id),
      customer_email: email || undefined,
      metadata: { orderId: String(order.id) },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: config.stripe.currency,
            unit_amount: toPaise(order.total_amount),
            product_data: { name: `CartPilot order #${order.id}` },
          },
        },
      ],
      // Stripe requires expiry to be at least 30 minutes away.
      expires_at: Math.floor(Date.now() / 1000) + Math.max(30, config.orders.paymentTimeoutMinutes) * 60,
      success_url: `${config.frontendUrl}/orders/${order.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/orders/${order.id}?payment=cancelled`,
    });
    return { ref: session.id, checkoutUrl: session.url };
  },

  /** Normalises a Checkout Session into { status, orderId }. */
  async retrieve(ref) {
    const session = await stripe().checkout.sessions.retrieve(ref);
    let status = 'PENDING';
    if (session.payment_status === 'paid') status = 'SUCCEEDED';
    else if (session.status === 'expired') status = 'EXPIRED';
    return { status, orderId: Number(session.metadata?.orderId), paymentIntent: session.payment_intent };
  },

  async refund(ref) {
    const session = await stripe().checkout.sessions.retrieve(ref);
    if (!session.payment_intent) return { ok: false };
    await stripe().refunds.create({ payment_intent: session.payment_intent });
    return { ok: true };
  },

  constructEvent(rawBody, signature) {
    return stripe().webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
  },
};
