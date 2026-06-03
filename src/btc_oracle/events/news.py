import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import timezone
from email.utils import parsedate_to_datetime

FEEDS = [
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("Cointelegraph", "https://cointelegraph.com/rss/tag/bitcoin"),
]


@dataclass(frozen=True)
class NewsItem:
    title: str
    url: str
    source: str
    published_at: str   # ISO-8601 UTC ("" if unparseable)


def _iso(pubdate: str | None) -> str:
    if not pubdate:
        return ""
    try:
        return parsedate_to_datetime(pubdate).astimezone(timezone.utc).isoformat()
    except Exception:
        return ""


def parse_rss(xml_text: str, source: str, limit: int = 20) -> list[NewsItem]:
    """Parse RSS 2.0 into NewsItems. Returns [] on any XML error (fail-soft)."""
    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return []
    out: list[NewsItem] = []
    for it in root.findall(".//item"):
        title = (it.findtext("title") or "").strip()
        link = (it.findtext("link") or "").strip()
        if not title or not link:
            continue
        out.append(NewsItem(title=title, url=link, source=source,
                            published_at=_iso(it.findtext("pubDate"))))
        if len(out) >= limit:
            break
    return out


def fetch_news(http_get_text, limit: int = 12) -> list[NewsItem]:
    """Fetch + merge the RSS feeds, newest first. A failing feed is skipped.
    http_get_text: callable(url) -> str (injected; in prod a UA-bearing httpx call)."""
    merged: list[NewsItem] = []
    for source, url in FEEDS:
        try:
            merged.extend(parse_rss(http_get_text(url), source))
        except Exception:
            continue
    merged.sort(key=lambda n: n.published_at, reverse=True)
    return merged[:limit]


def news_to_dict(items: list[NewsItem]) -> list[dict]:
    return [{"title": n.title, "url": n.url, "source": n.source,
             "published_at": n.published_at} for n in items]
