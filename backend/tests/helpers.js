const request = require('supertest');
const { createApp } = require('../src/app');
const db = require('../src/db/pool');

const app = createApp();

async function resetDb() {
  await db.query(`
    TRUNCATE events, inventory_alerts, inventory_movements, payments, order_status_history,
             order_items, orders, cart_items, products, categories, users
    RESTART IDENTITY CASCADE`);
  await db.query(`
    INSERT INTO categories (name, slug, icon, tax_rate) VALUES
      ('Dairy & Eggs', 'dairy-eggs', '🥛', 0.05),
      ('Snacks', 'snacks', '🍿', 0.12)`);
  // id 1..4
  await db.query(`
    INSERT INTO products (sku, name, brand, unit, category_id, price, mrp, stock, reorder_level, max_stock) VALUES
      ('MILK-1',  'Toned Milk',   'Amul',  '500 ml', 1, 30,  32, 50, 10, 100),
      ('BREAD-1', 'Whole Wheat Bread', 'Harvest', '400 g', 1, 45, 50, 12, 10, 60),
      ('CHIPS-1', 'Salted Chips', 'Lays',  '52 g',   2, 20,  20, 3,  5,  80),
      ('EGGS-1',  'Farm Eggs',    'Eggoz', '6 pcs',  1, 72,  80, 1,  4,  40)`);
}

async function createUser({ role = 'customer', email, name = 'Test User', password = 'password123' } = {}) {
  const userEmail = email || `user${Math.random().toString(36).slice(2, 8)}@test.dev`;
  const res = await request(app).post('/api/auth/register').send({ name, email: userEmail, password });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  if (role === 'admin') {
    await db.query("UPDATE users SET role = 'admin' WHERE id = $1", [res.body.user.id]);
    const login = await request(app).post('/api/auth/login').send({ email: userEmail, password });
    return { ...login.body, auth: `Bearer ${login.body.token}` };
  }
  return { ...res.body, auth: `Bearer ${res.body.token}` };
}

const stockOf = async (productId) =>
  (await db.query('SELECT stock FROM products WHERE id = $1', [productId])).rows[0].stock;

module.exports = { app, request, db, resetDb, createUser, stockOf };
