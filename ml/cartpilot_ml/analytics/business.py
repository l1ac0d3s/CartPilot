"""Business metrics: GMV, AOV, orders, conversion, repeat purchase, retention, cart abandonment, CLV."""

from __future__ import annotations

import pandas as pd

from .common import jsonable, local, pct_change, ratio, records, window

FUNNEL_STEPS = [
    ("sessions", None),
    ("viewed_product", "product_view"),
    ("added_to_cart", "add_to_cart"),
    ("started_checkout", "checkout_started"),
    ("placed_order", "order_placed"),
]

DEFINITIONS = {
    "gmv": "Gross merchandise value: total billed amount of non-cancelled orders",
    "aov": "Average order value = GMV / orders",
    "orders": "Orders placed in the period, excluding cancellations",
    "conversion_rate": "Sessions that placed an order / all sessions",
    "repeat_purchase_rate": "Customers with 2+ orders in the period / customers who ordered",
    "retention_rate": "Customers active in the previous period who ordered again this period",
    "cart_abandonment_rate": "Sessions that added to cart but did not order / sessions that added to cart",
    "cancellation_rate": "Cancelled orders / all orders placed",
    "clv": "Predicted customer lifetime value = AOV x orders per customer per quarter x expected lifetime "
           "(quarters), where lifetime = 1 / (1 - 90-day retention)",
}


def funnel(events: pd.DataFrame, start, end) -> dict:
    e = window(events, start, end)
    if e.empty:
        return {"steps": [], "conversion_rate": None, "cart_abandonment_rate": None, "sessions": 0}
    flags = pd.crosstab(e["session_id"], e["event_type"]) > 0
    flags = flags.reindex(columns=[s for _, s in FUNNEL_STEPS if s], fill_value=False)
    sessions = len(flags)
    ordered = flags["order_placed"]
    carted = flags["add_to_cart"]
    steps = [{"step": name, "sessions": int(sessions if col is None else flags[col].sum())} for name, col in FUNNEL_STEPS]
    for step in steps:
        step["rate"] = ratio(step["sessions"], sessions)
    return {
        "sessions": sessions,
        "steps": steps,
        "conversion_rate": ratio(ordered.sum(), sessions),
        "cart_abandonment_rate": ratio((carted & ~ordered).sum(), carted.sum()),
    }


def _period_kpis(t, start, end) -> dict:
    placed = window(t.orders, start, end)
    valid = placed[placed["order_status"] != "CANCELLED"]
    gmv = float(valid["total_amount"].sum())
    customers = valid["user_id"].nunique()
    per_customer = valid.groupby("user_id").size()
    flow = funnel(t.events, start, end)
    return {
        "gmv": gmv,
        "orders": len(valid),
        "aov": ratio(gmv, len(valid)),
        "customers": customers,
        "repeat_purchase_rate": ratio((per_customer >= 2).sum(), customers),
        "conversion_rate": flow["conversion_rate"],
        "cart_abandonment_rate": flow["cart_abandonment_rate"],
        "cancellation_rate": ratio((placed["order_status"] == "CANCELLED").sum(), len(placed)),
        "discounts": float(valid["discount_amount"].sum()),
        "_active": set(valid["user_id"]),
    }


def _clv(valid: pd.DataFrame, now: pd.Timestamp) -> dict:
    """
    Predictive CLV from the last two 90-day windows:
        CLV = AOV x orders per active customer per quarter x expected lifetime (quarters)
        expected lifetime = 1 / (1 - quarterly retention), capped at 5 years
    """
    quarter = pd.Timedelta(days=90)
    current = window(valid, now - quarter, now)
    previous = window(valid, now - 2 * quarter, now - quarter)
    if current.empty or previous.empty:
        return {"value": None}
    retained = set(current["user_id"]) & set(previous["user_id"])
    retention = len(retained) / previous["user_id"].nunique()
    lifetime_quarters = min(20.0, 1 / (1 - retention)) if retention < 1 else 20.0
    orders_per_quarter = len(current) / current["user_id"].nunique()
    aov = float(current["total_amount"].mean())
    year = window(valid, now - pd.Timedelta(days=365), now)
    return {
        "value": aov * orders_per_quarter * lifetime_quarters,
        "aov": aov,
        "orders_per_customer_per_quarter": orders_per_quarter,
        "quarterly_retention": retention,
        "expected_lifetime_months": lifetime_quarters * 3,
        "revenue_per_customer_12m": float(year["total_amount"].sum() / year["user_id"].nunique()),
    }


