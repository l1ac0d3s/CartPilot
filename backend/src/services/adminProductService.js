const crypto = require('crypto');
const db = require('../db/pool');
const { badRequest, notFound } = require('../utils/errors');
const { adjustStock, setStock, syncAlerts } = require('./inventoryService');
const { getProduct } = require('./productService');

// API field -> column for the plain (non-stock) attributes an admin can edit.
const EDITABLE_COLUMNS = {
  name: 'name',
  brand: 'brand',
  unit: 'unit',
  description: 'description',
  categoryId: 'category_id',
  price: 'price',
  mrp: 'mrp',
  costPrice: 'cost_price',
  reorderLevel: 'reorder_level',
  maxStock: 'max_stock',
  isAvailable: 'is_available',
  imageUrl: 'image_url',
};

async function assertCategory(client, categoryId) {
  const { rows } = await client.query('SELECT id FROM categories WHERE id = $1', [categoryId]);
  if (!rows.length) throw badRequest('Unknown category', { code: 'UNKNOWN_CATEGORY' });
}

async function createProduct(input, actorId) {
  const id = await db.withTransaction(async (client) => {
    await assertCategory(client, input.categoryId);
    const sku = input.sku || `CP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const { rows } = await client.query(
      `INSERT INTO products (sku, name, brand, unit, description, category_id, price, mrp, cost_price,
                             stock, reorder_level, max_stock, is_available, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, $11, $12, $13)
       RETURNING id`,
      [
        sku,
        input.name,
        input.brand ?? null,
        input.unit ?? null,
        input.description ?? null,
        input.categoryId,
        input.price,
        input.mrp ?? input.price,
        input.costPrice ?? null,
        input.reorderLevel,
        input.maxStock,
        input.isAvailable,
        input.imageUrl ?? null,
      ],
    );
    const productId = rows[0].id;
    // Opening stock goes through the ledger like every other stock change.
    if (input.stock > 0) {
      await adjustStock(client, { productId, change: input.stock, reason: 'INITIAL', userId: actorId });
    } else {
      await syncAlerts(client, productId, 0, input.reorderLevel);
    }
    return productId;
  });
  return getProduct(id, { admin: true });
}

async function updateProduct(productId, changes, actorId) {
  await db.withTransaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id, stock FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
      [productId],
    );
    if (!rows.length) throw notFound('Product not found');
    if (changes.categoryId !== undefined) await assertCategory(client, changes.categoryId);

    const sets = [];
    const params = [productId];
    for (const [field, column] of Object.entries(EDITABLE_COLUMNS)) {
      if (changes[field] === undefined) continue;
      params.push(changes[field]);
      sets.push(`${column} = $${params.length}`);
    }
    let product = null;
    if (sets.length) {
      const result = await client.query(
        `UPDATE products SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING stock, reorder_level`,
        params,
      );
      product = result.rows[0];
    }

    if (changes.stock !== undefined) {
      await setStock(client, { productId, stock: changes.stock, userId: actorId });
    }
    // A new reorder level can open or close a low-stock alert without any stock movement.
    if (changes.reorderLevel !== undefined && changes.stock === undefined && product) {
      await syncAlerts(client, productId, product.stock, product.reorder_level);
    }
  });
  return getProduct(productId, { admin: true });
}

/** Soft delete: the product disappears from the catalog and carts but order history stays intact. */
async function deleteProduct(productId) {
  await db.withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE products SET deleted_at = now(), is_available = FALSE, updated_at = now()
        WHERE id = $1 AND deleted_at IS NULL`,
      [productId],
    );
    if (!rowCount) throw notFound('Product not found');
    await client.query('DELETE FROM cart_items WHERE product_id = $1', [productId]);
    await client.query('UPDATE inventory_alerts SET resolved_at = now() WHERE product_id = $1 AND resolved_at IS NULL', [
      productId,
    ]);
  });
}

async function storeSummary() {
  const { rows } = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM orders WHERE created_at >= date_trunc('day', now())) AS orders_today,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders
        WHERE created_at >= date_trunc('day', now()) AND order_status <> 'CANCELLED') AS gmv_today,
      (SELECT COUNT(*) FROM orders WHERE order_status IN ('CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY')) AS active_orders,
      (SELECT COUNT(*) FROM orders WHERE order_status = 'CREATED') AS awaiting_payment,
      (SELECT COUNT(*) FROM inventory_alerts a JOIN products p ON p.id = a.product_id
        WHERE a.resolved_at IS NULL AND a.alert_type = 'LOW_STOCK' AND p.deleted_at IS NULL) AS low_stock_alerts,
      (SELECT COUNT(*) FROM inventory_alerts a JOIN products p ON p.id = a.product_id
        WHERE a.resolved_at IS NULL AND a.alert_type = 'OUT_OF_STOCK' AND p.deleted_at IS NULL) AS out_of_stock_alerts,
      (SELECT COUNT(*) FROM products WHERE deleted_at IS NULL) AS products,
      (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers`);
  const row = rows[0];
  return {
    ordersToday: row.orders_today,
    gmvToday: row.gmv_today,
    activeOrders: row.active_orders,
    awaitingPayment: row.awaiting_payment,
    lowStockAlerts: row.low_stock_alerts,
    outOfStockAlerts: row.out_of_stock_alerts,
    products: row.products,
    customers: row.customers,
  };
}

module.exports = { createProduct, updateProduct, deleteProduct, storeSummary };
