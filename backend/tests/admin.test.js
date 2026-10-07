const { app, request, db, resetDb, createUser, stockOf } = require('./helpers');

let admin;
beforeEach(async () => {
  await resetDb();
  admin = await createUser({ role: 'admin' });
});
afterAll(() => db.pool.end());

const as = (method, url) => request(app)[method](url).set('Authorization', admin.auth);

describe('admin products & inventory', () => {
  test('non-admins are forbidden', async () => {
    const customer = await createUser();
    const res = await request(app).post('/api/admin/products').set('Authorization', customer.auth).send({});
    expect(res.status).toBe(403);
  });

  test('create a product with opening stock recorded in the ledger', async () => {
    const res = await as('post', '/api/admin/products').send({
      name: 'Greek Yogurt', brand: 'Epigamia', unit: '90 g', categoryId: 1, price: 50, stock: 25, reorderLevel: 5,
    });
    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({ name: 'Greek Yogurt', stock: 25, reorderLevel: 5, mrp: 50, inStock: true });
    expect(res.body.product.sku).toMatch(/^CP-/);
    const { rows } = await db.query('SELECT reason, change FROM inventory_movements WHERE product_id = $1', [res.body.product.id]);
    expect(rows).toEqual([{ reason: 'INITIAL', change: 25 }]);
  });

  test('unknown category is rejected', async () => {
    const res = await as('post', '/api/admin/products').send({ name: 'Thing', categoryId: 99, price: 10 });
    expect(res.status).toBe(400);
  });

  test('update price, stock and availability', async () => {
    const res = await as('put', '/api/admin/products/3').send({ price: 25, stock: 40, isAvailable: false });
    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({ price: 25, stock: 40, isAvailable: false, inStock: false });

    const movements = await as('get', '/api/admin/products/3');
    expect(movements.body.movements[0]).toMatchObject({ reason: 'RESTOCK', change: 37, stockAfter: 40 });

    // Unavailable products disappear from the storefront but not from admin.
    expect((await request(app).get('/api/products/3')).status).toBe(404);
    const catalog = await request(app).get('/api/products?limit=50');
    expect(catalog.body.items.map((p) => p.id)).not.toContain(3);
  });

  test('raising the reorder level opens a low-stock alert; restocking resolves it', async () => {
    await as('put', '/api/admin/products/1').send({ reorderLevel: 60 });
    let alerts = await as('get', '/api/admin/alerts');
    expect(alerts.body.alerts.map((a) => [a.product.id, a.type])).toContainEqual([1, 'LOW_STOCK']);

    await as('put', '/api/admin/products/1').send({ stock: 90 });
    alerts = await as('get', '/api/admin/alerts');
    expect(alerts.body.alerts.map((a) => a.product.id)).not.toContain(1);
  });

  test('delete is a soft delete that also clears carts', async () => {
    const customer = await createUser();
    await request(app).post('/api/cart').set('Authorization', customer.auth).send({ productId: 1, quantity: 1 });
    expect((await as('delete', '/api/admin/products/1')).status).toBe(204);
    expect((await as('get', '/api/admin/products/1')).status).toBe(404);
    const cart = await request(app).get('/api/cart').set('Authorization', customer.auth);
    expect(cart.body.items).toHaveLength(0);
    expect(await stockOf(1)).toBe(50); // row still exists for order history
  });

  test('admin listing can filter to low stock', async () => {
    const res = await as('get', '/api/admin/products?lowStock=true&sort=stock_asc');
    expect(res.body.items.map((p) => p.id)).toEqual([4, 3]);
  });

  test('store summary', async () => {
    const res = await as('get', '/api/admin/summary');
    expect(res.body).toMatchObject({ products: 4, customers: 0, ordersToday: 0 });
  });
});