def _month_index(ts: pd.Series) -> pd.Series:
    stamp = local(ts)
    return stamp.dt.year * 12 + stamp.dt.month - 1


def _cohorts(valid_year: pd.DataFrame, first_orders: pd.Series, max_cohorts: int = 12) -> list[dict]:
    """Monthly acquisition cohorts: % of each cohort that ordered N months after their first order."""
    if valid_year.empty:
        return []
    first = _month_index(first_orders)
    current = int(_month_index(valid_year["created_at"]).max())
    df = pd.DataFrame({"user_id": valid_year["user_id"], "month": _month_index(valid_year["created_at"])})
    df["cohort"] = df["user_id"].map(first)
    out = []
    for cohort in range(current - max_cohorts + 1, current + 1):
        size = int((first == cohort).sum())
        if not size:
            continue
        active = df[df["cohort"] == cohort].groupby("month")["user_id"].nunique()
        out.append({
            "cohort": f"{cohort // 12}-{cohort % 12 + 1:02d}",
            "size": size,
            "retention": [round(100 * active.get(cohort + o, 0) / size, 1) for o in range(current - cohort + 1)],
        })
    return out


def business_metrics(t, days: int = 30) -> dict:
    end = t.now
    start = end - pd.Timedelta(days=days)
    prev_start = start - pd.Timedelta(days=days)

    current = _period_kpis(t, start, end)
    previous = _period_kpis(t, prev_start, start)
    retained = current["_active"] & previous["_active"]

    valid = t.orders[t.orders["order_status"] != "CANCELLED"]
    first_orders = valid.groupby("user_id")["created_at"].min()
    new_customers = int(((first_orders >= start) & (first_orders < end)).sum())
    prev_new = int(((first_orders >= prev_start) & (first_orders < start)).sum())
    valid_year = window(valid, end - pd.Timedelta(days=365), end)
    clv = _clv(valid, end)

    kpis = {}
    for key in ["gmv", "orders", "aov", "customers", "conversion_rate", "repeat_purchase_rate",
                "cart_abandonment_rate", "cancellation_rate", "discounts"]:
        kpis[key] = {"value": current[key], "previous": previous[key], "change_pct": pct_change(current[key], previous[key])}
    kpis["retention_rate"] = {"value": ratio(len(retained), len(previous["_active"])), "previous": None, "change_pct": None}
    kpis["new_customers"] = {"value": new_customers, "previous": prev_new, "change_pct": pct_change(new_customers, prev_new)}
    kpis["clv"] = {"value": clv["value"], "previous": None, "change_pct": None}

    in_window = window(valid, start, end)
    stamp = local(in_window["created_at"])
    daily = (
        in_window.assign(date=stamp.dt.strftime("%Y-%m-%d"))
        .groupby("date")
        .agg(gmv=("total_amount", "sum"), orders=("id", "count"))
    )
    all_days = pd.date_range(local(pd.Series([start])).iloc[0].normalize(), local(pd.Series([end])).iloc[0].normalize(),
                             freq="D").strftime("%Y-%m-%d")
    daily = daily.reindex(all_days, fill_value=0).rename_axis("date").reset_index()

    year_stamp = local(valid_year["created_at"]).dt.strftime("%Y-%m")
    first_month = local(first_orders).dt.strftime("%Y-%m")
    monthly = valid_year.assign(month=year_stamp).groupby("month").agg(
        gmv=("total_amount", "sum"), orders=("id", "count"), active_customers=("user_id", "nunique")
    )
    monthly["new_customers"] = first_month.value_counts().reindex(monthly.index, fill_value=0)
    monthly["aov"] = monthly["gmv"] / monthly["orders"]
    monthly = monthly.rename_axis("month").reset_index()

    heat = in_window.assign(day=stamp.dt.dayofweek, hour=stamp.dt.hour).groupby(["day", "hour"]).size()
    heatmap = [{"day": int(d), "hour": int(h), "orders": int(n)} for (d, h), n in heat.items()]

    placed = window(t.orders, start, end)
    return jsonable({
        "window": {"days": days, "start": start, "end": end},
        "kpis": kpis,
        "funnel": funnel(t.events, start, end)["steps"],
        "daily": records(daily),
        "monthly": records(monthly),
        "cohorts": _cohorts(valid_year, first_orders),
        "order_heatmap": heatmap,
        "payment_methods": records(placed.groupby("payment_method").size().rename("orders").reset_index()),
        "order_statuses": records(placed.groupby("order_status").size().rename("orders").reset_index()),
        "clv": clv,
        "definitions": DEFINITIONS,
    })
