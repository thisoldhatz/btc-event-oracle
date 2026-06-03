import sqlite3
import pytest


@pytest.fixture
def mem_db():
    """An in-memory SQLite connection with the schema applied."""
    from btc_oracle.store import init_schema
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    init_schema(conn)
    yield conn
    conn.close()
