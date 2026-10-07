const express = require('express');
const productService = require('../services/productService');
const adminProductService = require('../services/adminProductService');
const inventoryService = require('../services/inventoryService');
const orderService = require('../services/orderService');
const { ORDER_STATUSES } = require('../services/orderLifecycle');
const { requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z, id, idParams, page, limit, boolQuery } = require('./schemas');

const router = express.Router();
router.use(requireAdmin);

const money = z.number().min(0).max(1_000_000);
const productFields = {
  sku: z.string().trim().min(2).max(40).optional(),
  name: z.string().trim().min(2).max(160),
  brand: z.string().trim().max(80).nullish(),
  unit: z.string().trim().max(40).nullish(),
  description: z.string().trim().max(2000).nullish(),
  categoryId: id,
  price: money,
  mrp: money.nullish(),
  costPrice: money.nullish(),
  stock: z.number().int().min(0).max(100_000),
  reorderLevel: z.number().int().min(0).max(10_000),
  maxStock: z.number().int().min(1).max(100_000),
  isAvailable: z.boolean(),
  imageUrl: z.string().trim().url().max(500).nullish(),
};

const createSchema = z.object({
  ...productFields,
  stock: productFields.stock.default(0),
  reorderLevel: productFields.reorderLevel.default(10),
  maxStock: productFields.maxStock.default(100),
  isAvailable: productFields.isAvailable.default(true),
});
const { sku: _sku, ...editableFields } = productFields;
const updateSchema = z
  .object(editableFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update');

const listSchema = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  sort: z.enum(['popular', 'price_asc', 'price_desc', 'name', 'stock_asc', 'newest']).default('name'),
  lowStock: boolQuery,
  page,
  limit: limit(200, 50),
});

// ---- Products & inventory -------------------------------------------------

router.get('/summary', async (_req, res) => {
  res.json(await adminProductService.storeSummary());
});

router.get('/products', validate(listSchema, 'query'), async (req, res) => {
  res.json(await productService.listProducts({ ...req.valid.query, admin: true }));
});

router.get('/products/:id', validate(idParams, 'params'), async (req, res) => {
  const { id: productId } = req.valid.params;
  const [product, movements] = await Promise.all([
    productService.getProduct(productId, { admin: true }),
    inventoryService.listMovements(productId),
  ]);
  res.json({ product, movements });
});

router.post('/products', validate(createSchema), async (req, res) => {
  res.status(201).json({ product: await adminProductService.createProduct(req.valid.body, req.user.id) });
});

router.put('/products/:id', validate(idParams, 'params'), validate(updateSchema), async (req, res) => {
  const product = await adminProductService.updateProduct(req.valid.params.id, req.valid.body, req.user.id);
  res.json({ product });
});

router.delete('/products/:id', validate(idParams, 'params'), async (req, res) => {
  await adminProductService.deleteProduct(req.valid.params.id);
  res.status(204).end();
});

router.get(
  '/alerts',
  validate(z.object({ status: z.enum(['open', 'resolved', 'all']).default('open') }), 'query'),
  async (req, res) => {
    res.json({ alerts: await inventoryService.listAlerts(req.valid.query) });
  },
);

// ---- Orders ------------------------------------------------------------------

router.get(
  '/orders',
  validate(
    z.object({ status: z.enum(ORDER_STATUSES).optional(), search: z.string().trim().max(100).optional(), page, limit: limit(100, 25) }),
    'query',
  ),
  async (req, res) => {
    res.json(await orderService.listOrders(req.valid.query));
  },
);

router.get('/orders/:id', validate(idParams, 'params'), async (req, res) => {
  res.json({ order: await orderService.getOrder(req.valid.params.id, { admin: true }) });
});

router.put(
  '/orders/:id/status',
  validate(idParams, 'params'),
  validate(z.object({ status: z.enum(ORDER_STATUSES), note: z.string().trim().max(200).optional() })),
  async (req, res) => {
    const { status, note } = req.valid.body;
    const order = await orderService.updateStatus(req.valid.params.id, status, { actorId: req.user.id, note });
    res.json({ order });
  },
);

module.exports = router;
