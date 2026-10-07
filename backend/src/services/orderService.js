const db = require('../db/pool');
const config = require('../config');
const { badRequest, conflict, notFound } = require('../utils/errors');
const { computeBill } = require('./billingService');
const { findCoupon, isFirstOrder } = require('./couponService');
const { adjustStock } = require('./inventoryService');
const { trackEvent } = require('./eventService');
const paymentService = require('./paymentService');
const { CUSTOMER_CANCELLABLE, STATUS_LABELS, canTransition, recordStatus } = require('./orderLifecycle');

function mapOrder(row) {
  const createdAt = new Date(row.created_at);
  return {
    id: row.id,
    userId: row.user_id,
    customer: row.customer_name ? { name: row.customer_name, email: row.customer_email } : undefined,
    orderStatus: row.order_status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    taxAmount: row.tax_amount,
    discountAmount: row.discount_amount,
    totalAmount: row.total_amount,
    couponCode: row.coupon_code,
    deliveryAddress: row.delivery_address,
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    itemCount: row.item_count,
    canCancel: CUSTOMER_CANCELLABLE.includes(row.order_status),
    canPay: paymentService.isPayable(row),
    paymentDeadline:
      row.payment_method === 'online' && row.order_status === 'CREATED'
        ? new Date(createdAt.getTime() + config.orders.paymentTimeoutMinutes * 60000)
        : null,
  };
}

/**
 * Checkout: converts the user's cart into an order inside one transaction.
 * Product rows are locked (in id order, to avoid deadlocks) so concurrent checkouts
 * can never oversell stock.
 */
async function createOrder(user, { couponCode = null, paymentMethod = 'online', deliveryAddress = null }, ctx = {}) {
  const order = await db.withTransaction(async (client) => {
    const { rows: lines } = await client.query(
      `SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock, p.is_available, p.deleted_at, c.tax_rate
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
         JOIN categories c ON c.id = p.category_id
        WHERE ci.user_id = $1
        ORDER BY p.id
        FOR UPDATE OF p`,
      [user.id],
    );
    if (!lines.length) throw badRequest('Your cart is empty', { code: 'EMPTY_CART' });

    const problems = lines
      .filter((line) => line.deleted_at || !line.is_available || line.stock < line.quantity)
      .map((line) => ({
        productId: line.product_id,
        name: line.name,
        requested: line.quantity,
        available: line.deleted_at || !line.is_available ? 0 : line.stock,
      }));
    if (problems.length) {
      throw conflict('Some items in your cart are no longer available in the requested quantity', {
        code: 'CART_ITEMS_UNAVAILABLE',
        details: problems,
      });
    }

    let coupon = null;
    let firstOrder = false;
    if (couponCode) {
      [coupon, firstOrder] = await Promise.all([findCoupon(couponCode, client), isFirstOrder(user.id, client)]);
    }
    const bill = computeBill(
      lines.map((line) => ({ price: line.price, quantity: line.quantity, taxRate: line.tax_rate })),
      { coupon, couponCode, isFirstOrder: firstOrder },
    );
    if (bill.coupon && !bill.coupon.applied) {
      throw badRequest(bill.coupon.message, { code: 'COUPON_NOT_APPLICABLE' });
    }

    const isCod = paymentMethod === 'cod';
    const { rows } = await client.query(
      `INSERT INTO orders (user_id, subtotal, delivery_fee, tax_amount, discount_amount, total_amount,
                           coupon_code, payment_method, order_status, delivery_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        user.id,
        bill.subtotal,
        bill.deliveryFee,
        bill.tax,
        bill.discount,
        bill.total,
        bill.coupon?.applied ? coupon.code : null,
        paymentMethod,
        isCod ? 'CONFIRMED' : 'CREATED',
        deliveryAddress,
      ],
    );
    const created = rows[0];

    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, quantity, price, tax_rate)
       SELECT $1, * FROM unnest($2::int[], $3::text[], $4::int[], $5::numeric[], $6::numeric[])`,
      [
        created.id,
        lines.map((l) => l.product_id),
        lines.map((l) => l.name),
        lines.map((l) => l.quantity),
        lines.map((l) => l.price),
        lines.map((l) => l.tax_rate),
      ],
    );

    // Order placed -> inventory decreases -> low-stock alerts fire inside adjustStock.
    for (const line of lines) {
      await adjustStock(client, {
        productId: line.product_id,
        change: -line.quantity,
        reason: 'ORDER',
        referenceId: created.id,
        userId: user.id,
      });
    }

    await recordStatus(client, created.id, 'CREATED', 'Order placed', user.id);
    if (isCod) await recordStatus(client, created.id, 'CONFIRMED', 'Cash on delivery order confirmed', user.id);
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [user.id]);
    return created;
  });

  trackEvent({ sessionId: ctx.sessionId, userId: user.id, type: 'order_placed', orderId: order.id });

  let payment = null;
  if (order.payment_method === 'online') {
    try {
      payment = await paymentService.startCheckout(order, { email: user.email });
    } catch (err) {
      // The order is safely reserved; the customer can retry payment from the order page.
      console.error(`could not start payment for order ${order.id}: ${err.message}`);
      payment = { error: 'Payment could not be started. Please retry from your order page.' };
    }
  }
  return { order: await getOrder(order.id, { userId: user.id }), payment };
}

