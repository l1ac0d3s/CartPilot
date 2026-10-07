"""Loads the tables the analytics engine works on, with a short TTL cache."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone

import pandas as pd

from ..config import CACHE_TTL_SECONDS
from ..db import query_df


@dataclass
class Tables:
    orders: pd.DataFrame  # id, user_id, total_amount, subtotal, discount_amount, payment_method, payment_status,
    #                       order_status, cancel_reason, created_at
    items: pd.DataFrame  # order_id, product_id, quantity, price
    products: pd.DataFrame  # id, sku, name, category_id, category, price, cost_price, stock, reorder_level,
    #                         max_stock, is_available
    users: pd.DataFrame  # id, name, email, created_at
    events: pd.DataFrame  # session_id, user_id, event_type, created_at
    movements: pd.DataFrame  # product_id, change, reason, stock_after, created_at
    alerts: pd.DataFrame  # product_id, alert_type, created_at, resolved_at
    now: pd.Timestamp


QUERIES = {
    "orders": """
        SELECT id, user_id, subtotal::float8, delivery_fee::float8, tax_amount::float8, discount_amount::float8,
               total_amount::float8, payment_method, payment_status, order_status, cancel_reason, created_at
          FROM orders""",
    "items": "SELECT order_id, product_id, quantity, price::float8 FROM order_items",
    "products": """
        SELECT p.id, p.sku, p.name, p.brand, p.category_id, c.name AS category, p.price::float8,
               COALESCE(p.cost_price, p.price * 0.75)::float8 AS cost_price, p.stock, p.reorder_level,
               p.max_stock, p.is_available
          FROM products p JOIN categories c ON c.id = p.category_id
         WHERE p.deleted_at IS NULL""",
    "users": "SELECT id, name, email, created_at FROM users WHERE role = 'customer'",
    "events": "SELECT session_id, user_id, event_type, created_at FROM events",
    "movements": "SELECT product_id, change, reason, stock_after, created_at FROM inventory_movements",
    "alerts": "SELECT product_id, alert_type, created_at, resolved_at FROM inventory_alerts",
}


def _utc(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for column in columns:
        if column in df:
            df[column] = pd.to_datetime(df[column], utc=True)
    return df


def normalise(tables: dict[str, pd.DataFrame], now: datetime | None = None) -> Tables:
    """Coerces dtypes so the analytics code can rely on them (used for DB loads and tests alike)."""
    for name in ("orders", "users", "events", "movements", "alerts"):
        _utc(tables[name], ["created_at", "resolved_at"])
    return Tables(**tables, now=pd.Timestamp(now or datetime.now(timezone.utc)))


def load_tables() -> Tables:
    return normalise({name: query_df(sql) for name, sql in QUERIES.items()})


class TableStore:
    """Thread-safe TTL cache around `load_tables` so dashboards don't hammer the database."""

    def __init__(self, loader=load_tables, ttl: int = CACHE_TTL_SECONDS):
        self._loader = loader
        self._ttl = ttl
        self._lock = threading.Lock()
        self._value: Tables | None = None
        self._loaded_at = 0.0

    def get(self) -> Tables:
        with self._lock:
            if self._value is None or time.monotonic() - self._loaded_at > self._ttl:
                self._value = self._loader()
                self._loaded_at = time.monotonic()
            return self._value

    def invalidate(self) -> None:
        with self._lock:
            self._value = None
