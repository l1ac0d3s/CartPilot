const db = require('../db/pool');
const { conflict, notFound } = require('../utils/errors');

/**
 * Opens / resolves low-stock and out-of-stock alerts so that they always reflect the
 * current stock level. Must run in the same transaction as the stock change.
 */
async function syncAlerts(client, productId, stock, reorderLevel) {
  const open = async (type) =>
    client.query(
      `INSERT INTO inventory_alerts (product_id, alert_type, stock_level, reorder_level)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (product_id, alert_type) WHERE resolved_at IS NULL DO NOTHING`,
      [productId, type, stock, reorderLevel],
    );
  const resolve = async (type) =>
    client.query(
      `UPDATE inventory_alerts SET resolved_at = now()
        WHERE product_id = $1 AND alert_type = $2 AND resolved_at IS NULL`,
      [productId, type],
    );

  if (stock <= reorderLevel) await open('LOW_STOCK');
  else await resolve('LOW_STOCK');

  if (stock === 0) await open('OUT_OF_STOCK');
  else await resolve('OUT_OF_STOCK');
}

/**
 * Applies a relative stock change, writes a ledger row and keeps alerts in sync.
 * Rejects changes that would make stock negative.
 */
async function adjustStock(client, { productId, change, reason, referenceId = null, userId = null }) {
  const { rows } = await client.query(
    `UPDATE products SET stock = stock + $2, updated_at = now()
      WHERE id = $1 AND stock + $2 >= 0
      RETURNING id, name, stock, reorder_level`,
    [productId, change],
  );
  if (!rows.length) {
    const exists = await client.query('SELECT stock FROM products WHERE id = $1', [productId]);
    if (!exists.rows.length) throw notFound('Product not found');
    throw conflict('Insufficient stock', { code: 'INSUFFICIENT_STOCK', details: { productId } });
  }
  const product = rows[0];
  await client.query(
    `INSERT INTO inventory_movements (product_id, change, reason, reference_id, stock_after, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [productId, change, reason, referenceId, product.stock, userId],
  );
  await syncAlerts(client, productId, product.stock, product.reorder_level);
  return product;
}

/** Sets stock to an absolute level (admin edits), recording the delta in the ledger. */
async function setStock(client, { productId, stock, userId = null }) {
  const { rows } = await client.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [productId]);
  if (!rows.length) throw notFound('Product not found');
  const change = stock - rows[0].stock;
  if (change === 0) return null;
  return adjustStock(client, {
    productId,
    change,
    reason: change > 0 ? 'RESTOCK' : 'ADJUSTMENT',
    userId,
  });
}

async function listAlerts({ status = 'open', limit = 100 } = {}) {
  const where = status === 'open' ? 'a.resolved_at IS NULL' : status === 'resolved' ? 'a.resolved_at IS NOT NULL' : 'TRUE';
  const { rows } = await db.query(
    `SELECT a.id, a.alert_type, a.stock_level, a.reorder_level, a.created_at, a.resolved_at,
            p.id AS product_id, p.name AS product_name, p.sku, p.stock AS current_stock, p.max_stock,
            c.name AS category_name, c.icon AS category_icon
       FROM inventory_alerts a
       JOIN products p ON p.id = a.product_id
       JOIN categories c ON c.id = p.category_id
      WHERE ${where} AND p.deleted_at IS NULL
      ORDER BY (a.alert_type = 'OUT_OF_STOCK') DESC, a.created_at DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    type: row.alert_type,
    stockAtAlert: row.stock_level,
    reorderLevel: row.reorder_level,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    product: {
      id: row.product_id,
      name: row.product_name,
      sku: row.sku,
      stock: row.current_stock,
      maxStock: row.max_stock,
      category: row.category_name,
      icon: row.category_icon,
    },
  }));
}

async function listMovements(productId, limit = 50) {
  const { rows } = await db.query(
    `SELECT id, change, reason, reference_id, stock_after, created_at
       FROM inventory_movements WHERE product_id = $1
      ORDER BY created_at DESC, id DESC LIMIT $2`,
    [productId, limit],
  );
  return rows.map((row) => ({
    id: row.id,
    change: row.change,
    reason: row.reason,
    referenceId: row.reference_id,
    stockAfter: row.stock_after,
    createdAt: row.created_at,
  }));
}

module.exports = { adjustStock, setStock, syncAlerts, listAlerts, listMovements };
