const express = require('express');
const orderService = require('../services/orderService');
const cartService = require('../services/cartService');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ORDER_STATUSES } = require('../services/orderLifecycle');
const { z, idParams, page, limit } = require('./schemas');

const router = express.Router();
router.use(requireAuth);

const createSchema = z.object({
  couponCode: z.string().trim().max(40).nullish(),
  paymentMethod: z.enum(['online', 'cod']).default('online'),
  deliveryAddress: z.string().trim().max(300).nullish(),
});
const listSchema = z.object({ page, limit: limit(50, 10), status: z.enum(ORDER_STATUSES).optional() });
const cancelSchema = z.object({ reason: z.string().trim().max(200).optional() });

router.post('/', validate(createSchema), async (req, res) => {
  const result = await orderService.createOrder(req.user, req.valid.body, { sessionId: req.sessionId });
  res.status(201).json(result);
});

router.get('/', validate(listSchema, 'query'), async (req, res) => {
  res.json(await orderService.listOrders({ ...req.valid.query, userId: req.user.id }));
});

router.get('/:id', validate(idParams, 'params'), async (req, res) => {
  res.json({ order: await orderService.getOrder(req.valid.params.id, { userId: req.user.id }) });
});

router.post('/:id/cancel', validate(idParams, 'params'), validate(cancelSchema), async (req, res) => {
  const order = await orderService.cancelOrder(req.valid.params.id, {
    userId: req.user.id,
    actorId: req.user.id,
    reason: req.valid.body.reason || 'Cancelled by customer',
  });
  res.json({ order });
});

router.post('/:id/reorder', validate(idParams, 'params'), async (req, res) => {
  const result = await orderService.reorder(req.valid.params.id, req.user.id);
  res.json({ ...result, cart: await cartService.getCart(req.user.id) });
});

module.exports = router;
