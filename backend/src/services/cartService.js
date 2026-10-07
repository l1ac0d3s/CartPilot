const db = require('../db/pool');
const config = require('../config');
const { conflict, notFound } = require('../utils/errors');
const { PRODUCT_COLUMNS, mapProduct } = require('./productService');
const { computeBill } = require('./billingService');
const { findCoupon, isFirstOrder } = require('./couponService');

function lineIssue(row) {
  if (row.deleted_at || !row.is_available) return 'UNAVAILABLE';
  if (row.stock === 0) return 'OUT_OF_STOCK';
  if (row.quantity > row.stock) return 'INSUFFICIENT_STOCK';
  return null;
}

/** Returns the cart with per-line availability issues and a server-computed bill preview. */
async function getCart(userId, { couponCode = null } = {}) {
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS}, p.deleted_at, ci.quantity, ci.added_at
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN categories c ON c.id = p.category_id
      WHERE ci.user_id = $1
      ORDER BY ci.added_at, ci.id`,
    [userId],
  );

  const items = rows.map((row) => {
    const issue = lineIssue(row);
    return {
      product: mapProduct(row),
      quantity: row.quantity,
      lineTotal: Math.round(row.price * row.quantity * 100) / 100,
      issue,
    };
  });

  const billable = rows
    .filter((row) => !lineIssue(row))
    .map((row) => ({ price: row.price, quantity: row.quantity, taxRate: row.tax_rate }));

  const [coupon, firstOrder] = couponCode
    ? await Promise.all([findCoupon(couponCode), isFirstOrder(userId)])
    : [null, false];

  const hasIssues = items.some((item) => item.issue);
  return {
    items,
    bill: computeBill(billable, { coupon, couponCode, isFirstOrder: firstOrder }),
    hasIssues,
    canCheckout: items.length > 0 && !hasIssues,
  };
}

async function loadPurchasableProduct(productId) {
  const { rows } = await db.query(
    'SELECT id, name, stock, is_available, deleted_at FROM products WHERE id = $1',
    [productId],
  );
  const product = rows[0];
  if (!product || product.deleted_at) throw notFound('Product not found');
  if (!product.is_available) throw conflict(`${product.name} is currently unavailable`, { code: 'UNAVAILABLE' });
  if (product.stock === 0) throw conflict(`${product.name} is out of stock`, { code: 'OUT_OF_STOCK' });
  return product;
}

function assertQuantityAllowed(product, quantity) {
  const max = Math.min(product.stock, config.billing.maxQuantityPerItem);
  if (quantity > max) {
    const reason =
      product.stock < config.billing.maxQuantityPerItem
        ? `Only ${product.stock} unit(s) of ${product.name} left in stock`
        : `You can add at most ${max} units of an item`;
    throw conflict(reason, { code: 'QUANTITY_LIMIT', details: { productId: product.id, max } });
  }
}

async function addItem(userId, productId, quantity = 1) {
  const product = await loadPurchasableProduct(productId);
  const existing = await db.query('SELECT quantity FROM cart_items WHERE user_id = $1 AND product_id = $2', [
    userId,
    productId,
  ]);
  assertQuantityAllowed(product, (existing.rows[0]?.quantity || 0) + quantity);
  await db.query(
    `INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = now()`,
    [userId, productId, quantity],
  );
}

async function setQuantity(userId, productId, quantity) {
  if (quantity === 0) return removeItem(userId, productId);
  const product = await loadPurchasableProduct(productId);
  assertQuantityAllowed(product, quantity);
  await db.query(
    `INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`,
    [userId, productId, quantity],
  );
}

async function removeItem(userId, productId) {
  const { rowCount } = await db.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [
    userId,
    productId,
  ]);
  return rowCount > 0;
}

async function clearCart(userId) {
  await db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
}

module.exports = { getCart, addItem, setQuantity, removeItem, clearCart };
