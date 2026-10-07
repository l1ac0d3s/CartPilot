const express = require('express');
const cartService = require('../services/cartService');
const { trackEvent } = require('../services/eventService');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, id } = require('./schemas');

const router = express.Router();
router.use(requireAuth);

const couponQuery = z.object({ coupon: z.string().trim().max(40).optional() });
const addSchema = z.object({ productId: id, quantity: z.number().int().min(1).max(10).default(1) });
const setSchema = z.object({ quantity: z.number().int().min(0).max(10) });
const productParams = z.object({ productId: id });

const respondWithCart = async (req, res, status = 200) =>
  res.status(status).json(await cartService.getCart(req.user.id, { couponCode: req.valid?.query?.coupon }));

router.get('/', validate(couponQuery, 'query'), async (req, res) => respondWithCart(req, res));

router.post('/', validate(addSchema), async (req, res) => {
  const { productId, quantity } = req.valid.body;
  await cartService.addItem(req.user.id, productId, quantity);
  trackEvent({ sessionId: req.sessionId, userId: req.user.id, type: 'add_to_cart', productId });
  await respondWithCart(req, res, 201);
});

router.put('/:productId', validate(productParams, 'params'), validate(setSchema), async (req, res) => {
  const { productId } = req.valid.params;
  const { quantity } = req.valid.body;
  await cartService.setQuantity(req.user.id, productId, quantity);
  if (quantity === 0) trackEvent({ sessionId: req.sessionId, userId: req.user.id, type: 'remove_from_cart', productId });
  await respondWithCart(req, res);
});

router.delete('/:productId', validate(productParams, 'params'), async (req, res) => {
  const { productId } = req.valid.params;
  if (await cartService.removeItem(req.user.id, productId)) {
    trackEvent({ sessionId: req.sessionId, userId: req.user.id, type: 'remove_from_cart', productId });
  }
  await respondWithCart(req, res);
});

router.delete('/', async (req, res) => {
  await cartService.clearCart(req.user.id);
  await respondWithCart(req, res);
});

module.exports = router;
