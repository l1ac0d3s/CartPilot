-- CartPilot core schema
-- Money is stored as NUMERIC(10,2) (rupees). All timestamps are TIMESTAMPTZ.

CREATE TABLE categories (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    icon        TEXT,                                   -- emoji used as a lightweight product visual
    tax_rate    NUMERIC(5,4) NOT NULL DEFAULT 0.05      -- GST slab applied at checkout
                CHECK (tax_rate >= 0 AND tax_rate < 1),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    name           TEXT NOT NULL,
    email          TEXT NOT NULL,
    password_hash  TEXT NOT NULL,
    role           TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

CREATE TABLE products (
    id             SERIAL PRIMARY KEY,
    sku            TEXT NOT NULL UNIQUE,
    name           TEXT NOT NULL,
    brand          TEXT,
    unit           TEXT,                                -- e.g. "500 ml", "1 kg"
    description    TEXT,
    category_id    INT NOT NULL REFERENCES categories(id),
    price          NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    mrp            NUMERIC(10,2) CHECK (mrp >= 0),
    cost_price     NUMERIC(10,2) CHECK (cost_price >= 0),
    stock          INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    reorder_level  INT NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),
    max_stock      INT NOT NULL DEFAULT 100 CHECK (max_stock > 0),
    is_available   BOOLEAN NOT NULL DEFAULT TRUE,
    image_url      TEXT,
    deleted_at     TIMESTAMPTZ,                         -- soft delete keeps order history intact
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products (category_id) WHERE deleted_at IS NULL;
CREATE INDEX products_low_stock_idx ON products (stock) WHERE deleted_at IS NULL;

CREATE TABLE cart_items (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity    INT NOT NULL CHECK (quantity > 0),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, product_id)
);

CREATE TABLE coupons (
    code              TEXT PRIMARY KEY,
    description       TEXT NOT NULL,
    discount_type     TEXT NOT NULL CHECK (discount_type IN ('PERCENT', 'FLAT')),
    discount_value    NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    min_order_value   NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_discount      NUMERIC(10,2),
    first_order_only  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    valid_until       TIMESTAMPTZ
);

CREATE TABLE orders (
    id                SERIAL PRIMARY KEY,
    user_id           INT NOT NULL REFERENCES users(id),
    subtotal          NUMERIC(10,2) NOT NULL,
    delivery_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax_amount        NUMERIC(10,2) NOT NULL DEFAULT 0,
    discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount      NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    coupon_code       TEXT REFERENCES coupons(code),
    payment_method    TEXT NOT NULL DEFAULT 'online' CHECK (payment_method IN ('online', 'cod')),
    payment_status    TEXT NOT NULL DEFAULT 'PENDING'
                      CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    order_status      TEXT NOT NULL DEFAULT 'CREATED'
                      CHECK (order_status IN ('CREATED', 'CONFIRMED', 'PREPARING',
                                              'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED')),
    delivery_address  TEXT,
    cancel_reason     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at      TIMESTAMPTZ,
    cancelled_at      TIMESTAMPTZ
);
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC);
CREATE INDEX orders_created_idx ON orders (created_at);
CREATE INDEX orders_status_idx ON orders (order_status);

CREATE TABLE order_items (
    id            SERIAL PRIMARY KEY,
    order_id      INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id    INT NOT NULL REFERENCES products(id),
    product_name  TEXT NOT NULL,                        -- snapshot at purchase time
    quantity      INT NOT NULL CHECK (quantity > 0),
    price         NUMERIC(10,2) NOT NULL,               -- unit price at purchase time
    tax_rate      NUMERIC(5,4) NOT NULL DEFAULT 0,
    UNIQUE (order_id, product_id)
);
CREATE INDEX order_items_product_idx ON order_items (product_id);

CREATE TABLE order_status_history (
    id          SERIAL PRIMARY KEY,
    order_id    INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status      TEXT NOT NULL,
    note        TEXT,
    changed_by  INT REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_idx ON order_status_history (order_id, created_at);

CREATE TABLE payments (
    id              SERIAL PRIMARY KEY,
    order_id        INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL CHECK (provider IN ('stripe', 'mock', 'cod')),
    provider_ref    TEXT,                               -- e.g. Stripe Checkout Session id
    amount          NUMERIC(10,2) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'inr',
    status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'EXPIRED')),
    failure_reason  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_idx ON payments (order_id);
CREATE UNIQUE INDEX payments_provider_ref_key ON payments (provider, provider_ref) WHERE provider_ref IS NOT NULL;

-- Append-only stock ledger: every stock change is explained by a movement row.
CREATE TABLE inventory_movements (
    id            BIGSERIAL PRIMARY KEY,
    product_id    INT NOT NULL REFERENCES products(id),
    change        INT NOT NULL,
    reason        TEXT NOT NULL CHECK (reason IN ('INITIAL', 'ORDER', 'CANCEL', 'RESTOCK', 'ADJUSTMENT')),
    reference_id  INT,                                  -- order id for ORDER / CANCEL
    stock_after   INT NOT NULL CHECK (stock_after >= 0),
    created_by    INT REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inventory_movements_product_idx ON inventory_movements (product_id, created_at);

CREATE TABLE inventory_alerts (
    id             SERIAL PRIMARY KEY,
    product_id     INT NOT NULL REFERENCES products(id),
    alert_type     TEXT NOT NULL CHECK (alert_type IN ('LOW_STOCK', 'OUT_OF_STOCK')),
    stock_level    INT NOT NULL,
    reorder_level  INT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at    TIMESTAMPTZ
);
-- At most one open alert of each type per product.
CREATE UNIQUE INDEX inventory_alerts_open_key ON inventory_alerts (product_id, alert_type) WHERE resolved_at IS NULL;
CREATE INDEX inventory_alerts_created_idx ON inventory_alerts (created_at);

-- Behavioural events used for funnel metrics (conversion rate, cart abandonment).
CREATE TABLE events (
    id          BIGSERIAL PRIMARY KEY,
    session_id  TEXT NOT NULL,
    user_id     INT REFERENCES users(id) ON DELETE SET NULL,
    event_type  TEXT NOT NULL CHECK (event_type IN ('product_view', 'search', 'add_to_cart',
                                                    'remove_from_cart', 'checkout_started', 'order_placed')),
    product_id  INT REFERENCES products(id) ON DELETE SET NULL,
    order_id    INT REFERENCES orders(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_created_idx ON events (created_at);
CREATE INDEX events_session_idx ON events (session_id);
