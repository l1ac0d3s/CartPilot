"""Thin PostgreSQL helpers built on psycopg 3."""

from __future__ import annotations

from contextlib import contextmanager

import pandas as pd
import psycopg

from .config import DATABASE_URL


@contextmanager
def connect(url: str | None = None):
    url = url or DATABASE_URL
    # Managed Postgres providers (Render, Railway) hand out postgres:// URLs; psycopg accepts both.
    with psycopg.connect(url, autocommit=False) as conn:
        yield conn


def query_df(sql: str, params: tuple | dict | None = None, url: str | None = None) -> pd.DataFrame:
    """Runs a query and returns a DataFrame (avoids pandas' SQLAlchemy-only read_sql warning)."""
    with connect(url) as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        columns = [d.name for d in cur.description]
        return pd.DataFrame(cur.fetchall(), columns=columns)
