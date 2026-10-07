"""Inventory planning: SKU velocity, demand variability, reorder points, days of cover, turnover."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from .common import average_stock, jsonable, local, order_lines, ratio, records, window

DEFAULT_LEAD_TIME_DAYS = 2
SERVICE_LEVEL_Z = 1.65  # ~95% cycle service level
REVIEW_PERIOD_DAYS = 7


def inventory_metrics(t, days: int = 30, lead_time_days: float = DEFAULT_LEAD_TIME_DAYS, z: float = SERVICE_LEVEL_Z) -> dict:
    end = t.now
    start = end - pd.Timedelta(days=days)
    lines = order_lines(t)
    sold = window(lines[lines["order_status"] != "CANCELLED"], start, end)

    # Daily demand matrix (products x local calendar days), zero-filled.
    dates = pd.date_range(local(pd.Series([start])).iloc[0].normalize(), periods=days, freq="D").strftime("%Y-%m-%d")
    demand = (
        sold.assign(date=local(sold["created_at"]).dt.strftime("%Y-%m-%d"))
        .groupby(["product_id", "date"])["quantity"].sum()
        .unstack(fill_value=0)
        .reindex(index=t.products["id"], columns=dates, fill_value=0)
    )
    velocity = demand.mean(axis=1)
    sigma = demand.std(axis=1, ddof=1).fillna(0)

    p = t.products.set_index("id").copy()
    p["velocity"] = velocity
    p["demand_std"] = sigma
    p["reorder_point"] = np.ceil(velocity * lead_time_days + z * sigma * math.sqrt(lead_time_days)).astype(int)
    p["days_of_cover"] = np.where(velocity > 0, p["stock"] / velocity.replace(0, np.nan), np.nan)
    p["avg_stock"] = average_stock(t.movements, t.products, start, end)
    p["turnover_annualised"] = np.where(
        p["avg_stock"] > 0, demand.sum(axis=1) / p["avg_stock"].replace(0, np.nan) * (365 / days), np.nan
    )
    p["inventory_value"] = p["stock"] * p["cost_price"]

    conditions = [
        p["stock"] == 0,
        p["stock"] <= p["reorder_point"],
        p["days_of_cover"] < REVIEW_PERIOD_DAYS / 2,
    ]
    p["status"] = np.select(conditions, ["OUT_OF_STOCK", "REORDER_NOW", "WATCH"], default="OK")
    target = np.ceil(p["reorder_point"] + velocity * REVIEW_PERIOD_DAYS)
    p["suggested_order_qty"] = np.where(
        p["status"].isin(["OUT_OF_STOCK", "REORDER_NOW"]), np.maximum(target, p["max_stock"]) - p["stock"], 0
    ).astype(int)
    p["reorder_level_too_low"] = p["reorder_level"] < p["reorder_point"]

    active = p[p["is_available"]]
    urgency = {"OUT_OF_STOCK": 0, "REORDER_NOW": 1, "WATCH": 2, "OK": 3}
    ranked = active.assign(_rank=active["status"].map(urgency)).sort_values(
        ["_rank", "days_of_cover", "velocity"], ascending=[True, True, False]
    )
    columns = ["sku", "name", "category", "stock", "reorder_level", "reorder_point", "max_stock", "velocity",
               "demand_std", "days_of_cover", "turnover_annualised", "status", "suggested_order_qty",
               "reorder_level_too_low"]

    status_counts = active["status"].value_counts()
    return jsonable({
        "window": {"days": days, "start": start, "end": end},
        "parameters": {"lead_time_days": lead_time_days, "service_level_z": z, "review_period_days": REVIEW_PERIOD_DAYS},
        "summary": {
            "active_skus": len(active),
            "out_of_stock": int(status_counts.get("OUT_OF_STOCK", 0)),
            "reorder_now": int(status_counts.get("REORDER_NOW", 0)),
            "watch": int(status_counts.get("WATCH", 0)),
            "current_stockout_rate": ratio(status_counts.get("OUT_OF_STOCK", 0), len(active)),
            "inventory_value": float(active["inventory_value"].sum()),
            "median_days_of_cover": float(active["days_of_cover"].median()),
            "avg_turnover": float(np.nanmean(active["turnover_annualised"])) if active["turnover_annualised"].notna().any() else None,
            "reorder_levels_too_low": int(active["reorder_level_too_low"].sum()),
        },
        "items": records(ranked.head(60).rename_axis("product_id").reset_index()[["product_id", *columns]]),
        "fastest_movers": records(
            active.sort_values("velocity", ascending=False).head(10).rename_axis("product_id").reset_index()[
                ["product_id", "name", "category", "velocity", "stock", "days_of_cover"]
            ]
        ),
        "definitions": {
            "velocity": "Average units sold per day",
            "reorder_point": "velocity x lead time + z x demand std-dev x sqrt(lead time)",
            "days_of_cover": "Current stock / velocity",
            "turnover_annualised": "Units sold / time-weighted average stock, annualised",
        },
    })
