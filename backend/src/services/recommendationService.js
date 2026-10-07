const db = require('../db/pool');
const config = require('../config');
const { mlGet } = require('./mlClient');
const { PRODUCT_COLUMNS, mapProduct } = require('./productService');

/**
 * SQL fallback used when the Python recommender is unreachable: "buy again" ranked by
 * how often the user bought each product, then globally popular items for cold starts.
 */
async function fallbackRecommendations(userId, cartIds, k) {
  const { rows } = await db.query(
    `WITH history AS (
       SELECT oi.product_id, COUNT(*) AS times, MAX(o.created_at) AS last_bought
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.user_id = $1 AND o.order_status <> 'CANCELLED'
        GROUP BY oi.product_id
     ), popular AS (
       SELECT oi.product_id, COUNT(*) AS times
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.created_at >= now() - interval '30 days' AND o.order_status <> 'CANCELLED'
        GROUP BY oi.product_id
     )
     SELECT p.id, h.times AS personal, pop.times AS popular
       FROM products p
       LEFT JOIN history h ON h.product_id = p.id
       LEFT JOIN popular pop ON pop.product_id = p.id
      WHERE p.deleted_at IS NULL AND p.is_available AND p.stock > 0
        AND NOT (p.id = ANY($2::int[]))
        AND (h.product_id IS NOT NULL OR pop.product_id IS NOT NULL)
      ORDER BY h.times DESC NULLS LAST, h.last_bought DESC NULLS LAST, pop.times DESC NULLS LAST
      LIMIT $3`,
    [userId, cartIds, k],
  );
  return {
    strategy: 'fallback',
    items: rows.map((row) => ({
      product_id: row.id,
      score: null,
      components: null,
      reasons: row.personal ? [`You've bought this ${row.personal} time${row.personal > 1 ? 's' : ''}`] : ['Popular right now'],
    })),
  };
}

/** Joins recommendation ids with live product data (price/stock may have changed since scoring). */
async function hydrate(items) {
  if (!items.length) return [];
  const ids = items.map((item) => item.product_id);
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS} FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.id = ANY($1::int[]) AND p.deleted_at IS NULL AND p.is_available AND p.stock > 0`,
    [ids],
  );
  const byId = new Map(rows.map((row) => [row.id, mapProduct(row)]));
  return items
    .filter((item) => byId.has(item.product_id))
    .map((item) => ({
      product: byId.get(item.product_id),
      score: item.score,
      components: item.components,
      reasons: item.reasons || [],
    }));
}

/** "Add to your usual cart": personalised recommendations for the user's current cart. */
async function getRecommendations(userId, { k } = {}) {
  const { rows } = await db.query('SELECT product_id FROM cart_items WHERE user_id = $1', [userId]);
  const cartIds = rows.map((row) => row.product_id);

  let result;
  try {
    result = await mlGet(`/recommendations/${userId}`, { cart: cartIds.join(','), k });
  } catch (err) {
    if (!config.isTest) console.warn(`recommender unavailable, using SQL fallback: ${err.message}`);
    result = await fallbackRecommendations(userId, cartIds, k || 8);
  }

  return {
    strategy: result.strategy,
    avgBasketSize: result.avg_basket_size ?? null,
    cartSize: cartIds.length,
    weights: result.weights ?? null,
    items: await hydrate(result.items || []),
  };
}

module.exports = { getRecommendations, fallbackRecommendations };
