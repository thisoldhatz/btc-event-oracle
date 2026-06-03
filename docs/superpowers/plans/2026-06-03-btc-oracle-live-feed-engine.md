# BTC Oracle — Live Feed (Engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the dashboard live, real content to show: add the actual world-event **signals** the model watched (Fear & Greed, perp funding, open interest, news tone) and a fresh **Bitcoin news feed** (keyless RSS) to the hourly `latest.json` snapshot.

**Architecture:** A new keyless RSS news adapter (`events/news.py`) that fetches CoinDesk + Cointelegraph-Bitcoin feeds, parses RSS 2.0 with the stdlib, and fails soft. The snapshot's `build_latest` gains `signals` (the collected `Event`s serialized) and `news` (RSS items), passed in by the orchestrator. All network is injected → offline tests. This is the engine half of the "more action" upgrade; the dashboard half is a separate plan built against the new snapshot shape.

**Tech Stack:** Python 3.10+, stdlib `xml.etree.ElementTree` + `email.utils.parsedate_to_datetime` (no new deps), `httpx` (text fetch, injected).

**Verified RSS shapes (probed live 2026-06-03):**
- CoinDesk `https://www.coindesk.com/arc/outboundfeeds/rss/` → RSS 2.0, `application/xml`, ~25 `<item>` each with `<title>`, `<link>`, `<pubDate>` (e.g. `Wed, 03 Jun 2026 20:33:51 +0000`).
- Cointelegraph Bitcoin tag `https://cointelegraph.com/rss/tag/bitcoin` → RSS 2.0, ~30 items, same item shape, Bitcoin-focused.

**New snapshot shape (latest.json) — additive, nothing removed:**
```jsonc
{ "...existing forecast fields...": "...",
  "signals": [ { "source": "fng", "signal": "fear_greed", "value": 11.0, "delta": -12.0,
                 "interpretation": "Fear & Greed 11/100 (Extreme Fear) ...", "observed_at": "..." } ],
  "news": [ { "title": "Bitcoin copying 2022 ...", "url": "https://...", "source": "Cointelegraph",
              "published_at": "2026-06-03T16:09:12+00:00" } ] }
```

**Existing interfaces (do not change):** `events.base.Event`, `store.insert_event`, `snapshots.build_latest/write_snapshots`, `run_hourly.run_once`, `cli._httpx_get`, `cli.build_enriched_forecasts`.

---

## File structure
```
src/btc_oracle/events/news.py     # NewsItem, parse_rss(), fetch_news(), news_to_dict()
src/btc_oracle/snapshots.py       # + event_to_signal(); build_latest(conn, signals, news); write_snapshots passthrough
src/btc_oracle/run_hourly.py      # run_once gains news=; serializes signals; passes both to write_snapshots
src/btc_oracle/cli.py             # + _httpx_get_text(); cmd_run fetches news and passes it in
tests/test_news.py
tests/test_snapshots_feed.py
tests/test_run_hourly_feed.py
```

---

### Task 1: RSS news adapter (`events/news.py`)

**Files:**
- Create: `src/btc_oracle/events/news.py`
- Test: `tests/test_news.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_news.py
from btc_oracle.events.news import NewsItem, parse_rss, fetch_news, news_to_dict

RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>Feed</title>
  <item><title>Bitcoin tags new high</title><link>https://x.com/a</link>
    <pubDate>Wed, 03 Jun 2026 20:33:51 +0000</pubDate></item>
  <item><title>Ether slips</title><link>https://x.com/b</link>
    <pubDate>Wed, 03 Jun 2026 16:09:12 +0000</pubDate></item>
  <item><title>No link should be skipped</title><pubDate>Wed, 03 Jun 2026 10:00:00 +0000</pubDate></item>
</channel></rss>"""


def test_parse_rss_extracts_items_and_iso_dates():
    items = parse_rss(RSS, "CoinDesk")
    assert len(items) == 2                      # the link-less item is dropped
    assert items[0].title == "Bitcoin tags new high"
    assert items[0].url == "https://x.com/a"
    assert items[0].source == "CoinDesk"
    assert items[0].published_at.startswith("2026-06-03T20:33:51")


def test_parse_rss_bad_xml_returns_empty():
    assert parse_rss("not xml", "CoinDesk") == []


def test_fetch_news_merges_sorts_desc_and_is_fail_soft():
    older = RSS.replace("20:33:51", "08:00:00").replace("Bitcoin tags new high", "Older CT item")
    def http_get_text(url):
        if "coindesk" in url:
            return RSS
        if "cointelegraph" in url:
            return older
        raise RuntimeError("boom")
    items = fetch_news(http_get_text, limit=5)
    # newest first across both feeds (CoinDesk 20:33 item leads)
    assert items[0].title == "Bitcoin tags new high"
    assert all(items[i].published_at >= items[i + 1].published_at for i in range(len(items) - 1))


def test_fetch_news_one_feed_down_still_returns_other():
    def http_get_text(url):
        if "coindesk" in url:
            return RSS
        raise RuntimeError("cointelegraph down")
    items = fetch_news(http_get_text)
    assert len(items) >= 1


def test_news_to_dict_shape():
    d = news_to_dict([NewsItem(title="t", url="u", source="s", published_at="2026-01-01T00:00:00+00:00")])
    assert d == [{"title": "t", "url": "u", "source": "s", "published_at": "2026-01-01T00:00:00+00:00"}]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_news.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.events.news'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/events/news.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_news.py -v`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/events/news.py tests/test_news.py
