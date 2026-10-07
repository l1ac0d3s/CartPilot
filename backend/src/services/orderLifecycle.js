/**
 * Order state machine:
 *   CREATED -> CONFIRMED -> PREPARING -> OUT_FOR_DELIVERY -> DELIVERED
 *   CREATED | CONFIRMED | PREPARING -> CANCELLED
 * Online orders move CREATED -> CONFIRMED when payment succeeds; COD orders are confirmed at checkout.
 */
const ORDER_STATUSES = ['CREATED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

const TRANSITIONS = {
  CREATED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

// Customers may cancel only before the store starts preparing the order.
const CUSTOMER_CANCELLABLE = ['CREATED', 'CONFIRMED'];

const STATUS_LABELS = {
  CREATED: 'Order created',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

async function recordStatus(client, orderId, status, note = null, changedBy = null) {
  await client.query('INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES ($1, $2, $3, $4)', [
    orderId,
    status,
    note,
    changedBy,
  ]);
}

module.exports = { ORDER_STATUSES, TRANSITIONS, CUSTOMER_CANCELLABLE, STATUS_LABELS, canTransition, recordStatus };
