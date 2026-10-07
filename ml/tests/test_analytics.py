import json

import pandas as pd
import pytest

from cartpilot_ml.analytics.business import business_metrics, funnel
from cartpilot_ml.analytics.customers import SEGMENT_ORDER, customer_metrics
from cartpilot_ml.analytics.inventory import inventory_metrics
from cartpilot_ml.analytics.products import product_metrics


def test_business_kpis_match_raw_data(tables):
    result = business_metrics(tables, 30)
    json.dumps(result)
    start = tables.now - pd.Timedelta(days=30)
    window = tables.orders[(tables.orders["created_at"] >= start) & (tables.orders["order_status"] != "CANCELLED")]
    assert result["kpis"]["gmv"]["value"] == pytest.approx(window["total_amount"].sum(), rel=1e-6)
    assert result["kpis"]["orders"]["value"] == len(window)
    assert result["kpis"]["aov"]["value"] == pytest.approx(window["total_amount"].mean(), rel=1e-3)
    for key in ("conversion_rate", "repeat_purchase_rate", "cart_abandonment_rate", "retention_rate"):
        assert 0 <= result["kpis"][key]["value"] <= 1
    assert result["kpis"]["clv"]["value"] > 0
    assert len(result["daily"]) in (30, 31)
    assert result["cohorts"] and result["cohorts"][0]["retention"][0] == 100.0


def test_funnel_counts_sessions():
    events = pd.DataFrame({
        "session_id": ["a", "a", "a", "b", "b", "c"],
        "user_id": [1, 1, 1, 2, 2, None],
        "event_type": ["product_view", "add_to_cart", "order_placed", "product_view", "add_to_cart", "product_view"],
        "created_at": pd.to_datetime(["2026-01-01"] * 6, utc=True),
    })
    result = funnel(events, pd.Timestamp("2025-12-31", tz="UTC"), pd.Timestamp("2026-01-02", tz="UTC"))
    assert result["sessions"] == 3
    assert result["conversion_rate"] == pytest.approx(1 / 3)
    assert result["cart_abandonment_rate"] == pytest.approx(1 / 2)


def test_product_metrics(tables):
    result = product_metrics(tables, 30)
    json.dumps(result)
    revenues = [r["revenue"] for r in result["top_skus_by_revenue"]]
    assert revenues == sorted(revenues, reverse=True)
    assert sum(c["share"] for c in result["categories"]) == pytest.approx(1.0, abs=1e-3)
    assert 0 <= result["summary"]["cancellation_rate"] <= 1
    assert result["summary"]["inventory_turnover"] > 0


def test_inventory_metrics(tables):
    result = inventory_metrics(tables, 30)
    json.dumps(result)
    statuses = [item["status"] for item in result["items"]]
    rank = {"OUT_OF_STOCK": 0, "REORDER_NOW": 1, "WATCH": 2, "OK": 3}
    assert [rank[s] for s in statuses] == sorted(rank[s] for s in statuses)
    for item in result["items"]:
        if item["status"] in ("OUT_OF_STOCK", "REORDER_NOW"):
            assert item["stock"] <= item["reorder_point"]
            assert item["suggested_order_qty"] > 0


def test_customer_segments(tables):
    result = customer_metrics(tables)
    json.dumps(result)
    segments = {s["segment"]: s for s in result["segments"]}
    assert set(segments) <= set(SEGMENT_ORDER)
    assert sum(s["customers"] for s in segments.values()) == result["summary"]["customers_with_orders"]
    assert segments["Champions"]["avg_orders"] > segments["Dormant"]["avg_orders"]
    assert segments["Champions"]["avg_recency_days"] < segments["Dormant"]["avg_recency_days"]
