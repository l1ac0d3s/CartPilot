"""Product metrics: top SKUs, SKU velocity, category revenue, inventory turnover, stock-outs, cancellations."""

from __future__ import annotations

import pandas as pd

from .common import average_stock, jsonable, order_lines, pct_change, ratio, records, window


def _sku_table(lines: pd.DataFrame, products: pd.DataFrame, days: int) -> pd.DataFrame:
    per_sku = lines.groupby("product_id").agg(
        units=("quantity", "sum"), revenue=("revenue", "sum"), orders=("order_id", "nunique")
    )
    table = products.set_index("id")[["sku", "name", "category", "stock", "cost_price", "is_available"]].join(
        per_sku, how="left"
    )
    table[["units", "revenue", "orders"]] = table[["units", "revenue", "orders"]].fillna(0)
    table["velocity"] = table["units"] / days  # units sold per day
    table["gross_margin"] = table["revenue"] - table["units"] * table["cost_price"]
    return table.rename_axis("product_id").reset_index()


def product_metrics(t, days: int = 30) -> dict:
    end = t.now
    start = end - pd.Timedelta(days=days)
    prev_start = start - pd.Timedelta(days=days)

    lines = order_lines(t)
    valid = lines[lines["order_status"] != "CANCELLED"]
    current = window(valid, start, end)
    previous = window(valid, prev_start, start)

    skus = _sku_table(current, t.products, days)
    columns = ["product_id", "sku", "name", "category", "units", "revenue", "orders", "velocity", "gross_margin", "stock"]
    top_revenue = skus.sort_values("revenue", ascending=False).head(10)[columns]
    top_units = skus.sort_values("units", ascending=False).head(10)[columns]
    slow = skus[skus["is_available"]].sort_values(["units", "revenue"]).head(10)[columns]

    # Category revenue and growth vs the previous period.
    cat_now = current.merge(t.products[["id", "category"]], left_on="product_id", right_on="id")
    cat_prev = previous.merge(t.products[["id", "category"]], left_on="product_id", right_on="id")
    categories = cat_now.groupby("category").agg(revenue=("revenue", "sum"), units=("quantity", "sum"))
    categories["previous_revenue"] = cat_prev.groupby("category")["revenue"].sum().reindex(categories.index).fillna(0)
    categories["share"] = categories["revenue"] / categories["revenue"].sum()
    categories["growth_pct"] = [pct_change(c, p) for c, p in zip(categories["revenue"], categories["previous_revenue"])]

    # Inventory turnover = COGS / average inventory value (annualised), per category.
    avg_stock = average_stock(t.movements, t.products, start, end)
    inv = t.products.set_index("id")[["category", "cost_price"]].copy()
    inv["avg_inventory_value"] = avg_stock * inv["cost_price"]
    inv["cogs"] = skus.set_index("product_id")["units"] * inv["cost_price"]
    turnover = inv.groupby("category")[["cogs", "avg_inventory_value"]].sum()
    turnover["turnover_annualised"] = turnover["cogs"] / turnover["avg_inventory_value"] * (365 / days)
    categories = categories.join(turnover["turnover_annualised"])
    overall_turnover = ratio(inv["cogs"].sum(), inv["avg_inventory_value"].sum())

    # Stock-outs from the alert history.
    outs = t.alerts[t.alerts["alert_type"] == "OUT_OF_STOCK"]
    in_period = window(outs, start, end)
    duration_h = ((in_period["resolved_at"].fillna(end) - in_period["created_at"]).dt.total_seconds() / 3600)
    active_skus = int(t.products["is_available"].sum())
    current_oos = t.products[(t.products["stock"] == 0) & t.products["is_available"]]

    # Cancellations.
    placed = window(t.orders, start, end)
    cancelled = placed[placed["order_status"] == "CANCELLED"]
    reasons = cancelled["cancel_reason"].fillna("Unknown").value_counts().rename_axis("reason").rename("orders")

    return jsonable({
        "window": {"days": days, "start": start, "end": end},
        "summary": {
            "units_sold": int(current["quantity"].sum()),
            "skus_sold": int(current["product_id"].nunique()),
            "active_skus": active_skus,
            "avg_sku_velocity": float(skus.loc[skus["is_available"], "velocity"].mean()),
            "inventory_turnover": overall_turnover * (365 / days) if overall_turnover is not None else None,
            "stockout_events": len(in_period),
            "stockout_rate": ratio(in_period["product_id"].nunique(), active_skus),
            "avg_stockout_hours": float(duration_h.mean()) if len(duration_h) else None,
            "currently_out_of_stock": len(current_oos),
            "cancellation_rate": ratio(len(cancelled), len(placed)),
            "cancelled_orders": len(cancelled),
        },
        "top_skus_by_revenue": records(top_revenue),
        "top_skus_by_units": records(top_units),
        "slow_movers": records(slow),
        "categories": records(categories.sort_values("revenue", ascending=False).rename_axis("category").reset_index()),
        "cancellation_reasons": records(reasons.reset_index()),
        "out_of_stock_now": records(current_oos[["id", "sku", "name", "category", "reorder_level"]]),
        "definitions": {
            "velocity": "Units sold per day over the period",
            "inventory_turnover": "Annualised COGS / time-weighted average inventory value (from the stock ledger)",
            "stockout_rate": "Share of active SKUs that ran out of stock at least once in the period",
        },
    })
