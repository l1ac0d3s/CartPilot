"""Bulk-loads a generated Dataset into PostgreSQL with COPY."""

from __future__ import annotations

import bcrypt
import psycopg

from .simulate import Dataset

APP_TABLES = [
    "events", "inventory_alerts", "inventory_movements", "payments", "order_status_history", "order_items",
    "orders", "cart_items", "products", "categories", "users",
]

DEMO_PASSWORD = "cartpilot123"
ADMIN_PASSWORD = "admin123"


def _copy(cur, table: str, columns: list[str], rows):
    with cur.copy(f"COPY {table} ({', '.join(columns)}) FROM STDIN") as copy:
        for row in rows:
            copy.write_row(row)


def load(dataset: Dataset, url: str, reset: bool = False) -> None:
    customer_hash = bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt(10)).decode()
    admin_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt(10)).decode()

    with psycopg.connect(url) as conn, conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.orders') IS NOT NULL")
        if not cur.fetchone()[0]:
            raise SystemExit("Schema not found. Run the backend migrations first: cd backend && npm run migrate")

        cur.execute("SELECT COUNT(*) FROM orders")
        if cur.fetchone()[0] and not reset:
            raise SystemExit("Database already has orders. Re-run with --reset to wipe and reseed.")
        cur.execute(f"TRUNCATE {', '.join(APP_TABLES)} RESTART IDENTITY CASCADE")

        _copy(cur, "categories", ["id", "name", "slug", "icon", "tax_rate"],
              ((c["id"], c["name"], c["slug"], c["icon"], c["tax_rate"]) for c in dataset.categories))
        _copy(cur, "users", ["id", "name", "email", "password_hash", "role", "created_at"],
              ((u["id"], u["name"], u["email"], admin_hash if u["role"] == "admin" else customer_hash,
                u["role"], u["created_at"]) for u in dataset.users))
        _copy(cur, "products",
              ["id", "sku", "name", "brand", "unit", "description", "category_id", "price", "mrp", "cost_price",
               "stock", "reorder_level", "max_stock", "is_available"],
              ((p.id, p.sku, p.name, p.brand, p.unit, p.description, p.category_id, p.price, p.mrp, p.cost,
                p.stock, p.reorder_level, p.max_stock, p.is_available) for p in dataset.products))
        order_cols = ["id", "user_id", "subtotal", "delivery_fee", "tax_amount", "discount_amount", "total_amount",
                      "coupon_code", "payment_method", "payment_status", "order_status", "delivery_address",
                      "cancel_reason", "created_at", "updated_at", "delivered_at", "cancelled_at"]
        _copy(cur, "orders", order_cols, ([o[c] for c in order_cols] for o in dataset.orders))
        item_cols = ["order_id", "product_id", "product_name", "quantity", "price", "tax_rate"]
        _copy(cur, "order_items", item_cols, ([item[c] for c in item_cols] for item in dataset.order_items))
        hist_cols = ["order_id", "status", "note", "created_at"]
        _copy(cur, "order_status_history", hist_cols, ([h[c] for c in hist_cols] for h in dataset.status_history))
        pay_cols = ["order_id", "provider", "provider_ref", "amount", "status", "failure_reason", "created_at", "updated_at"]
        _copy(cur, "payments", pay_cols, ([p[c] for c in pay_cols] for p in dataset.payments))
        mov_cols = ["product_id", "change", "reason", "reference_id", "stock_after", "created_at"]
        _copy(cur, "inventory_movements", mov_cols,
              ([m[c] for c in mov_cols] for m in sorted(dataset.movements, key=lambda m: m["created_at"])))
        alert_cols = ["product_id", "alert_type", "stock_level", "reorder_level", "created_at", "resolved_at"]
        _copy(cur, "inventory_alerts", alert_cols, ([a[c] for c in alert_cols] for a in dataset.alerts))
        event_cols = ["session_id", "user_id", "event_type", "product_id", "order_id", "created_at"]
        _copy(cur, "events", event_cols,
              ([e[c] for c in event_cols] for e in sorted(dataset.events, key=lambda e: e["created_at"])))

        # Explicit ids were inserted, so move every serial sequence past them.
        for table in ["categories", "users", "products", "orders", "order_items", "order_status_history",
                      "payments", "inventory_movements", "inventory_alerts", "events"]:
            cur.execute(
                f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM {table}), 0) + 1, false)"
            )
        conn.commit()
        cur.execute("ANALYZE")
