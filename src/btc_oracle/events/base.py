from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass(frozen=True)
class Event:
    source: str            # gdelt | fng | funding | oi | news
    signal: str            # e.g. news_tone, fear_greed, funding_rate, open_interest
    value: float | None
    delta: float | None
    interpretation: str
    observed_at: str       # ISO-8601 UTC
    headline: str | None = None
    url: str | None = None
    sentiment: str | None = None
    raw: dict = field(default_factory=dict)


def iso_from_epoch(seconds: str | int) -> str:
    return datetime.fromtimestamp(int(seconds), tz=timezone.utc).isoformat()


def iso_from_ms(ms: str | int) -> str:
    return datetime.fromtimestamp(int(ms) / 1000.0, tz=timezone.utc).isoformat()


def iso_from_gdelt(s: str) -> str:
    # GDELT format: 20260603T100000Z
    return datetime.strptime(s, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc).isoformat()


def condense(events: list[Event]) -> str:
    """One compact bullet per event for the LLM prompt."""
    if not events:
        return "- (no event signals available this run)"
    out = []
    for e in events:
        val = "" if e.value is None else f" = {e.value:g}"
        delta = "" if e.delta is None else f" (delta {e.delta:+g})"
        out.append(f"- [{e.source}] {e.signal}{val}{delta}: {e.interpretation}")
    return "\n".join(out)
