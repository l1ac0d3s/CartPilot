const db = require('../db/pool');

async function findCoupon(code, client = db) {
  if (!code) return null;
  const { rows } = await client.query('SELECT * FROM coupons WHERE code = upper($1)', [code.trim()]);
  return rows[0] || null;
}

async function isFirstOrder(userId, client = db) {
  const { rows } = await client.query(
    "SELECT NOT EXISTS (SELECT 1 FROM orders WHERE user_id = $1 AND order_status <> 'CANCELLED') AS first",
    [userId],
  );
  return rows[0].first;
}

async function listActiveCoupons() {
  const { rows } = await db.query(
    `SELECT code, description, discount_type, discount_value, min_order_value, max_discount, first_order_only
       FROM coupons
      WHERE is_active AND (valid_until IS NULL OR valid_until > now())
      ORDER BY min_order_value`,
  );
  return rows.map((row) => ({
    code: row.code,
    description: row.description,
    discountType: row.discount_type,
    discountValue: row.discount_value,
    minOrderValue: row.min_order_value,
    maxDiscount: row.max_discount,
    firstOrderOnly: row.first_order_only,
  }));
}

module.exports = { findCoupon, isFirstOrder, listActiveCoupons };
