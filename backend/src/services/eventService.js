const db = require('../db/pool');
const config = require('../config');

/**
 * Records a behavioural event for funnel analytics. Fire-and-forget: tracking must never
 * break the user-facing request, so failures are only logged.
 */
function trackEvent({ sessionId, userId = null, type, productId = null, orderId = null }) {
  if (!sessionId) return Promise.resolve();
  return db
    .query('INSERT INTO events (session_id, user_id, event_type, product_id, order_id) VALUES ($1, $2, $3, $4, $5)', [
      sessionId,
      userId,
      type,
      productId,
      orderId,
    ])
    .catch((err) => {
      if (!config.isTest) console.warn(`event tracking failed (${type}): ${err.message}`);
    });
}

module.exports = { trackEvent };
