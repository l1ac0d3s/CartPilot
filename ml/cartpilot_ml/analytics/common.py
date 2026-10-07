"""Shared helpers for the analytics modules."""

from __future__ import annotations

import math
from datetime import date, datetime

import numpy as np
import pandas as pd

from ..config import TIMEZONE


def window(df: pd.DataFrame, start, end, column: str = "created_at") -> pd.DataFrame:
    return df[(df[column] >= start) & (df[column] < end)]


def local(ts: pd.Series) -> pd.Series:
    """Converts UTC timestamps to the store's local timezone (calendar days are local)."""
    return ts.dt.tz_convert(TIMEZONE)


def pct_change(current, previous):
    if current is None or previous in (None, 0) or (isinstance(previous, float) and math.isnan(previous)):
        return None
    return round((current - previous) / previous * 100, 1)


def ratio(numerator, denominator):
    return float(numerator) / float(denominator) if denominator else None


def order_lines(t) -> pd.DataFrame:
    """Order items joined with their order's status and timestamp, plus line revenue."""
    lines = t.items.merge(
        t.orders[["id", "user_id", "created_at", "order_status"]], left_on="order_id", right_on="id", how="inner"
    ).drop(columns="id")
    lines["revenue"] = lines["quantity"] * lines["price"]
    return lines


def average_stock(movements: pd.DataFrame, products: pd.DataFrame, start, end) -> pd.Series:
    """Time-weighted average stock level per product over [start, end), reconstructed from the ledger."""
    m = movements.sort_values(["product_id", "created_at"]).copy()
    m["next_at"] = m.groupby("product_id")["created_at"].shift(-1)
    m["next_at"] = m["next_at"].fillna(end)
    seg_start = m["created_at"].clip(lower=start)
    seg_end = m["next_at"].clip(upper=end)
    seconds = (seg_end - seg_start).dt.total_seconds().clip(lower=0)
    total = (end - start).total_seconds()
    weighted = (m["stock_after"] * seconds).groupby(m["product_id"]).sum() / total
    # Products without any ledger history have had their current stock all along.
    return weighted.reindex(products["id"]).fillna(products.set_index("id")["stock"]).astype(float)


def jsonable(value):
    """Recursively converts numpy/pandas values into JSON-safe Python types (NaN -> None)."""
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return None if math.isnan(value) or math.isinf(value) else round(float(value), 4)
    if isinstance(value, np.bool_):
        return bool(value)
    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.isoformat()
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if value is pd.NaT:
        return None
    return value


def records(df: pd.DataFrame) -> list[dict]:
    return [jsonable(row) for row in df.to_dict(orient="records")]
