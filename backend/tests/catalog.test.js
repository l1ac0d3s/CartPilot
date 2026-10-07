const { app, request, db, resetDb, createUser } = require('./helpers');

beforeEach(resetDb);
afterAll(() => db.pool.end());

describe('catalog', () => {
  test('lists, searches and filters products', async () => {
    const all = await request(app).get('/api/products');
    expect(all.body.total).toBe(4);

    const search = await request(app).get('/api/products?search=amul');
    expect(search.body.items.map((p) => p.name)).toEqual(['Toned Milk']);

    const byCategory = await request(app).get('/api/products?category=snacks');
    expect(byCategory.body.items.map((p) => p.id)).toEqual([3]);

    const sorted = await request(app).get('/api/products?sort=price_desc');
    expect(sorted.body.items.map((p) => p.price)).toEqual([72, 45, 30, 20]);
  });

  test('pagination metadata', async () => {
    const res = await request(app).get('/api/products?limit=3&page=2');
    expect(res.body).toMatchObject({ page: 2, limit: 3, total: 4, totalPages: 2 });
    expect(res.body.items).toHaveLength(1);
  });

  test('product detail includes frequently bought together', async () => {
    const user = await createUser();
    for (const productId of [1, 2]) {
      await request(app).post('/api/cart').set('Authorization', user.auth).send({ productId, quantity: 1 });
    }
    await request(app).post('/api/orders').set('Authorization', user.auth).send({ paymentMethod: 'cod' });

    const res = await request(app).get('/api/products/1');
    expect(res.body.product).toMatchObject({ id: 1, category: { slug: 'dairy-eggs' } });
    expect(res.body.frequentlyBoughtTogether.map((p) => p.id)).toEqual([2]);
  });

  test('bad ids are validated and unknown ids 404', async () => {
    expect((await request(app).get('/api/products/abc')).status).toBe(400);
    expect((await request(app).get('/api/products/999')).status).toBe(404);
  });

  test('categories and coupons', async () => {
    const categories = await request(app).get('/api/categories');
    expect(categories.body.categories.map((c) => [c.slug, c.productCount])).toEqual([
      ['dairy-eggs', 3],
      ['snacks', 1],
    ]);
    const coupons = await request(app).get('/api/coupons');
    expect(coupons.body.coupons.map((c) => c.code)).toEqual(['WELCOME50', 'SAVE10', 'BIGBASKET']);
  });
});

describe('recommendations fallback', () => {
  test('falls back to buy-again ranking when the ML service is down', async () => {
    const user = await createUser();
    const buy = async (items) => {
      for (const [productId, quantity] of items) {
        await request(app).post('/api/cart').set('Authorization', user.auth).send({ productId, quantity });
      }
      await request(app).post('/api/orders').set('Authorization', user.auth).send({ paymentMethod: 'cod' });
    };
    await buy([[1, 1], [2, 1]]);
    await buy([[2, 1]]);
    await request(app).post('/api/cart').set('Authorization', user.auth).send({ productId: 1, quantity: 1 });

    const res = await request(app).get('/api/recommendations').set('Authorization', user.auth);
    expect(res.status).toBe(200);
    expect(res.body.strategy).toBe('fallback');
    expect(res.body.cartSize).toBe(1);
    expect(res.body.items[0].product.id).toBe(2); // bought twice, not in cart
    expect(res.body.items.map((i) => i.product.id)).not.toContain(1); // already in cart
    expect(res.body.items[0].reasons[0]).toMatch(/2 times/);
  });

  test('analytics surfaces a 503 when the ML service is down', async () => {
    const admin = await createUser({ role: 'admin' });
    const res = await request(app).get('/api/analytics').set('Authorization', admin.auth);
    expect(res.status).toBe(503);
  });
});
