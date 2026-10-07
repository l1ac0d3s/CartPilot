const { app, request, db, resetDb, createUser } = require('./helpers');

let user;
beforeEach(async () => {
  await resetDb();
  user = await createUser();
});
afterAll(() => db.pool.end());

const add = (productId, quantity = 1) =>
  request(app).post('/api/cart').set('Authorization', user.auth).send({ productId, quantity });

describe('cart', () => {
  test('requires authentication', async () => {
    expect((await request(app).get('/api/cart')).status).toBe(401);
  });

  test('adding the same product increments quantity and returns a bill', async () => {
    await add(1, 2);
    const res = await add(1, 1);
    expect(res.status).toBe(201);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ quantity: 3, lineTotal: 90 });
    expect(res.body.bill).toMatchObject({ subtotal: 90, deliveryFee: 30, tax: 4.5, total: 124.5 });
    expect(res.body.canCheckout).toBe(true);
  });

  test('cannot add more than is in stock', async () => {
    const res = await add(3, 4); // only 3 chips in stock
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/Only 3 unit/);
  });

  test('PUT sets an absolute quantity and 0 removes the item', async () => {
    await add(1, 1);
    let res = await request(app).put('/api/cart/1').set('Authorization', user.auth).send({ quantity: 5 });
    expect(res.body.items[0].quantity).toBe(5);
    res = await request(app).put('/api/cart/1').set('Authorization', user.auth).send({ quantity: 0 });
    expect(res.body.items).toHaveLength(0);
  });

  test('DELETE removes a line and tracks a funnel event', async () => {
    await add(1, 1);
    await add(2, 1);
    const res = await request(app).delete('/api/cart/1').set('Authorization', user.auth).set('X-Session-Id', 'sess-test-123');
    expect(res.body.items.map((i) => i.product.id)).toEqual([2]);
    await new Promise((r) => setTimeout(r, 50));
    const { rows } = await db.query("SELECT event_type FROM events WHERE session_id = 'sess-test-123'");
    expect(rows.map((r) => r.event_type)).toEqual(['remove_from_cart']);
  });

  test('items that went out of stock are flagged and block checkout', async () => {
    await add(4, 1);
    await db.query('UPDATE products SET stock = 0 WHERE id = 4');
    const res = await request(app).get('/api/cart').set('Authorization', user.auth);
    expect(res.body.items[0].issue).toBe('OUT_OF_STOCK');
    expect(res.body.canCheckout).toBe(false);
    expect(res.body.bill.subtotal).toBe(0);
  });

  test('coupon preview explains why it does not apply', async () => {
    await add(1, 1);
    const res = await request(app).get('/api/cart?coupon=save10').set('Authorization', user.auth);
    expect(res.body.bill.coupon).toMatchObject({ code: 'SAVE10', applied: false });
  });
});
