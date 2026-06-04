# src/btc_oracle/feed.py
from datetime import datetime, timezone
from email.utils import format_datetime
from xml.sax.saxutils import escape

_LABEL = {"1w": "1-week", "1m": "1-month", "1y": "1-year"}


def _rfc822(iso: str) -> str:
    try:
        return format_datetime(datetime.fromisoformat(iso))
    except Exception:
        return format_datetime(datetime.now(timezone.utc))


def _usd(x):
    try:
        return "$" + format(round(float(x)), ",")
    except Exception:
        return "$?"


def build_rss(latest: dict, base: str = "https://vadym.online/btc") -> str:
    run_at = latest.get("run_at") or ""
    pub = _rfc822(run_at)
    regime = (latest.get("regime") or {}).get("label", "")
    items = []
    for f in latest.get("forecasts") or []:
        h = f.get("horizon", "?")
        label = _LABEL.get(h, h)
        p = round(float(f.get("p_up", 0.5)) * 100)
        title = f"BTC {label} forecast: {_usd(f.get('central'))} (P(up) {p}%)"
        desc = (f"Range {_usd(f.get('lower'))} to {_usd(f.get('upper'))}."
                + (f" {regime} volatility regime." if regime else ""))
        items.append(
            f"<item><title>{escape(title)}</title><link>{base}/</link>"
            f"<description>{escape(desc)}</description><pubDate>{pub}</pubDate>"
            f"<guid isPermaLink=\"false\">{escape(h + '-' + run_at)}</guid></item>"
        )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<rss version="2.0"><channel>'
        "<title>BTC Event Oracle</title>"
        f"<link>{base}/</link>"
        "<description>Honest, hourly Bitcoin forecasts scored against a random walk.</description>"
        f"<lastBuildDate>{pub}</lastBuildDate>"
        + "".join(items) +
        "</channel></rss>"
    )