async function getOrder(orderId, { userId = null, admin = false } = {}) {
  const { rows } = await db.query(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = $1 AND ($2::int IS NULL OR o.user_id = $2)`,
    [orderId, admin ? null : userId],
  );
  if (!rows.length) throw notFound('Order not found');

  const [items, history, payments] = await Promise.all([
    db.query(
      `SELECT oi.product_id, oi.product_name, oi.quantity, oi.price, oi.tax_rate,
              p.unit, p.stock, p.is_available, p.deleted_at, c.icon AS category_icon, c.name AS category_name
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         JOIN categories c ON c.id = p.category_id
        WHERE oi.order_id = $1 ORDER BY oi.id`,
      [orderId],
    ),
    db.query(
      'SELECT status, note, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at, id',
      [orderId],
    ),
    db.query(
      `SELECT id, provider, status, amount, failure_reason, created_at, updated_at
         FROM payments WHERE order_id = $1 ORDER BY created_at, id`,
      [orderId],
    ),
  ]);

  return {
    ...mapOrder(rows[0]),
    items: items.rows.map((row) => ({
      productId: row.product_id,
      name: row.product_name,
      quantity: row.quantity,
      price: row.price,
      lineTotal: Math.round(row.price * row.quantity * 100) / 100,
      unit: row.unit,
      icon: row.category_icon,
      category: row.category_name,
      inStock: !row.deleted_at && row.is_available && row.stock > 0,
    })),
    statusHistory: history.rows.map((row) => ({
      status: row.status,
      label: STATUS_LABELS[row.status],
      note: row.note,
      at: row.created_at,
    })),
    payments: payments.rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      status: row.status,
      amount: row.amount,
      failureReason: row.failure_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  };
}

async function listOrders({ userId = null, status = null, search = null, page = 1, limit = 20 } = {}) {
  const params = [];
  const where = [];
  if (userId) {
    params.push(userId);
    where.push(`o.user_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`o.order_status = $${params.length}`);
  }
  if (search) {
    const term = search.trim();
    params.push(term.replace(/^#/, ''), `%${term}%`);
    const [idParam, likeParam] = [params.length - 1, params.length];
    where.push(`(o.id::text = $${idParam} OR u.email ILIKE $${likeParam} OR u.name ILIKE $${likeParam})`);
  }
  params.push(limit, (page - 1) * limit);

  const { rows } = await db.query(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email,
            items.item_count, items.preview, COUNT(*) OVER () AS total_count
       FROM orders o
       JOIN users u ON u.id = o.user_id
       CROSS JOIN LATERAL (
         SELECT SUM(oi.quantity) AS item_count,
                json_agg(json_build_object('productId', oi.product_id, 'name', oi.product_name,
                                           'quantity', oi.quantity) ORDER BY oi.id) AS preview
           FROM order_items oi WHERE oi.order_id = o.id
       ) items
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = rows[0]?.total_count || 0;
  return {
    items: rows.map((row) => ({ ...mapOrder(row), items: row.preview })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Cancels an order: restores stock (ledger reason CANCEL) and refunds online payments.
 * Customers can cancel only before preparation starts; admins until dispatch.
 */
async function cancelOrder(orderId, { userId = null, admin = false, reason = null, actorId = null } = {}) {
  const wasPaid = await db.withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    const order = rows[0];
    if (!order || (!admin && order.user_id !== userId)) throw notFound('Order not found');

    const allowed = admin
      ? canTransition(order.order_status, 'CANCELLED')
      : CUSTOMER_CANCELLABLE.includes(order.order_status);
    if (!allowed) {
      throw conflict(`Order can no longer be cancelled (status: ${STATUS_LABELS[order.order_status]})`, {
        code: 'INVALID_TRANSITION',
      });
    }

    const { rows: items } = await client.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = $1 ORDER BY product_id',
      [orderId],
    );
    for (const item of items) {
      await adjustStock(client, {
        productId: item.product_id,
        change: item.quantity,
        reason: 'CANCEL',
        referenceId: orderId,
        userId: actorId,
      });
    }

    await client.query(
      `UPDATE orders SET order_status = 'CANCELLED', cancelled_at = now(), cancel_reason = $2, updated_at = now()
        WHERE id = $1`,
      [orderId, reason],
    );
    await client.query(
      "UPDATE payments SET status = 'EXPIRED', updated_at = now() WHERE order_id = $1 AND status = 'PENDING'",
      [orderId],
    );
    await recordStatus(client, orderId, 'CANCELLED', reason, actorId);
    return order.payment_status === 'PAID';
  });

  if (wasPaid) await paymentService.refundOrder(orderId);
  return getOrder(orderId, { admin: true });
}

/** Admin status update, validated against the state machine. */
async function updateStatus(orderId, status, { actorId, note = null }) {
  if (status === 'CANCELLED') {
    return cancelOrder(orderId, { admin: true, reason: note || 'Cancelled by store', actorId });
  }

  await db.withTransaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    const order = rows[0];
    if (!order) throw notFound('Order not found');
    if (!canTransition(order.order_status, status)) {
      throw conflict(`Cannot move order from ${order.order_status} to ${status}`, { code: 'INVALID_TRANSITION' });
    }
    if (status === 'CONFIRMED' && order.payment_method === 'online' && order.payment_status !== 'PAID') {
      throw conflict('Order is still awaiting online payment', { code: 'AWAITING_PAYMENT' });
    }

    const codCollected = status === 'DELIVERED' && order.payment_method === 'cod';
    await client.query(
      `UPDATE orders
          SET order_status = $2,
              delivered_at = CASE WHEN $2 = 'DELIVERED' THEN now() ELSE delivered_at END,
              payment_status = CASE WHEN $3 THEN 'PAID' ELSE payment_status END,
              updated_at = now()
        WHERE id = $1`,
      [orderId, status, codCollected],
    );
    if (codCollected) {
      await client.query(
        "INSERT INTO payments (order_id, provider, amount, status) VALUES ($1, 'cod', $2, 'SUCCEEDED')",
        [orderId, order.total_amount],
      );
    }
    await recordStatus(client, orderId, status, note, actorId);
  });
  return getOrder(orderId, { admin: true });
}

