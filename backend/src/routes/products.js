const express = require('express');
const productService = require('../services/productService');
const { listActiveCoupons } = require('../services/couponService');
const { trackEvent } = require('../services/eventService');
const { optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, idParams, page, limit, boolQuery } = require('./schemas');

const router = express.Router();

const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'name', 'newest']).default('popular'),
  page,
  limit: limit(100, 24),
  inStock: boolQuery,
});

router.get('/products', optionalAuth, validate(listSchema, 'query'), async (req, res) => {
  const query = req.valid.query;
  const result = await productService.listProducts(query);
  if (query.search && query.page === 1) {
    trackEvent({ sessionId: req.sessionId, userId: req.user?.id, type: 'search' });
  }
  res.json(result);
});

router.get('/products/:id', optionalAuth, validate(idParams, 'params'), async (req, res) => {
  const { id } = req.valid.params;
  const [product, frequentlyBoughtTogether] = await Promise.all([
    productService.getProduct(id),
    productService.frequentlyBoughtTogether(id),
  ]);
  trackEvent({ sessionId: req.sessionId, userId: req.user?.id, type: 'product_view', productId: id });
  res.json({ product, frequentlyBoughtTogether });
});

router.get('/categories', async (_req, res) => {
  res.json({ categories: await productService.listCategories() });
});

router.get('/coupons', async (_req, res) => {
  res.json({ coupons: await listActiveCoupons() });
});

module.exports = router;
