from collections import Counter, defaultdict

import pytest


def test_volumes(dataset):
    summary = dataset.summary()
    assert summary["products"] == 500
    assert summary["categories"] == 16
    assert summary["customers"] == 150
    assert 800 <= summary["orders"] <= 1000
    assert summary["order_items"] >= 3 * summary["orders"]


def test_every_order_has_items_and_a_consistent_bill(dataset):
    items = defaultdict(list)
    for item in dataset.order_items:
        items[item["order_id"]].append(item)
    for order in dataset.orders:
        lines = items[order["id"]]
        assert lines
        assert order["subtotal"] == pytest.approx(sum(i["price"] * i["quantity"] for i in lines))
        expected = order["subtotal"] + order["delivery_fee"] + order["tax_amount"] - order["discount_amount"]
        assert order["total_amount"] == pytest.approx(expected)
        assert order["delivery_fee"] == (0 if order["subtotal"] >= 199 else 30)


def test_stock_ledger_reconciles_with_final_stock(dataset):
    balance = Counter()
    last = {}
    for m in sorted(dataset.movements, key=lambda m: m["created_at"]):
        balance[m["product_id"]] += m["change"]
        assert m["stock_after"] >= 0
        assert m["stock_after"] == balance[m["product_id"]]
        last[m["product_id"]] = m["stock_after"]
    for product in dataset.products:
        assert balance[product.id] == product.stock == last[product.id]


def test_alerts_open_only_when_stock_is_low(dataset):
    stock = {p.id: p for p in dataset.products}
    for alert in dataset.alerts:
        if alert["resolved_at"] is None:
            product = stock[alert["product_id"]]
            if alert["alert_type"] == "OUT_OF_STOCK":
                assert product.stock == 0
            else:
                assert product.stock <= product.reorder_level


def test_statuses_and_payments_are_coherent(dataset):
    for order in dataset.orders:
        if order["order_status"] == "DELIVERED":
            assert order["payment_status"] == "PAID"
            assert order["delivered_at"] is not None
        if order["order_status"] == "CANCELLED":
            assert order["cancelled_at"] is not None and order["cancel_reason"]
            assert order["payment_status"] in ("FAILED", "REFUNDED", "PENDING")


def test_behaviour_is_not_random(dataset):
    """Staple products must dominate each customer's history (what the recommender learns from)."""
    per_customer = defaultdict(Counter)
    orders = {o["id"]: o["user_id"] for o in dataset.orders}
    for item in dataset.order_items:
        per_customer[orders[item["order_id"]]][item["product_id"]] += 1
    order_counts = Counter(orders.values())
    heavy = [u for u, n in order_counts.items() if n >= 8]
    assert heavy
    top_share = [per_customer[u].most_common(1)[0][1] / order_counts[u] for u in heavy]
    assert sum(top_share) / len(top_share) > 0.5  # favourite item appears in most of their orders


def test_demo_and_admin_accounts(dataset):
    emails = {u["email"]: u for u in dataset.users}
    assert emails["admin@cartpilot.dev"]["role"] == "admin"
    assert emails["demo@cartpilot.dev"]["role"] == "customer"
