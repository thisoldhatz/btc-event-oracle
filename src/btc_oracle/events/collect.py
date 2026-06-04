from . import fear_greed, okx, gdelt, deribit
from .base import Event

# (name, callable). OKX is used for funding/OI because it works from data-center
# IPs (Bybit blocks them); the bybit adapter remains for local/other use.
_SOURCES = [
    ("fng", fear_greed.fetch),
    ("okx", okx.fetch),
    ("deribit", deribit.fetch),
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
