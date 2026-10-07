from datetime import datetime, timezone

import pandas as pd
import pytest

from cartpilot_ml.analytics.tables import normalise
from cartpilot_ml.datagen.simulate import Config, generate

NOW = datetime(2026, 6, 15, 6, 0, tzinfo=timezone.utc)


@pytest.fixture(scope="session")
def dataset():
    return generate(Config(customers=150, target_orders=900, seed=7, now=NOW))


@pytest.fixture(scope="session")
def tables(dataset):
    """The generated dataset shaped exactly like the tables the analytics engine loads from PostgreSQL."""
    categories = {c["id"]: c["name"] for c in dataset.categories}
    products = pd.DataFrame([
        {"id": p.id, "sku": p.sku, "name": p.name, "brand": p.brand, "category_id": p.category_id,
         "category": categories[p.category_id], "price": p.price, "cost_price": p.cost, "stock": p.stock,
         "reorder_level": p.reorder_level, "max_stock": p.max_stock, "is_available": p.is_available}
        for p in dataset.products
    ])
    users = pd.DataFrame([u for u in dataset.users if u["role"] == "customer"])[["id", "name", "email", "created_at"]]
    return normalise({
        "orders": pd.DataFrame(dataset.orders),
        "items": pd.DataFrame(dataset.order_items)[["order_id", "product_id", "quantity", "price"]],
        "products": products,
        "users": users,
        "events": pd.DataFrame(dataset.events)[["session_id", "user_id", "event_type", "created_at"]],
        "movements": pd.DataFrame(dataset.movements)[["product_id", "change", "reason", "stock_after", "created_at"]],
        "alerts": pd.DataFrame(dataset.alerts)[["product_id", "alert_type", "created_at", "resolved_at"]],
    }, now=NOW)