git commit -m "feat(events): keyless RSS news adapter (CoinDesk + Cointelegraph)"
```

---

### Task 2: Snapshot signals + news (`snapshots.py`)

**Files:**
- Modify: `src/btc_oracle/snapshots.py`
- Test: `tests/test_snapshots_feed.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_snapshots_feed.py
from btc_oracle.snapshots import event_to_signal, build_latest, write_snapshots
from btc_oracle.store import insert_run, insert_forecast
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay
from btc_oracle.events.base import Event
import json


def _seed(conn):
    rid = insert_run(conn, run_at="2026-06-03T20:00:00+00:00", spot_at_issue=65000.0,
                     spot_source="cg", model_id="m", prompt_version="v",
                     engine_version="e", llm_applied=True)
    b = baseline_forecast(spot=65000.0, sigma_daily=0.03, horizon="1w", horizon_days=7,
                          mu_daily=0.0, conf_level=0.60)
    f = apply_overlay(b, {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
                          "p_up_override": None, "confidence": "low"}, llm_applied=True)
    insert_forecast(conn, run_id=rid, target_at="2026-06-10T20:00:00+00:00", forecast=f,
                    rationale="r", drift_mode="zero")


def test_event_to_signal_shape():
    e = Event(source="fng", signal="fear_greed", value=11.0, delta=-12.0,
              interpretation="Extreme Fear", observed_at="2026-06-03T00:00:00+00:00")
    assert event_to_signal(e) == {
        "source": "fng", "signal": "fear_greed", "value": 11.0, "delta": -12.0,
        "interpretation": "Extreme Fear", "observed_at": "2026-06-03T00:00:00+00:00",
    }


def test_build_latest_includes_signals_and_news(mem_db):
    _seed(mem_db)
    signals = [event_to_signal(Event(source="fng", signal="fear_greed", value=11.0,
               delta=-12.0, interpretation="x", observed_at="t"))]
    news = [{"title": "BTC up", "url": "u", "source": "CoinDesk", "published_at": "t"}]
    latest = build_latest(mem_db, signals=signals, news=news)
    assert latest["signals"] == signals
    assert latest["news"] == news
    assert len(latest["forecasts"]) == 1


def test_build_latest_defaults_empty(mem_db):
    _seed(mem_db)
    latest = build_latest(mem_db)
    assert latest["signals"] == []
    assert latest["news"] == []


def test_write_snapshots_passes_signals_and_news(mem_db, tmp_path):
    _seed(mem_db)
    write_snapshots(mem_db, str(tmp_path),
                    signals=[{"source": "fng"}], news=[{"title": "x"}])
    data = json.loads((tmp_path / "latest.json").read_text())
    assert data["signals"] == [{"source": "fng"}]
    assert data["news"] == [{"title": "x"}]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_snapshots_feed.py -v`
Expected: FAIL — `ImportError: cannot import name 'event_to_signal'`

- [ ] **Step 3: Write minimal implementation** (modify `snapshots.py`)

Add the serializer (near the top, after imports):
```python
def event_to_signal(e) -> dict:
    return {"source": e.source, "signal": e.signal, "value": e.value,
            "delta": e.delta, "interpretation": e.interpretation,
            "observed_at": e.observed_at}
```

Change `build_latest` to accept and include `signals`/`news` (replace the existing `build_latest`):
```python
def build_latest(conn, signals: list | None = None, news: list | None = None) -> dict:
    run = get_latest_run(conn)
    if run is None:
        return {"run_at": None, "spot": None, "llm_applied": False,
                "model_id": None, "forecasts": [], "signals": signals or [],
                "news": news or []}
    forecasts = [{k: f[k] for k in _F_KEYS} for f in get_forecasts_for_run(conn, run["run_id"])]
    return {"run_at": run["run_at"], "spot": run["spot_at_issue"],
            "llm_applied": bool(run["llm_applied"]), "model_id": run["model_id"],
            "forecasts": forecasts, "signals": signals or [], "news": news or []}
