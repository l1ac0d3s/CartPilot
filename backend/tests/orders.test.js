const { app, request, db, resetDb, createUser, stockOf } = require('./helpers');

let user;
let admin;
beforeEach(async () => {
  await resetDb();
  user = await createUser();
  admin = await createUser({ role: 'admin' });
});
afterAll(() => db.pool.end());

const addToCart = (who, productId, quantity) =>
  request(app).post('/api/cart').set('Authorization', who.auth).send({ productId, quantity });
const checkout = (who, body = {}) => request(app).post('/api/orders').set('Authorization', who.auth).send(body);
const setStatus = (orderId, status) =>
  request(app).put(`/api/admin/orders/${orderId}/status`).set('Authorization', admin.auth).send({ status });

describe('checkout', () => {
  test('creates an order, decrements stock, writes the ledger and clears the cart', async () => {
    await addToCart(user, 1, 2);
    await addToCart(user, 2, 3); // bread: 12 -> 9, reorder level 10 -> low-stock alert
    const res = await checkout(user, { deliveryAddress: '221B Baker Street' });

    expect(res.status).toBe(201);
    const { order, payment } = res.body;
    expect(order).toMatchObject({
      orderStatus: 'CREATED',
      paymentStatus: 'PENDING',
      paymentMethod: 'online',
      subtotal: 195,
      deliveryFee: 30,
      taxAmount: 9.75,
      totalAmount: 234.75,
      canPay: true,
    });
    expect(order.items).toHaveLength(2);
    expect(payment).toMatchObject({ provider: 'mock' });
    expect(payment.checkoutUrl).toContain(`/pay/${order.id}`);

    expect(await stockOf(1)).toBe(48);
    expect(await stockOf(2)).toBe(9);
    const ledger = await db.query("SELECT product_id, change, stock_after FROM inventory_movements WHERE reason = 'ORDER' ORDER BY product_id");
    expect(ledger.rows).toEqual([
      { product_id: 1, change: -2, stock_after: 48 },
      { product_id: 2, change: -3, stock_after: 9 },
    ]);
    const alerts = await db.query('SELECT product_id, alert_type FROM inventory_alerts WHERE resolved_at IS NULL');
    expect(alerts.rows).toEqual([{ product_id: 2, alert_type: 'LOW_STOCK' }]);

    const cart = await request(app).get('/api/cart').set('Authorization', user.auth);
    expect(cart.body.items).toHaveLength(0);
  });

  test('selling the last unit raises an out-of-stock alert', async () => {
    await addToCart(user, 4, 1);
    await checkout(user);
    const alerts = await db.query("SELECT alert_type FROM inventory_alerts WHERE product_id = 4 AND resolved_at IS NULL ORDER BY alert_type");
    expect(alerts.rows.map((r) => r.alert_type)).toEqual(['LOW_STOCK', 'OUT_OF_STOCK']);
  });

  test('empty cart is rejected', async () => {
    const res = await checkout(user);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMPTY_CART');
  });

  test('stock that disappeared after adding to cart blocks checkout', async () => {
    await addToCart(user, 3, 3);
    await db.query('UPDATE products SET stock = 1 WHERE id = 3');
    const res = await checkout(user);
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual([{ productId: 3, name: 'Salted Chips', requested: 3, available: 1 }]);
    expect(await stockOf(3)).toBe(1);
  });

  test('concurrent checkouts can never oversell the last unit', async () => {
    const other = await createUser();
    await addToCart(user, 4, 1);
    await addToCart(other, 4, 1);
    const results = await Promise.all([checkout(user), checkout(other)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await stockOf(4)).toBe(0);
  });

  test('applies a valid coupon and rejects an inapplicable one', async () => {
    await addToCart(user, 2, 5); // 225
    const bad = await checkout(user, { couponCode: 'SAVE10' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('COUPON_NOT_APPLICABLE');

    const ok = await checkout(user, { couponCode: 'welcome50' });
    expect(ok.status).toBe(201);
    expect(ok.body.order).toMatchObject({ subtotal: 225, discountAmount: 50, couponCode: 'WELCOME50' });
  });

  test('cash on delivery orders are confirmed immediately and paid on delivery', async () => {
    await addToCart(user, 1, 1);
    const { body } = await checkout(user, { paymentMethod: 'cod' });
    expect(body.payment).toBeNull();
    expect(body.order).toMatchObject({ orderStatus: 'CONFIRMED', paymentStatus: 'PENDING' });

    for (const status of ['PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
      const res = await setStatus(body.order.id, status);
      expect(res.status).toBe(200);
    }
    const order = await request(app).get(`/api/orders/${body.order.id}`).set('Authorization', user.auth);
    expect(order.body.order).toMatchObject({ orderStatus: 'DELIVERED', paymentStatus: 'PAID' });
    expect(order.body.order.statusHistory.map((h) => h.status)).toEqual([
      'CREATED', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED',
    ]);
  });
});

describe('payments (mock provider)', () => {
  let orderId;
  beforeEach(async () => {
    await addToCart(user, 1, 2);
    orderId = (await checkout(user)).body.order.id;
  });
  const confirm = (success) =>
    request(app).post(`/api/payments/${orderId}/mock-confirm`).set('Authorization', user.auth).send({ success });

  test('successful payment confirms the order (idempotently)', async () => {
    const res = await confirm(true);
    expect(res.body.order).toMatchObject({ orderStatus: 'CONFIRMED', paymentStatus: 'PAID', canPay: false });
    const again = await confirm(true);
    expect(again.status).toBe(409); // nothing pending any more
  });

  test('failed payment keeps the order open for a retry', async () => {
    const failed = await confirm(false);
    expect(failed.body.order).toMatchObject({ orderStatus: 'CREATED', paymentStatus: 'FAILED', canPay: true });

    const retry = await request(app).post(`/api/payments/${orderId}/checkout`).set('Authorization', user.auth);
    expect(retry.status).toBe(201);
    const paid = await confirm(true);
    expect(paid.body.order.paymentStatus).toBe('PAID');
  });

  test('admin cannot confirm an unpaid online order', async () => {
    const res = await setStatus(orderId, 'CONFIRMED');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AWAITING_PAYMENT');
  });

  test("other customers cannot pay for or view someone else's order", async () => {
    const other = await createUser();
    expect((await request(app).get(`/api/orders/${orderId}`).set('Authorization', other.auth)).status).toBe(404);
    const res = await request(app)
      .post(`/api/payments/${orderId}/mock-confirm`)
      .set('Authorization', other.auth)
      .send({ success: true });
    expect(res.status).toBe(404);
  });

  test('unpaid orders expire and release their stock', async () => {
    const { expireUnpaidOrders } = require('../src/services/orderService');
    await db.query("UPDATE orders SET created_at = now() - interval '2 hours' WHERE id = $1", [orderId]);
    expect(await expireUnpaidOrders()).toBe(1);
    expect(await stockOf(1)).toBe(50);
    const { rows } = await db.query('SELECT order_status, cancel_reason FROM orders WHERE id = $1', [orderId]);
    expect(rows[0]).toEqual({ order_status: 'CANCELLED', cancel_reason: 'Payment not completed in time' });
  });
});

describe('order lifecycle', () => {
  test('customer cancellation restores stock and refunds a paid order', async () => {
    await addToCart(user, 2, 3);
    const orderId = (await checkout(user)).body.order.id;
    await request(app).post(`/api/payments/${orderId}/mock-confirm`).set('Authorization', user.auth).send({ success: true });
    expect(await stockOf(2)).toBe(9);

    const res = await request(app).post(`/api/orders/${orderId}/cancel`).set('Authorization', user.auth).send({});
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ orderStatus: 'CANCELLED', paymentStatus: 'REFUNDED' });
    expect(await stockOf(2)).toBe(12);
    const alerts = await db.query('SELECT resolved_at FROM inventory_alerts WHERE product_id = 2');
    expect(alerts.rows[0].resolved_at).not.toBeNull(); // back above reorder level
  });

  test('customers cannot cancel once preparation has started; invalid transitions are rejected', async () => {
    await addToCart(user, 1, 1);
    const orderId = (await checkout(user, { paymentMethod: 'cod' })).body.order.id;
    expect((await setStatus(orderId, 'DELIVERED')).status).toBe(409);
    expect((await setStatus(orderId, 'PREPARING')).status).toBe(200);
    const cancel = await request(app).post(`/api/orders/${orderId}/cancel`).set('Authorization', user.auth).send({});
    expect(cancel.status).toBe(409);
    expect((await setStatus(orderId, 'CANCELLED')).status).toBe(200); // the store still can
  });

  test('order history lists newest first and reorder refills the cart', async () => {
    await addToCart(user, 1, 2);
    await addToCart(user, 4, 1);
    const first = (await checkout(user, { paymentMethod: 'cod' })).body.order.id;
    await addToCart(user, 2, 1);
    const second = (await checkout(user, { paymentMethod: 'cod' })).body.order.id;

    const list = await request(app).get('/api/orders').set('Authorization', user.auth);
    expect(list.body.items.map((o) => o.id)).toEqual([second, first]);
    expect(list.body.items[1].items).toHaveLength(2);

    const res = await request(app).post(`/api/orders/${first}/reorder`).set('Authorization', user.auth);
    expect(res.body.added).toEqual([{ productId: 1, name: 'Toned Milk', quantity: 2 }]);
    expect(res.body.skipped).toEqual([{ productId: 4, name: 'Farm Eggs', reason: 'Out of stock' }]);
    expect(res.body.cart.items).toHaveLength(1);
  });

  test('admin order list supports status filter and search', async () => {
    await addToCart(user, 1, 1);
    const orderId = (await checkout(user, { paymentMethod: 'cod' })).body.order.id;
    const byStatus = await request(app).get('/api/admin/orders?status=CONFIRMED').set('Authorization', admin.auth);
    expect(byStatus.body.items.map((o) => o.id)).toEqual([orderId]);
    const bySearch = await request(app).get(`/api/admin/orders?search=%23${orderId}`).set('Authorization', admin.auth);
    expect(bySearch.body.total).toBe(1);
    expect(bySearch.body.items[0].customer.email).toBe(user.user.email);
    expect((await request(app).get('/api/admin/orders').set('Authorization', user.auth)).status).toBe(403);
  });
});
