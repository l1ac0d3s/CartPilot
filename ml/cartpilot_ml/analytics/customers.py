"""Customer analytics: RFM (recency, frequency, monetary) scoring and segmentation."""

from __future__ import annotations

import numpy as np
import pandas as pd

from .common import jsonable, records, window

RFM_WINDOW_DAYS = 365

SEGMENT_ACTIONS = {
    "Champions": "Reward them: early access and referral perks. They don't need discounts.",
    "Loyal": "Upsell bigger baskets and subscriptions (e.g. a daily milk plan).",
    "Potential Loyalist": "Build the habit: free delivery on their next 3 orders.",
    "New": "Onboard: a second-order coupon within 7 days of the first order.",
    "At Risk": "Win them back now: a 'your usual cart' reminder plus a 15% coupon.",
    "Dormant": "Low-cost reactivation campaign; suppress if they stay unresponsive.",
}
SEGMENT_ORDER = list(SEGMENT_ACTIONS)


def score(series: pd.Series, higher_is_better: bool = True) -> pd.Series:
    """Quintile score 1-5 from percentile rank (ties share a score)."""
    pct = series.rank(method="average", pct=True, ascending=higher_is_better)
    return np.ceil(pct * 5).clip(1, 5).astype(int)


def segment(rfm: pd.DataFrame) -> pd.Series:
    r, f = rfm["r_score"], rfm["f_score"]
    conditions = [
        (r >= 4) & (f >= 4),
        (rfm["orders"] == 1) & (rfm["recency_days"] <= 30),
        (r <= 2) & (f >= 3),
        r <= 2,
        f >= 3,
    ]
    choices = ["Champions", "New", "At Risk", "Dormant", "Loyal"]
    return pd.Series(np.select(conditions, choices, default="Potential Loyalist"), index=rfm.index)


def build_rfm(orders: pd.DataFrame, now: pd.Timestamp, days: int = RFM_WINDOW_DAYS) -> pd.DataFrame:
    valid = window(orders[orders["order_status"] != "CANCELLED"], now - pd.Timedelta(days=days), now)
    if valid.empty:
        return pd.DataFrame(columns=["recency_days", "orders", "monetary", "r_score", "f_score", "m_score", "segment"])
    rfm = valid.groupby("user_id").agg(
        last_order=("created_at", "max"), orders=("id", "count"), monetary=("total_amount", "sum")
    )
    rfm["recency_days"] = (now - rfm["last_order"]).dt.total_seconds() / 86400
    rfm["r_score"] = score(rfm["recency_days"], higher_is_better=False)
    rfm["f_score"] = score(rfm["orders"])
    rfm["m_score"] = score(rfm["monetary"])
    rfm["rfm"] = rfm["r_score"].astype(str) + rfm["f_score"].astype(str) + rfm["m_score"].astype(str)
    rfm["segment"] = segment(rfm)
    return rfm


def customer_metrics(t, days: int = RFM_WINDOW_DAYS) -> dict:
    rfm = build_rfm(t.orders, t.now)
    total_revenue = rfm["monetary"].sum() if len(rfm) else 0

    summary = (
        rfm.groupby("segment").agg(
            customers=("orders", "size"),
            avg_recency_days=("recency_days", "mean"),
            avg_orders=("orders", "mean"),
            avg_monetary=("monetary", "mean"),
            revenue=("monetary", "sum"),
        ).reindex(SEGMENT_ORDER).dropna(subset=["customers"])
        if len(rfm) else pd.DataFrame()
    )
    if len(summary):
        summary["share"] = summary["customers"] / summary["customers"].sum()
        summary["revenue_share"] = summary["revenue"] / total_revenue
        summary["action"] = [SEGMENT_ACTIONS[s] for s in summary.index]

    users = t.users.set_index("id")[["name", "email"]]
    enriched = rfm.join(users, how="left").rename_axis("user_id").reset_index()
    columns = ["user_id", "name", "email", "recency_days", "orders", "monetary", "r_score", "f_score", "m_score",
               "rfm", "segment"]
    sample = enriched.sample(n=min(400, len(enriched)), random_state=7) if len(enriched) else enriched
    grid = rfm.groupby(["r_score", "f_score"]).size() if len(rfm) else pd.Series(dtype=int)

    return jsonable({
        "window": {"days": RFM_WINDOW_DAYS, "as_of": t.now},
        "summary": {
            "customers_with_orders": len(rfm),
            "registered_customers": len(t.users),
            "never_ordered": int(len(t.users) - len(rfm)),
            "avg_orders_per_customer": float(rfm["orders"].mean()) if len(rfm) else None,
            "avg_revenue_per_customer": float(rfm["monetary"].mean()) if len(rfm) else None,
        },
        "segments": records(summary.rename_axis("segment").reset_index()) if len(summary) else [],
        "rf_grid": [{"r": int(r), "f": int(f), "customers": int(n)} for (r, f), n in grid.items()],
        "top_customers": records(enriched.sort_values("monetary", ascending=False).head(10)[columns]),
        "at_risk_customers": records(
            enriched[enriched["segment"] == "At Risk"].sort_values("monetary", ascending=False).head(10)[columns]
        ),
        "scatter": records(sample[["user_id", "recency_days", "orders", "monetary", "segment"]]),
        "definitions": {
            "recency": "Days since the customer's last order",
            "frequency": "Orders in the last 12 months",
            "monetary": "Total spend in the last 12 months",
            "scores": "Each dimension is scored 1-5 by quintile (5 = best)",
        },
    })
