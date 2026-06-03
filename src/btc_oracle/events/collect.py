from . import fear_greed, bybit, gdelt
from .base import Event

# (name, callable) — add CoinDesk/marketaux here in later phases
_SOURCES = [
    ("fng", fear_greed.fetch),
    ("bybit", bybit.fetch),
    ("gdelt", gdelt.fetch_tone),
]


def collect_events(http_get) -> list[Event]:
    """Run every adapter; a failure in one source never breaks the others."""
    events: list[Event] = []
    for _name, fn in _SOURCES:
        try:
            events.extend(fn(http_get))
        except Exception:
            continue  # fail-soft: a flaky/rate-limited source is simply skipped
    return events