```

Change `write_snapshots` to thread them through (replace the existing `write_snapshots`):
```python
def write_snapshots(conn, out_dir: str, signals: list | None = None,
                    news: list | None = None) -> list[str]:
    os.makedirs(out_dir, exist_ok=True)
    payloads = {"latest.json": build_latest(conn, signals=signals, news=news),
                "history.json": build_history(conn),
                "scores.json": build_scores(conn)}
    for name, payload in payloads.items():
        with open(os.path.join(out_dir, name), "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2)
    return list(payloads.keys())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_snapshots_feed.py tests/test_snapshots.py -v`
Expected: PASS (new feed tests + the original snapshot tests still green — defaults keep them working).

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/snapshots.py tests/test_snapshots_feed.py
git commit -m "feat(snapshots): include signals + news in latest.json"
```

---

### Task 3: Orchestrate signals + news (`run_hourly.py`, `cli.py`)

**Files:**
- Modify: `src/btc_oracle/run_hourly.py`
- Modify: `src/btc_oracle/cli.py`
- Test: `tests/test_run_hourly_feed.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_run_hourly_feed.py
import json
from btc_oracle.run_hourly import run_once
from btc_oracle.config import Settings
from btc_oracle.store import insert_prices


def _settings():
    return Settings(db_path=":memory:", conf_level=0.60, vol_lambda=0.94, mu_daily=0.0,
                    anthropic_api_key=None, coingecko_demo_key=None)


def _http_get(url, params, headers):
    if "alternative.me" in url:
        return {"data": [{"value": "11", "value_classification": "Extreme Fear", "timestamp": "1780444800"}]}
    if "funding" in url:
        return {"result": {"list": [{"fundingRate": "0.00008", "fundingRateTimestamp": "1780502400000"}]}}
    if "open-interest" in url:
        return {"result": {"list": [{"openInterest": "59000", "timestamp": "1780509600000"}]}}
    if "gdelt" in url:
        return {"timeline": [{"data": [{"date": "20260603T100000Z", "value": 2.0}]}]}
    raise AssertionError(url)


def test_run_once_writes_signals_and_news(mem_db, tmp_path):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])
    news = [{"title": "BTC headline", "url": "https://x", "source": "CoinDesk", "published_at": "2026-06-03T20:00:00+00:00"}]
    run_once(mem_db, _settings(), now_iso="2026-06-03T21:00:00+00:00", spot=140.0,
             http_get=_http_get, claude_call=None, out_dir=str(tmp_path),
             model_id="baseline-only", news=news)
    latest = json.loads((tmp_path / "latest.json").read_text())
    # signals derived from the collected events (fng, funding, oi, gdelt)
    assert {s["source"] for s in latest["signals"]} >= {"fng", "funding", "oi", "gdelt"}
    assert latest["news"] == news


def test_run_once_news_defaults_empty(mem_db, tmp_path):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])
    run_once(mem_db, _settings(), now_iso="2026-06-03T21:00:00+00:00", spot=140.0,
             http_get=_http_get, claude_call=None, out_dir=str(tmp_path), model_id="baseline-only")
    latest = json.loads((tmp_path / "latest.json").read_text())
    assert latest["news"] == []
    assert len(latest["signals"]) >= 4
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_run_hourly_feed.py -v`
Expected: FAIL — `run_once() got an unexpected keyword argument 'news'`

- [ ] **Step 3: Write minimal implementation**

In `run_hourly.py`, add the import and update `run_once` (add `news=None` param; serialize signals; pass both to `write_snapshots`):
```python
from .snapshots import write_snapshots, event_to_signal
```
Change the signature line and the final snapshot/return block:
```python
def run_once(conn, settings, *, now_iso, spot, http_get, claude_call, out_dir,
             model_id="baseline-only", news=None):
```
...and replace the `resolved = ...; written = ...; return ...` tail with:
```python
    resolved = resolve_matured(conn, now_iso)
    signals = [event_to_signal(e) for e in events]
    written = write_snapshots(conn, out_dir, signals=signals, news=news or [])
    return {"run_id": run_id, "forecasts": len(forecasts), "events": len(event_ids),
            "resolved": len(resolved), "llm_applied": llm_applied, "snapshots": written,
            "news": len(news or [])}
```
> NOTE: `run_hourly.py` currently imports `from .snapshots import write_snapshots`. Replace that line with the combined import shown above. `events` is already in scope (returned by `build_enriched_forecasts`).

In `cli.py`, add a text fetcher near `_httpx_get`:
```python
def _httpx_get_text(url):
    return httpx.get(url, headers={"User-Agent": "Mozilla/5.0 btc-oracle"},
                     timeout=20, follow_redirects=True).text
```
And in `cmd_run`, fetch news and pass it in (modify `cmd_run` — add the import + fetch + pass `news=`):
```python
def cmd_run(settings):
    from .run_hourly import run_once
    from .events.news import fetch_news, news_to_dict
    conn = connect(settings.db_path)
    init_schema(conn)
    backfill(conn, ccxt.coinbase(), source="coinbase", symbol="BTC/USD", timeframe="1d")
    spot = fetch_spot(_httpx_get, demo_key=settings.coingecko_demo_key)
    claude_call = (make_claude_call(settings.anthropic_api_key)
                   if settings.anthropic_api_key else None)
    model_id = "claude-sonnet-4-6" if settings.anthropic_api_key else "baseline-only"
    news = news_to_dict(fetch_news(_httpx_get_text))
    now_iso = datetime.now(timezone.utc).isoformat()
    summary = run_once(conn, settings, now_iso=now_iso, spot=spot, http_get=_httpx_get,
                       claude_call=claude_call, out_dir=settings.snapshot_dir,
                       model_id=model_id, news=news)
    print(f"run {summary['run_id'][:8]}: forecasts={summary['forecasts']} "
          f"events={summary['events']} news={summary['news']} resolved={summary['resolved']} "
          f"llm_applied={summary['llm_applied']} -> {settings.snapshot_dir}")
```
> NOTE: This replaces the existing `cmd_run`. If a `run_cycle` helper exists from Plan 3 and is used by tests, keep it intact — only `cmd_run` (the real entry point) changes here. If `cmd_run` previously delegated to `run_cycle`, instead inline the news fetch as shown and call `run_once` directly. Confirm `datetime, timezone` and `from .run_hourly import run_once` are available (import locally as shown).

- [ ] **Step 4: Run test to verify it passes + full suite**

Run: `.venv/Scripts/python -m pytest tests/test_run_hourly_feed.py -v`
Expected: PASS (2 passed)
Run: `.venv/Scripts/python -m pytest -q`
Expected: PASS (entire suite green — existing run_hourly/cli tests still pass since `news` defaults to None).

- [ ] **Step 5: Manual smoke test (live RSS + signals into the snapshot)**

Run:
```bash
.venv/Scripts/python -m btc_oracle.cli run
.venv/Scripts/python -c "import json;d=json.load(open('public_html/data/latest.json'));print('signals:',[s['source'] for s in d['signals']]);print('news:',len(d['news']),'e.g.',d['news'][0]['title'][:60] if d['news'] else 'none')"
```
Expected: prints `run ...: ... news=N ...` and the JSON shows `signals: ['fng','funding','oi','gdelt']` (rate-limited sources may drop, fail-soft) and several real news headlines.

- [ ] **Step 6: Commit**

```bash
git add src/btc_oracle/run_hourly.py src/btc_oracle/cli.py tests/test_run_hourly_feed.py
git commit -m "feat(engine): emit live signals + RSS news into the hourly snapshot"
```

---

## Self-Review

**1. Coverage:** signals (Fear&Greed/funding/OI/news-tone, serialized from the collected `Event`s) + RSS news (CoinDesk + Cointelegraph-Bitcoin, keyless, fail-soft, merged newest-first) added to `latest.json` → Tasks 1–3 ✓. Additive only — existing forecast/scores/history snapshots and all prior tests stay green via defaults (`signals or []`, `news or []`, `news=None`).

**2. Placeholder scan:** No TBD/TODO; complete code + exact commands. The two NOTE blocks (the combined snapshots import; preserving `run_cycle` while updating `cmd_run`) give exact guidance, not deferrals.

**3. Type consistency:** `NewsItem`→`news_to_dict` dict shape `{title,url,source,published_at}` is what `fetch_news`/`cmd_run` produce and what `build_latest`/`write_snapshots` store verbatim. `event_to_signal(Event)->dict` keys `{source,signal,value,delta,interpretation,observed_at}` match the dashboard's coming `Signal` type. `run_once(..., news=None)` matches `cmd_run`'s `news=` call and both feed tests. `http_get_text(url)->str` matches `_httpx_get_text` and `fetch_news`'s injected param.

---

## Next plan
- **Dashboard live features** (separate plan, built against this new `latest.json`): signals strip, news feed, ticking/flashing live price, 60s auto-refresh + "LIVE" pulse.
