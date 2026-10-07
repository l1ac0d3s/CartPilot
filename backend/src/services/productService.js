const db = require('../db/pool');
const { notFound } = require('../utils/errors');

const PRODUCT_COLUMNS = `
  p.id, p.sku, p.name, p.brand, p.unit, p.description, p.price, p.mrp, p.cost_price,
  p.stock, p.reorder_level, p.max_stock, p.is_available, p.image_url, p.created_at, p.updated_at,
  c.id AS category_id, c.name AS category_name, c.slug AS category_slug, c.icon AS category_icon,
  c.tax_rate`;

function mapProduct(row, { admin = false } = {}) {
  const product = {
    id: row.id,
    sku: row.sku,
    name: row.name,
    brand: row.brand,
    unit: row.unit,
    description: row.description,
    price: row.price,
    mrp: row.mrp,
    stock: row.stock,
    isAvailable: row.is_available,
    inStock: row.is_available && row.stock > 0,
    lowStock: row.stock <= row.reorder_level,
    imageUrl: row.image_url,
    category: { id: row.category_id, name: row.category_name, slug: row.category_slug, icon: row.category_icon },
  };
  if (admin) {
    Object.assign(product, {
      costPrice: row.cost_price,
      reorderLevel: row.reorder_level,
      maxStock: row.max_stock,
      taxRate: row.tax_rate,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  return product;
}

const SORTS = {
  popular: 'COALESCE(s.units, 0) DESC, p.name ASC',
  price_asc: 'p.price ASC, p.name ASC',
  price_desc: 'p.price DESC, p.name ASC',
  name: 'p.name ASC',
  stock_asc: 'p.stock ASC, p.name ASC',
  newest: 'p.created_at DESC, p.id DESC',
};

/**
 * Lists products with search, category filter, sorting and pagination.
 * Customers never see unavailable products; admins see everything that isn't deleted.
 */
async function listProducts({
  search,
  category,
  sort = 'popular',
  page = 1,
  limit = 24,
  inStock = false,
  lowStock = false,
  admin = false,
} = {}) {
  const params = [];
  const where = ['p.deleted_at IS NULL'];
  if (!admin) where.push('p.is_available');
  if (category) {
    params.push(category);
    where.push(/^\d+$/.test(String(category)) ? `c.id = $${params.length}::int` : `c.slug = $${params.length}`);
  }
  if (search) {
    params.push(`%${search.trim()}%`);
    const i = params.length;
    where.push(`(p.name ILIKE $${i} OR p.brand ILIKE $${i} OR c.name ILIKE $${i} OR p.sku ILIKE $${i})`);
  }
  if (inStock) where.push('p.stock > 0');
  if (lowStock) where.push('p.stock <= p.reorder_level');

  params.push(limit, (page - 1) * limit);
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS}, COALESCE(s.units, 0) AS units_sold_30d, COUNT(*) OVER () AS total_count
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN (
         SELECT oi.product_id, SUM(oi.quantity) AS units
           FROM order_items oi JOIN orders o ON o.id = oi.order_id
          WHERE o.created_at >= now() - interval '30 days' AND o.order_status <> 'CANCELLED'
          GROUP BY oi.product_id
       ) s ON s.product_id = p.id
      WHERE ${where.join(' AND ')}
      ORDER BY ${admin ? '' : '(p.stock > 0) DESC, '}${SORTS[sort] || SORTS.popular}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const total = rows[0]?.total_count || 0;
  return {
    items: rows.map((row) => ({ ...mapProduct(row, { admin }), unitsSold30d: row.units_sold_30d })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

async function getProduct(id, { admin = false } = {}) {
  const { rows } = await db.query(
    `SELECT ${PRODUCT_COLUMNS}
       FROM products p JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1 AND p.deleted_at IS NULL ${admin ? '' : 'AND p.is_available'}`,
    [id],
  );
  if (!rows.length) throw notFound('Product not found');
  return mapProduct(rows[0], { admin });
}

/** Products most often found in the same order as `productId` (global co-purchase counts). */
async function frequentlyBoughtTogether(productId, limit = 6) {
  const { rows } = await db.query(
    `WITH together AS (
       SELECT oi2.product_id, COUNT(*) AS orders_together
         FROM order_items oi1
         JOIN order_items oi2 ON oi2.order_id = oi1.order_id AND oi2.product_id <> oi1.product_id
        WHERE oi1.product_id = $1
        GROUP BY oi2.product_id
     )
     SELECT ${PRODUCT_COLUMNS}, t.orders_together
       FROM together t
       JOIN products p ON p.id = t.product_id
       JOIN categories c ON c.id = p.category_id
      WHERE p.deleted_at IS NULL AND p.is_available AND p.stock > 0
      ORDER BY t.orders_together DESC, p.id
      LIMIT $2`,
    [productId, limit],
  );
  return rows.map((row) => ({ ...mapProduct(row), ordersTogether: row.orders_together }));
}

async function listCategories() {
  const { rows } = await db.query(
    `SELECT c.id, c.name, c.slug, c.icon, c.tax_rate,
            COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL AND p.is_available) AS product_count
       FROM categories c LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id ORDER BY c.id`,
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    taxRate: row.tax_rate,
    productCount: row.product_count,
  }));
}

module.exports = { PRODUCT_COLUMNS, mapProduct, listProducts, getProduct, frequentlyBoughtTogether, listCategories };
