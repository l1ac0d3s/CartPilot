import pandas as pd

from cartpilot_ml.analytics.customers import build_rfm, score, segment


def test_quintile_scores():
    values = pd.Series(range(1, 11))
    assert score(values).tolist() == [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]
    assert score(values, higher_is_better=False).tolist() == [5, 5, 4, 4, 3, 3, 2, 2, 1, 1]


def test_ties_share_a_score():
    scores = score(pd.Series([1, 1, 1, 1, 9]))
    assert len(set(scores[:4])) == 1


def test_segment_rules():
    rfm = pd.DataFrame(
        [
            # r, f, orders, recency_days -> expected
            (5, 5, 20, 2, "Champions"),
            (5, 1, 1, 5, "New"),
            (1, 4, 8, 150, "At Risk"),
            (1, 1, 1, 200, "Dormant"),
            (3, 4, 7, 30, "Loyal"),
            (4, 2, 2, 12, "Potential Loyalist"),
        ],
        columns=["r_score", "f_score", "orders", "recency_days", "expected"],
    )
    assert segment(rfm).tolist() == rfm["expected"].tolist()


def test_build_rfm_ignores_cancelled_orders():
    now = pd.Timestamp("2026-06-01", tz="UTC")
    orders = pd.DataFrame({
        "id": [1, 2, 3],
        "user_id": [1, 1, 2],
        "total_amount": [100.0, 999.0, 50.0],
        "order_status": ["DELIVERED", "CANCELLED", "DELIVERED"],
        "created_at": pd.to_datetime(["2026-05-30", "2026-05-31", "2026-01-01"], utc=True),
    })
    rfm = build_rfm(orders, now)
    assert rfm.loc[1, "orders"] == 1
    assert rfm.loc[1, "monetary"] == 100.0
    assert rfm.loc[1, "r_score"] > rfm.loc[2, "r_score"]
