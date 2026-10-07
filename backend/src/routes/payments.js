const express = require('express');
const paymentService = require('../services/paymentService');
const orderService = require('../services/orderService');
const { activeProvider } = require('../services/payments');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, id } = require('./schemas');

const router = express.Router();
const orderParams = z.object({ orderId: id });

router.get('/config', (_req, res) => {
  res.json({ provider: activeProvider().name });
});

router.post('/:orderId/checkout', requireAuth, validate(orderParams, 'params'), async (req, res) => {
  const payment = await paymentService.startCheckoutForUser(req.valid.params.orderId, req.user);
  res.status(201).json({ payment });
});

router.post(
  '/:orderId/mock-confirm',
  requireAuth,
  validate(orderParams, 'params'),
  validate(z.object({ success: z.boolean(), ref: z.string().max(100).optional() })),
  async (req, res) => {
    const { orderId } = req.valid.params;
    await paymentService.confirmMockPayment(orderId, req.user, req.valid.body);
    res.json({ order: await orderService.getOrder(orderId, { userId: req.user.id }) });
  },
);

router.post(
  '/:orderId/verify',
  requireAuth,
  validate(orderParams, 'params'),
  validate(z.object({ sessionId: z.string().min(1).max(200) })),
  async (req, res) => {
    const { orderId } = req.valid.params;
    const status = await paymentService.verifyStripePayment(orderId, req.user, req.valid.body.sessionId);
    res.json({ status, order: await orderService.getOrder(orderId, { userId: req.user.id }) });
  },
);

/** Stripe webhook: mounted with a raw body parser in app.js so the signature can be verified. */
async function stripeWebhook(req, res) {
  const result = await paymentService.handleStripeWebhook(req.body, req.get('stripe-signature'));
  res.json({ received: true, ...result });
}

module.exports = { router, stripeWebhook };
