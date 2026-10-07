from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest

from cartpilot_ml.recommender import WEIGHTS, CoPurchaseModel, product_labels, recommend

NOW = datetime(2026, 4, 1, 9, 0, tzinfo=timezone.utc)

# id: (name, brand, category_id, stock, is_available)
PRODUCTS = {
    1: ("Amrit Dairy Toned Milk", "Amrit Dairy", 1, 50, True),
    2: ("Bake House White Bread", "Bake House", 2, 40, True),
    3: ("Happy Hens Farm Eggs", "Happy Hens", 3, 30, True),
    4: ("Amrit Dairy Salted Butter", "Amrit Dairy", 1, 25, True),
    5: ("Alpine Gold Cheese Slices", "Alpine Gold", 1, 20, True),
    6: ("Crunchy Bites Classic Salted Chips", "Crunchy Bites", 4, 60, True),
    7: ("Fizz Up Cola", "Fizz Up", 5, 0, True),  # out of stock
    8: ("Bee Natural Pure Honey", "Bee Natural", 6, 15, False),  # unavailable
    9: ("Nandan Farms Toned Milk", "Nandan Farms", 1, 50, True),  # substitute for milk
}
CATEGORY_NAMES = {1: "Dairy", 2: "Bakery", 3: "Eggs", 4: "Snacks", 5: "Beverages", 6: "Breakfast"}


@pytest.fixture
def catalog():
    return pd.DataFrame([
        {"id": pid, "name": n, "brand": b, "category_id": c, "category_name": CATEGORY_NAMES[c], "stock": s,
         "reorder_level": 5, "is_available": a}
        for pid, (n, b, c, s, a) in PRODUCTS.items()
    ])


def _orders(baskets, start_id=1, user_days_ago=None):
    rows = []
    for i, basket in enumerate(baskets):
        when = NOW - timedelta(days=(user_days_ago[i] if user_days_ago else 60 - i))
        for pid in basket:
            rows.append({"order_id": start_id + i, "product_id": pid, "created_at": when,
                         "category_id": PRODUCTS[pid][2]})
    return pd.DataFrame(rows)


@pytest.fixture
def user_history():
    # The spec example: milk x8, bread x7, eggs x6, butter x5.
    baskets = [
        [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4],
        [1, 2, 3], [1, 2], [1],
    ]
    return _orders(baskets, start_id=1, user_days_ago=[40, 34, 28, 21, 14, 10, 7, 3])


@pytest.fixture
def model():
    # Store-wide baskets: bread is frequently bought with cheese; chips with cola.
    baskets = [[2, 5], [2, 5], [2, 5, 1], [1, 2], [6, 7], [6, 7], [6], [1, 3], [2, 4], [3, 2, 5]]
    store = _orders(baskets, start_id=100)
    return CoPurchaseModel.build(store, NOW)


def test_weights_sum_to_one():
    assert sum(WEIGHTS.values()) == pytest.approx(1.0)


def test_spec_example_recommends_eggs_and_butter_first(user_history, catalog, model):
    result = recommend(user_history, [1, 2], catalog, model, NOW)
    names = [item["name"] for item in result["items"]]
    assert result["strategy"] == "personalized"
    assert set(names[:2]) == {"Happy Hens Farm Eggs", "Amrit Dairy Salted Butter"}
    assert "Alpine Gold Cheese Slices" in names  # discovered through co-purchase with bread


def test_filters_cart_out_of_stock_unavailable_and_substitutes(user_history, catalog, model):
    result = recommend(user_history, [1, 2], catalog, model, NOW)
    ids = {item["product_id"] for item in result["items"]}
    assert not ids & {1, 2}  # already in cart
    assert 7 not in ids  # out of stock
    assert 8 not in ids  # unavailable
    assert 9 not in ids  # another brand of milk is a substitute, not an add-on


def test_scores_are_sorted_bounded_and_explained(user_history, catalog, model):
    result = recommend(user_history, [1], catalog, model, NOW)
    scores = [item["score"] for item in result["items"]]
    assert scores == sorted(scores, reverse=True)
    for item in result["items"]:
        assert set(item["components"]) == set(WEIGHTS)
        assert all(0.0 <= v <= 1.0 for v in item["components"].values())
        expected = sum(WEIGHTS[c] * v for c, v in item["components"].items())
        assert item["score"] == pytest.approx(expected, abs=0.01)
        assert item["reasons"]


def test_frequency_reason_counts_orders(user_history, catalog, model):
    result = recommend(user_history, [1, 2], catalog, model, NOW)
    eggs = next(i for i in result["items"] if i["product_id"] == 3)
    assert "In 6 of your 8 orders" in eggs["reasons"]


def test_k_follows_basket_gap_with_bounds(user_history, catalog, model):
    result = recommend(user_history, [1], catalog, model, NOW)
    assert result["avg_basket_size"] == pytest.approx(3.25)  # 26 items / 8 orders
    assert result["basket_gap"] == 2
    assert result["k"] == 5  # clamp(gap + 3, 5, 10)
    assert recommend(user_history, [1], catalog, model, NOW, k=2)["k"] == 2


def test_cold_start_uses_store_popularity(catalog, model):
    empty = pd.DataFrame(columns=["order_id", "product_id", "created_at", "category_id"])
    result = recommend(empty, [6], catalog, model, NOW)
    assert result["strategy"] == "cold_start"
    assert result["items"]
    assert all(item["product_id"] not in (6, 7, 8) for item in result["items"])


def test_product_labels_strip_brand(catalog):
    labels = product_labels(catalog.set_index("id"))
    assert labels[1] == labels[9] == "toned milk"