/** Re-adds a past order's items to the cart, capped by current stock; reports what was skipped. */
async function reorder(orderId, userId) {
  const { rows: owned } = await db.query('SELECT id FROM orders WHERE id = $1 AND user_id = $2', [orderId, userId]);
  if (!owned.length) throw notFound('Order not found');

  return db.withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT oi.product_id, oi.product_name, oi.quantity, p.stock, p.is_available, p.deleted_at,
              COALESCE(ci.quantity, 0) AS in_cart
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         LEFT JOIN cart_items ci ON ci.product_id = oi.product_id AND ci.user_id = $2
        WHERE oi.order_id = $1 ORDER BY oi.id`,
      [orderId, userId],
    );

    const added = [];
    const skipped = [];
    for (const row of rows) {
      if (row.deleted_at || !row.is_available || row.stock === 0) {
        skipped.push({ productId: row.product_id, name: row.product_name, reason: 'Out of stock' });
        continue;
      }
      const target = Math.min(row.in_cart + row.quantity, row.stock, config.billing.maxQuantityPerItem);
      if (target <= row.in_cart) {
        skipped.push({ productId: row.product_id, name: row.product_name, reason: 'Already at maximum quantity' });
        continue;
      }
      await client.query(
        `INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`,
        [userId, row.product_id, target],
      );
      added.push({ productId: row.product_id, name: row.product_name, quantity: target - row.in_cart });
    }
    return { added, skipped };
  });
}

/** Cancels online orders whose payment window has lapsed, releasing their reserved stock. */
async function expireUnpaidOrders() {
  const { rows } = await db.query(
    `SELECT id FROM orders
      WHERE order_status = 'CREATED' AND payment_method = 'online' AND payment_status <> 'PAID'
        AND created_at < now() - make_interval(mins => $1)`,
    [config.orders.paymentTimeoutMinutes],
  );
  for (const { id } of rows) {
    try {
      await cancelOrder(id, { admin: true, reason: 'Payment not completed in time' });
    } catch (err) {
      console.error(`failed to expire order ${id}: ${err.message}`);
    }
  }
  return rows.length;
}

module.exports = { createOrder, getOrder, listOrders, cancelOrder, updateStatus, reorder, expireUnpaidOrders };
