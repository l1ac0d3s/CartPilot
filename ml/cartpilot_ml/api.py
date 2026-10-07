"""CartPilot intelligence service: recommendations + analytics over the shared PostgreSQL database.

Run:  uvicorn cartpilot_ml.api:app --port 8000
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Path, Query

from .analytics.business import business_metrics
from .analytics.customers import customer_metrics
from .analytics.inventory import inventory_metrics
from .analytics.products import product_metrics
from .analytics.tables import TableStore
from .config import CACHE_TTL_SECONDS, MODEL_TTL_SECONDS
from .db import query_df
from .recommender import CoPurchaseModel, recommend

log = logging.getLogger("cartpilot_ml")

LINES_SQL = """
    SELECT oi.order_id, oi.product_id, o.created_at
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.order_status <> 'CANCELLED' AND o.created_at >= now() - interval '365 days'"""
CATALOG_SQL = """
    SELECT p.id, p.name, p.brand, p.category_id, c.name AS category_name, p.stock, p.reorder_level, p.is_available
      FROM products p JOIN categories c ON c.id = p.category_id
     WHERE p.deleted_at IS NULL"""
HISTORY_SQL = """
    SELECT oi.order_id, oi.product_id, p.category_id, o.created_at
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
     WHERE o.user_id = %s AND o.order_status <> 'CANCELLED'"""

SECTIONS = {
    "business": business_metrics,
    "products": product_metrics,
    "inventory": inventory_metrics,
    "customers": customer_metrics,
}


class ModelCache:
    """Rebuilds the store-wide co-purchase model at most every MODEL_TTL_SECONDS."""

    def __init__(self, ttl: int = MODEL_TTL_SECONDS):
        self.ttl = ttl
        self._lock = threading.Lock()
        self._model: CoPurchaseModel | None = None
        self._built_at = 0.0

    def get(self) -> CoPurchaseModel:
        with self._lock:
            if self._model is None or time.monotonic() - self._built_at > self.ttl:
                started = time.perf_counter()
                self._model = CoPurchaseModel.build(query_df(LINES_SQL), datetime.now(timezone.utc))
                self._built_at = time.monotonic()
                log.info("co-purchase model rebuilt in %.2fs (%d orders)", time.perf_counter() - started,
                         self._model.orders)
            return self._model

    def invalidate(self) -> None:
        with self._lock:
            self._model = None


tables = TableStore()
models = ModelCache()
_results: dict[tuple[str, int], tuple[float, dict]] = {}
_results_lock = threading.Lock()

app = FastAPI(title="CartPilot Intelligence Service", version="1.0.0")


@app.get("/health")
def health():
    try:
        query_df("SELECT 1 AS ok")
        return {"status": "ok", "database": "up"}
    except Exception as exc:  # pragma: no cover - surfaced to the health check
        raise HTTPException(status_code=503, detail=f"database unavailable: {exc}") from exc


@app.get("/recommendations/{user_id}")
def recommendations(
    user_id: int = Path(ge=1),
    cart: str = Query("", description="comma-separated product ids currently in the cart"),
    k: int | None = Query(None, ge=1, le=20),
):
    try:
        cart_ids = [int(x) for x in cart.split(",") if x.strip()]
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="cart must be a comma-separated list of product ids") from exc
    result = recommend(
        history=query_df(HISTORY_SQL, (user_id,)),
        cart_ids=cart_ids,
        catalog=query_df(CATALOG_SQL),
        model=models.get(),
        now=datetime.now(timezone.utc),
        k=k,
    )
    return {"user_id": user_id, **result}


@app.get("/analytics/{section}")
def analytics(section: str, days: int = Query(30, ge=1, le=365)):
    if section not in SECTIONS:
        raise HTTPException(status_code=404, detail=f"unknown section '{section}'")
    key = (section, days)
    with _results_lock:
        cached = _results.get(key)
        if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
            return cached[1]
    result = SECTIONS[section](tables.get(), days)
    with _results_lock:
        _results[key] = (time.monotonic(), result)
    return result


@app.post("/admin/refresh")
def refresh():
    """Drops cached tables, analytics results and the co-purchase model (e.g. after reseeding)."""
    tables.invalidate()
    models.invalidate()
    with _results_lock:
        _results.clear()
    return {"refreshed": True}
