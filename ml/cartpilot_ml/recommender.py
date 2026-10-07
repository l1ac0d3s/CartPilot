"""Personalised "Add to your usual cart" recommender.

An explainable, scoring-based model (no deep learning). For every candidate product:

    score = 0.30 * purchase_frequency
          + 0.25 * recency
          + 0.20 * category_affinity
          + 0.15 * co_purchase
          + 0.10 * availability

All components are normalised to [0, 1]:

* purchase_frequency  share of the user's orders that contained the product
* recency             exponential decay since the user last bought it (half-life 21 days)
* category_affinity   user's share of purchases in the product's category, scaled by their top category
* co_purchase         how often the product is bought together with what is in the cart, blending the
                      user's own past combinations with store-wide basket co-occurrence
* availability        stock relative to twice the reorder level (well-stocked items score 1)

Pipeline: history -> features -> candidate generation -> filtering (in cart, substitutes of cart
items, out of stock, unavailable) -> scoring -> de-duplication -> top K. Users with no history get a cold-start variant that swaps
personal signals for store-wide popularity and trend.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime

import numpy as np
import pandas as pd

WEIGHTS = {
    "frequency": 0.30,
    "recency": 0.25,
    "category_affinity": 0.20,
    "co_purchase": 0.15,
    "availability": 0.10,
}
RECENCY_HALF_LIFE_DAYS = 21.0
NEIGHBOURS_PER_CONTEXT_ITEM = 25
POPULAR_PER_CATEGORY = 10
MIN_K, MAX_K = 5, 10


@dataclass
class CoPurchaseModel:
    """Store-wide basket statistics, rebuilt periodically from order history."""

    ids: np.ndarray  # product id for each matrix row/column
    index: dict[int, int]
    pair_counts: np.ndarray  # pair_counts[i, j] = orders containing both i and j
    order_counts: np.ndarray  # orders containing i
    popularity: np.ndarray  # orders containing i in the last 90 days, scaled to [0, 1]
    trend: np.ndarray  # orders containing i in the last 14 days, scaled to [0, 1]
    avg_basket_size: float
    orders: int

    @classmethod
    def build(cls, lines: pd.DataFrame, now: datetime) -> "CoPurchaseModel":
        """`lines`: one row per (order_id, product_id, created_at) for non-cancelled orders."""
        baskets = lines[["order_id", "product_id", "created_at"]].drop_duplicates(["order_id", "product_id"])
        ids = np.sort(baskets["product_id"].unique()) if len(baskets) else np.array([], dtype=int)
        index = {int(pid): i for i, pid in enumerate(ids)}
        n = len(ids)

        pairs = baskets[["order_id", "product_id"]].merge(baskets[["order_id", "product_id"]], on="order_id")
        pairs = pairs[pairs["product_id_x"] != pairs["product_id_y"]]
        pair_counts = np.zeros((n, n), dtype=np.float32)
        if len(pairs):
            grouped = pairs.groupby(["product_id_x", "product_id_y"]).size()
            rows = np.array([index[int(a)] for a in grouped.index.get_level_values(0)])
            cols = np.array([index[int(b)] for b in grouped.index.get_level_values(1)])
            pair_counts[rows, cols] = grouped.to_numpy()

        order_counts = np.zeros(n)
        counts = baskets.groupby("product_id").size()
        order_counts[[index[int(p)] for p in counts.index]] = counts.to_numpy()

        def window_popularity(days: int) -> np.ndarray:
            recent = baskets[baskets["created_at"] >= pd.Timestamp(now) - pd.Timedelta(days=days)]
            values = np.zeros(n)
            c = recent.groupby("product_id").size()
            values[[index[int(p)] for p in c.index]] = c.to_numpy()
            return values / values.max() if values.max() > 0 else values

        sizes = baskets.groupby("order_id").size()
        return cls(
            ids=ids,
            index=index,
            pair_counts=pair_counts,
            order_counts=order_counts,
            popularity=window_popularity(90),
            trend=window_popularity(14),
            avg_basket_size=float(sizes.mean()) if len(sizes) else 4.0,
            orders=int(len(sizes)),
        )

    def confidence(self, context: list[int]) -> pd.DataFrame:
        """P(candidate | context item) for every product (rows) and context item (columns)."""
        cols = [c for c in context if c in self.index]
        if not cols:
            return pd.DataFrame(index=self.ids)
        idx = [self.index[c] for c in cols]
        conf = self.pair_counts[idx, :] / np.maximum(self.order_counts[idx], 1)[:, None]
        return pd.DataFrame(conf.T, index=self.ids, columns=cols)

    def neighbours(self, product_id: int, top: int) -> list[int]:
        if product_id not in self.index:
            return []
        row = self.pair_counts[self.index[product_id]]
        best = np.argsort(-row)[:top]
        return [int(self.ids[i]) for i in best if row[i] > 0]

    def popularity_of(self, product_ids) -> np.ndarray:
        return np.array([self.popularity[self.index[p]] if p in self.index else 0.0 for p in product_ids])

    def trend_of(self, product_ids) -> np.ndarray:
        return np.array([self.trend[self.index[p]] if p in self.index else 0.0 for p in product_ids])


def _normalise(series: pd.Series) -> pd.Series:
    top = series.max() if len(series) else 0
    return series / top if top and top > 0 else series * 0


def _days_ago_text(days: float) -> str:
    if days < 1:
        return "today"
    if days < 2:
        return "yesterday"
    return f"{int(days)} days ago"


def recommend(
    history: pd.DataFrame,
    cart_ids: list[int],
    catalog: pd.DataFrame,
    model: CoPurchaseModel,
    now: datetime,
    k: int | None = None,
    weights: dict[str, float] = WEIGHTS,
) -> dict:
    """
    history: the user's purchase lines from non-cancelled orders
             (order_id, product_id, category_id, created_at)
    catalog: live, non-deleted products (id, name, brand, category_id, category_name, stock, reorder_level,
             is_available)
    """
    now_ts = pd.Timestamp(now)
    products = catalog.set_index("id")
    products["item"] = product_labels(products)
    names = products["name"].to_dict()
    category_names = products["category_name"].to_dict()
    cart = [int(c) for c in cart_ids]
    cart_set = set(cart)

    n_orders = int(history["order_id"].nunique()) if len(history) else 0
    personalised = n_orders > 0
    avg_basket = (
        float(history.groupby("order_id")["product_id"].nunique().mean()) if personalised else model.avg_basket_size
    )
    basket_gap = max(0, round(avg_basket) - len(cart))
    if k is None:
        k = int(min(MAX_K, max(MIN_K, basket_gap + 3)))

    # ---- Step 1-2: user features ------------------------------------------------------
    if personalised:
        orders_with = history.groupby("product_id")["order_id"].nunique()
        frequency = orders_with / n_orders
        days_since = (now_ts - history.groupby("product_id")["created_at"].max()).dt.total_seconds() / 86400
        recency = np.exp(-math.log(2) * days_since / RECENCY_HALF_LIFE_DAYS)
        category_share = history.groupby("category_id").size()
        category_affinity = _normalise(category_share.astype(float))
        top_frequent = frequency.sort_values(ascending=False).index[:3].tolist()
    else:
        orders_with = pd.Series(dtype=float)
        frequency = recency = pd.Series(dtype=float)
        days_since = pd.Series(dtype=float)
        cart_categories = products.loc[[c for c in cart if c in products.index], "category_id"]
        category_affinity = _normalise(cart_categories.value_counts().astype(float))
        top_frequent = []

    # Co-purchase context: what's in the cart, or the user's habitual items for an empty cart.
    context = cart if cart else top_frequent

    # ---- Step 3: candidate generation -------------------------------------------------
    candidates: set[int] = set(frequency.index.astype(int))
    for item in context:
        candidates.update(model.neighbours(item, NEIGHBOURS_PER_CONTEXT_ITEM))
    top_categories = category_affinity.sort_values(ascending=False).index[:3]
    in_stock = products[(products["is_available"]) & (products["stock"] > 0)]
    popularity_all = pd.Series(model.popularity_of(in_stock.index), index=in_stock.index)
    for category in top_categories:
        members = popularity_all[in_stock["category_id"] == category]
        candidates.update(members.sort_values(ascending=False).index[:POPULAR_PER_CATEGORY].astype(int))
    if not personalised:
        candidates.update(popularity_all.sort_values(ascending=False).index[:40].astype(int))

    # ---- Step 4: filtering ------------------------------------------------------------
    # Another brand or pack size of something already in the cart is a substitute, not an add-on.
    cart_items = set(products.loc[[c for c in cart if c in products.index], "item"])
    candidates = [
        c for c in candidates if c in in_stock.index and c not in cart_set and in_stock.at[c, "item"] not in cart_items
    ]
    if not candidates:
        return _response("personalized" if personalised else "cold_start", k, avg_basket, basket_gap, cart, [], weights)
    cand = in_stock.loc[candidates].copy()

    # ---- Step 5: scoring --------------------------------------------------------------
    if personalised:
        cand["frequency"] = frequency.reindex(cand.index).fillna(0.0)
        cand["recency"] = recency.reindex(cand.index).fillna(0.0)
    else:
        cand["frequency"] = model.popularity_of(cand.index)
        cand["recency"] = model.trend_of(cand.index)
    cand["category_affinity"] = cand["category_id"].map(category_affinity).fillna(0.0)

    # Blend personal and store-wide confidence 50/50 per context item; when only one source
    # knows a context item (e.g. a product the user never bought), that source is used alone.
    global_conf = model.confidence(context)
    personal_conf = _personal_confidence(history, context)
    columns = list(dict.fromkeys([*global_conf.columns, *personal_conf.columns]))
    g = global_conf.reindex(index=cand.index, columns=columns)
    p = personal_conf.reindex(index=cand.index, columns=columns)
    g[list(global_conf.columns)] = g[list(global_conf.columns)].fillna(0.0)
    p[list(personal_conf.columns)] = p[list(personal_conf.columns)].fillna(0.0)
    conf = ((p.fillna(g) + g.fillna(p)) / 2).fillna(0.0)
    if conf.shape[1]:
        cand["co_purchase_raw"] = conf.max(axis=1)
        cand["co_with"] = conf.idxmax(axis=1).where(cand["co_purchase_raw"] > 0)
    else:
        cand["co_purchase_raw"] = 0.0
        cand["co_with"] = None
    cand["co_purchase"] = _normalise(cand["co_purchase_raw"])
    cand["availability"] = np.minimum(1.0, cand["stock"] / np.maximum(1, 2 * cand["reorder_level"]))

    cand["score"] = sum(weights[c] * cand[c] for c in weights)
    cand["popularity"] = model.popularity_of(cand.index)
    ranked = cand.sort_values(["score", "popularity"], ascending=False)
    top = ranked.drop_duplicates("item").head(k)  # one SKU per item keeps the list diverse

    # ---- Step 6: explain + return top K -------------------------------------------------
    items = []
    for pid, row in top.iterrows():
        components = {c: round(float(row[c]), 3) for c in weights}
        reasons = _reasons(
            row, components, weights, personalised, int(orders_with.get(pid, 0)), n_orders,
            float(days_since.get(pid, np.nan)) if personalised else np.nan, names, category_names,
        )
        items.append({
            "product_id": int(pid),
            "name": row["name"],
            "score": round(float(row["score"]), 4),
            "components": components,
            "reasons": reasons,
        })
    return _response("personalized" if personalised else "cold_start", k, avg_basket, basket_gap, cart, items, weights)


def product_labels(products: pd.DataFrame) -> pd.Series:
    """Generic item label: the product name without its brand ("Amrit Dairy Toned Milk" -> "toned milk")."""
    brands = products["brand"].fillna("") if "brand" in products else pd.Series("", index=products.index)
    return pd.Series(
        [name[len(brand):].strip().lower() if brand and name.startswith(brand) else name.lower()
         for name, brand in zip(products["name"], brands)],
        index=products.index,
    )


def _personal_confidence(history: pd.DataFrame, context: list[int]) -> pd.DataFrame:
    """P(candidate | context item) computed over this user's own orders ("previous combinations")."""
    if not len(history) or not context:
        return pd.DataFrame()
    baskets = history[["order_id", "product_id"]].drop_duplicates()
    columns = {}
    for item in context:
        orders = baskets.loc[baskets["product_id"] == item, "order_id"]
        if orders.empty:
            continue
        together = baskets[baskets["order_id"].isin(orders) & (baskets["product_id"] != item)]
        columns[item] = together.groupby("product_id").size() / len(orders)
    return pd.DataFrame(columns).fillna(0.0) if columns else pd.DataFrame()


def _reasons(row, components, weights, personalised, times, n_orders, days, names, category_names) -> list[str]:
    contributions = sorted(((weights[c] * components[c], c) for c in weights if c != "availability"), reverse=True)
    reasons = []
    for value, component in contributions:
        if value <= 0 or len(reasons) == 2:
            continue
        if component == "frequency":
            reasons.append(f"In {times} of your {n_orders} orders" if personalised else "Popular at your store")
        elif component == "recency":
            reasons.append(f"Last bought {_days_ago_text(days)}" if personalised else "Trending this week")
        elif component == "co_purchase" and pd.notna(row["co_with"]):
            reasons.append(f"Often bought with {names.get(int(row['co_with']), 'items in your cart')}")
        elif component == "category_affinity":
            category = category_names.get(int(row.name), "this category")
            reasons.append(f"You often shop {category}" if personalised else f"Matches your cart: {category}")
    return reasons or ["In stock and ready to deliver"]


def _response(strategy, k, avg_basket, basket_gap, cart, items, weights) -> dict:
    return {
        "strategy": strategy,
        "k": k,
        "avg_basket_size": round(float(avg_basket), 2),
        "cart_size": len(cart),
        "basket_gap": int(basket_gap),
        "weights": weights,
        "items": items,
    }
