# BTC Oracle — Events + Bounded Claude Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the raw quant baseline (Plan 1) into an event-aware forecast: pull live world-event signals, condense them for an LLM, and let Claude apply a *small, hard-clamped, fully-auditable* adjustment — with an automatic fall back to the untouched baseline whenever the LLM is unavailable or misbehaves.

**Architecture:** A new `events/` sub-package with one fail-soft adapter per source (GDELT, Fear & Greed, Bybit funding/OI), each split into a pure `parse_*` function (TDD'd against real-shape fixtures) and a thin injected-client `fetch`. A separate `overlay.py` holds the honesty core: parse+clamp the LLM's JSON, apply only a bounded drift/vol nudge to the baseline, and fall back on any failure. `llm.py` wraps the real Anthropic SDK (prompt-cached) but is injected as a plain callable so tests never hit the network. This is Plan 2 of 5; persistence/orchestration/scoring is Plan 3.

**Tech Stack:** Python 3.10+, `anthropic` SDK (Claude Sonnet, prompt caching), `httpx`, stdlib `datetime`/`json`/`statistics`. All network behind injected callables → fully offline tests.

**Verified API shapes (probed live 2026-06-03 — use these exact shapes in fixtures):**
- **Fear & Greed** `GET https://api.alternative.me/fng/?limit=2` → `{"data":[{"value":"11","value_classification":"Extreme Fear","timestamp":"1780444800"}, {"value":"23",...}]}` (note: `value` is a **string**; `data[0]` is newest).
- **Bybit funding** `GET https://api.bybit.com/v5/market/funding/history?category=linear&symbol=BTCUSDT&limit=2` → `{"result":{"list":[{"symbol":"BTCUSDT","fundingRate":"0.0000814","fundingRateTimestamp":"1780502400000"}]}}` (`list[0]` newest; rate is a string).
- **Bybit OI** `GET https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=1h&limit=2` → `{"result":{"list":[{"openInterest":"59742.954","timestamp":"1780509600000"}]}}`.
- **GDELT** `GET https://api.gdeltproject.org/api/v2/doc/doc?query=bitcoin&mode=timelinetone&format=json&timespan=3d` → `{"timeline":[{"series":"...","data":[{"date":"20260603T100000Z","value":0.1069}]}]}` (`data[-1]` newest; **often returns HTTP 429 / non-JSON → must fail soft**).

**Spec refs:** §2b (overlay + clamps), §5 (event sources), §14 (#6 clamp defaults: drift ±50/150/100 bps, vol_mult [0.8,1.5], P(up) [0.30,0.70]).

---

## File structure

```
src/btc_oracle/
  events/
    __init__.py            # re-exports Event, condense, collect_events
    base.py                # Event dataclass, condense(), iso date helpers
    fear_greed.py          # parse() + fetch()
    bybit.py               # parse_funding() + parse_oi() + fetch()
    gdelt.py               # parse_timeline() + fetch_tone()
    collect.py             # collect_events(http_get) — fail-soft aggregator
  overlay.py               # EnrichedForecast, ADJ caps, parse_and_clamp, apply_overlay, run_overlay
  llm.py                   # SYSTEM_PROMPT, build_user_prompt, make_claude_call(settings)
tests/
  events/test_base.py
  events/test_fear_greed.py
  events/test_bybit.py
  events/test_gdelt.py
  events/test_collect.py
  test_overlay.py
  test_llm.py
  test_cli_preview.py
```

---

### Task 1: Event type, condenser, date helpers (`events/base.py`)

**Files:**
- Create: `src/btc_oracle/events/__init__.py`
- Create: `src/btc_oracle/events/base.py`
- Test: `tests/events/__init__.py` (empty), `tests/events/test_base.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/events/test_base.py
from btc_oracle.events.base import Event, condense, iso_from_epoch, iso_from_ms, iso_from_gdelt


def test_iso_helpers():
    assert iso_from_epoch("1780444800").startswith("2026-")
    assert iso_from_ms("1780502400000").startswith("2026-")
    assert iso_from_gdelt("20260603T100000Z") == "2026-06-03T10:00:00+00:00"


def test_condense_formats_one_bullet_per_event():
    evs = [
        Event(source="fng", signal="fear_greed", value=11.0, delta=-12.0,
              interpretation="Extreme Fear", observed_at="2026-06-03T00:00:00+00:00"),
        Event(source="funding", signal="funding_rate", value=0.0000814, delta=None,
              interpretation="longs pay", observed_at="2026-06-03T08:00:00+00:00"),
    ]
    text = condense(evs)
    lines = text.splitlines()
    assert len(lines) == 2
    assert lines[0].startswith("- [fng] fear_greed")
    assert "Extreme Fear" in lines[0]
    assert "(no event signals" not in text


def test_condense_handles_empty():
    assert "no event signals" in condense([])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/events/test_base.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.events'`

- [ ] **Step 3: Write minimal implementation**

`src/btc_oracle/events/__init__.py`:
```python
from .base import Event, condense  # noqa: F401
from .collect import collect_events  # noqa: F401
```
> NOTE: `collect` does not exist until Task 5. To keep imports working in the meantime, create `__init__.py` with ONLY the base import now, and add the `collect_events` import in Task 5. For this task, write:
```python
from .base import Event, condense  # noqa: F401
```

`src/btc_oracle/events/base.py`:
```python
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
```

Also create empty `tests/events/__init__.py`.

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/events/test_base.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/events/__init__.py src/btc_oracle/events/base.py tests/events/__init__.py tests/events/test_base.py
git commit -m "feat(events): Event type, condenser, and ISO date helpers"
```

---

### Task 2: Fear & Greed adapter (`events/fear_greed.py`)

**Files:**
- Create: `src/btc_oracle/events/fear_greed.py`
- Test: `tests/events/test_fear_greed.py`

- [ ] **Step 1: Write the failing test** (real-shape fixture)

```python
# tests/events/test_fear_greed.py
from btc_oracle.events.fear_greed import parse, fetch

PAYLOAD = {"data": [
    {"value": "11", "value_classification": "Extreme Fear", "timestamp": "1780444800"},
    {"value": "23", "value_classification": "Extreme Fear", "timestamp": "1780358400"},
]}


def test_parse_reads_value_and_delta():
    e = parse(PAYLOAD)
    assert e.source == "fng"
    assert e.value == 11.0
    assert e.delta == -12.0           # 11 - 23
    assert e.sentiment == "Extreme Fear"
    assert "Extreme Fear" in e.interpretation
    assert e.observed_at.startswith("2026-")


def test_parse_empty_returns_none():
    assert parse({"data": []}) is None


def test_fetch_uses_injected_getter():
    captured = {}
    def fake_get(url, params, headers):
        captured["url"] = url
        return PAYLOAD
    evs = fetch(fake_get)
    assert len(evs) == 1 and evs[0].value == 11.0
    assert "alternative.me" in captured["url"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/events/test_fear_greed.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.events.fear_greed'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/events/fear_greed.py
from .base import Event, iso_from_epoch

URL = "https://api.alternative.me/fng/"


def parse(payload: dict) -> Event | None:
    data = payload.get("data") or []
    if not data:
        return None
    cur = float(data[0]["value"])
    label = data[0].get("value_classification", "")
    prior = float(data[1]["value"]) if len(data) > 1 else cur
    delta = cur - prior
    interp = f"Fear & Greed {cur:.0f}/100 ({label}), {delta:+.0f} vs prior reading"
    return Event(
        source="fng", signal="fear_greed", value=cur, delta=delta,
        interpretation=interp, observed_at=iso_from_epoch(data[0]["timestamp"]),
        sentiment=label, raw=data[0],
    )


def fetch(http_get) -> list[Event]:
    payload = http_get(URL, {"limit": 2}, {})
    e = parse(payload)
    return [e] if e else []
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/events/test_fear_greed.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/events/fear_greed.py tests/events/test_fear_greed.py
git commit -m "feat(events): Fear & Greed index adapter"
```

---

### Task 3: Bybit funding + open-interest adapter (`events/bybit.py`)

**Files:**
- Create: `src/btc_oracle/events/bybit.py`
- Test: `tests/events/test_bybit.py`

- [ ] **Step 1: Write the failing test** (real-shape fixtures)

```python
# tests/events/test_bybit.py
from btc_oracle.events.bybit import parse_funding, parse_oi, fetch

FUNDING = {"result": {"list": [
    {"symbol": "BTCUSDT", "fundingRate": "0.0000814", "fundingRateTimestamp": "1780502400000"},
]}}
OI = {"result": {"list": [
    {"openInterest": "59742.954", "timestamp": "1780509600000"},
]}}


def test_parse_funding_positive_is_crowded_long():
    e = parse_funding(FUNDING)
    assert e.source == "funding"
    assert abs(e.value - 0.0000814) < 1e-12
    assert "long" in e.interpretation.lower()
    assert e.observed_at.startswith("2026-")


def test_parse_oi_reads_open_interest():
    e = parse_oi(OI)
    assert e.source == "oi"
    assert abs(e.value - 59742.954) < 1e-6


def test_parse_empty_returns_none():
    assert parse_funding({"result": {"list": []}}) is None
    assert parse_oi({"result": {}}) is None


def test_fetch_returns_both_signals():
    def fake_get(url, params, headers):
        return FUNDING if "funding" in url else OI
    evs = fetch(fake_get)
    sources = {e.source for e in evs}
    assert sources == {"funding", "oi"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/events/test_bybit.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/events/bybit.py
from .base import Event, iso_from_ms

BASE = "https://api.bybit.com"
FUNDING_URL = BASE + "/v5/market/funding/history"
OI_URL = BASE + "/v5/market/open-interest"


def _first(payload: dict) -> dict | None:
    lst = (payload.get("result") or {}).get("list") or []
    return lst[0] if lst else None


def parse_funding(payload: dict) -> Event | None:
    row = _first(payload)
    if not row:
        return None
    rate = float(row["fundingRate"])
    side = "longs pay shorts (crowded long)" if rate > 0 else "shorts pay longs (crowded short)"
    interp = f"Perp funding {rate * 100:+.4f}% — {side}"
    return Event(
        source="funding", signal="funding_rate", value=rate, delta=None,
        interpretation=interp, observed_at=iso_from_ms(row["fundingRateTimestamp"]), raw=row,
    )


def parse_oi(payload: dict) -> Event | None:
    row = _first(payload)
    if not row:
        return None
    oi = float(row["openInterest"])
    interp = f"BTC perp open interest {oi:,.0f} contracts"
    return Event(
        source="oi", signal="open_interest", value=oi, delta=None,
        interpretation=interp, observed_at=iso_from_ms(row["timestamp"]), raw=row,
    )


def fetch(http_get) -> list[Event]:
    common = {"category": "linear", "symbol": "BTCUSDT"}
    funding = parse_funding(http_get(FUNDING_URL, {**common, "limit": 2}, {}))
    oi = parse_oi(http_get(OI_URL, {**common, "intervalTime": "1h", "limit": 2}, {}))
    return [e for e in (funding, oi) if e]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/events/test_bybit.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/events/bybit.py tests/events/test_bybit.py
git commit -m "feat(events): Bybit funding-rate and open-interest adapter"
```

---

### Task 4: GDELT tone adapter (`events/gdelt.py`)

**Files:**
- Create: `src/btc_oracle/events/gdelt.py`
- Test: `tests/events/test_gdelt.py`

- [ ] **Step 1: Write the failing test** (real-shape fixture)

```python
# tests/events/test_gdelt.py
from btc_oracle.events.gdelt import parse_timeline, fetch_tone

PAYLOAD = {"timeline": [{"series": "Average Tone", "data": [
    {"date": "20260601T000000Z", "value": -1.0},
    {"date": "20260602T000000Z", "value": 1.0},
    {"date": "20260603T100000Z", "value": 4.0},
]}]}


def test_parse_takes_latest_and_delta_vs_prior_mean():
    e = parse_timeline(PAYLOAD, "news_tone")
    assert e.source == "gdelt"
    assert e.value == 4.0
    assert e.delta == 4.0 - 0.0   # latest 4.0 minus mean(-1,1)=0.0
    assert e.observed_at == "2026-06-03T10:00:00+00:00"


def test_parse_empty_returns_none():
    assert parse_timeline({"timeline": []}, "news_tone") is None
    assert parse_timeline({"timeline": [{"data": []}]}, "news_tone") is None


def test_fetch_tone_uses_getter():
    def fake_get(url, params, headers):
        assert params["mode"] == "timelinetone"
        return PAYLOAD
    evs = fetch_tone(fake_get)
    assert len(evs) == 1 and evs[0].value == 4.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/events/test_gdelt.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/events/gdelt.py
from .base import Event, iso_from_gdelt

URL = "https://api.gdeltproject.org/api/v2/doc/doc"
_UA = {"User-Agent": "Mozilla/5.0 btc-oracle"}


def parse_timeline(payload: dict, signal: str) -> Event | None:
    tl = payload.get("timeline") or []
    if not tl:
        return None
    data = tl[0].get("data") or []
    if not data:
        return None
    latest = data[-1]
    cur = float(latest["value"])
    prior = [float(p["value"]) for p in data[:-1]]
    avg = sum(prior) / len(prior) if prior else cur
    delta = cur - avg
    mood = "more positive" if delta > 0 else "more negative"
    interp = f"News tone {cur:+.2f} ({mood} than 3-day avg {avg:+.2f})"
    return Event(
        source="gdelt", signal=signal, value=cur, delta=delta,
        interpretation=interp, observed_at=iso_from_gdelt(latest["date"]), raw=latest,
    )


def fetch_tone(http_get) -> list[Event]:
    params = {"query": "bitcoin", "mode": "timelinetone", "format": "json", "timespan": "3d"}
    payload = http_get(URL, params, _UA)
    e = parse_timeline(payload, "news_tone")
    return [e] if e else []
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/events/test_gdelt.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/events/gdelt.py tests/events/test_gdelt.py
git commit -m "feat(events): GDELT news-tone adapter"
```

---

### Task 5: Fail-soft aggregator (`events/collect.py`)

**Files:**
- Create: `src/btc_oracle/events/collect.py`
- Modify: `src/btc_oracle/events/__init__.py` (add `collect_events` export)
- Test: `tests/events/test_collect.py`

- [ ] **Step 1: Write the failing test** (one source raises → others still returned)

```python
# tests/events/test_collect.py
from btc_oracle.events.collect import collect_events

FNG = {"data": [{"value": "11", "value_classification": "Extreme Fear", "timestamp": "1780444800"}]}
FUNDING = {"result": {"list": [{"fundingRate": "0.00008", "fundingRateTimestamp": "1780502400000"}]}}
OI = {"result": {"list": [{"openInterest": "59742.9", "timestamp": "1780509600000"}]}}


def test_collect_aggregates_all_sources():
    def fake_get(url, params, headers):
        if "alternative.me" in url:
            return FNG
        if "funding" in url:
            return FUNDING
        if "open-interest" in url:
            return OI
        if "gdelt" in url:
            return {"timeline": [{"data": [{"date": "20260603T100000Z", "value": 2.0}]}]}
        raise AssertionError(url)
    evs = collect_events(fake_get)
    assert {e.source for e in evs} == {"fng", "funding", "oi", "gdelt"}


def test_collect_is_fail_soft_per_source():
    def fake_get(url, params, headers):
        if "gdelt" in url:
            raise RuntimeError("429 Too Many Requests")  # GDELT flaky
        if "alternative.me" in url:
            return FNG
        if "funding" in url:
            return FUNDING
        if "open-interest" in url:
            return OI
        raise AssertionError(url)
    evs = collect_events(fake_get)
    # GDELT failed but the rest survive
    assert "gdelt" not in {e.source for e in evs}
    assert {"fng", "funding", "oi"}.issubset({e.source for e in evs})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/events/test_collect.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/events/collect.py
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
```

Then update `src/btc_oracle/events/__init__.py`:
```python
from .base import Event, condense  # noqa: F401
from .collect import collect_events  # noqa: F401
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/events/ -v`
Expected: PASS (all events tests green)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/events/collect.py src/btc_oracle/events/__init__.py tests/events/test_collect.py
git commit -m "feat(events): fail-soft multi-source aggregator"
```

---

### Task 6: Overlay — parse & clamp the LLM adjustment (`overlay.py` part 1)

**Files:**
- Create: `src/btc_oracle/overlay.py`
- Test: `tests/test_overlay.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_overlay.py
import pytest
from btc_oracle.overlay import parse_and_clamp, DRIFT_CAP_BPS, VOL_MULT_BOUNDS

GOOD = {
    "horizons": {
        "1w": {"drift_adj_bps": 35, "vol_mult": 1.10, "skew_adj": -0.05, "p_up_override": None, "confidence": "medium"},
        "1m": {"drift_adj_bps": 80, "vol_mult": 1.05, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
        "1y": {"drift_adj_bps": 0, "vol_mult": 1.00, "skew_adj": 0.0, "p_up_override": None, "confidence": "low"},
    },
    "rationale": "test",
    "event_refs": [],
}


def test_in_bounds_values_pass_through():
    adj = parse_and_clamp(GOOD)
    assert adj["horizons"]["1w"]["drift_adj_bps"] == 35
    assert adj["horizons"]["1w"]["vol_mult"] == 1.10


def test_out_of_bounds_are_clamped():
    payload = {"horizons": {
        "1w": {"drift_adj_bps": 9999, "vol_mult": 5.0, "skew_adj": -3.0, "p_up_override": 0.99, "confidence": "high"},
        "1m": {"drift_adj_bps": -9999, "vol_mult": 0.01, "skew_adj": 0.0, "p_up_override": None, "confidence": "low"},
        "1y": {"drift_adj_bps": 500, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "low"},
    }, "rationale": "x", "event_refs": []}
    adj = parse_and_clamp(payload)
    assert adj["horizons"]["1w"]["drift_adj_bps"] == DRIFT_CAP_BPS["1w"]       # +50
    assert adj["horizons"]["1m"]["drift_adj_bps"] == -DRIFT_CAP_BPS["1m"]      # -150
    assert adj["horizons"]["1y"]["drift_adj_bps"] == DRIFT_CAP_BPS["1y"]       # +100
    assert adj["horizons"]["1w"]["vol_mult"] == VOL_MULT_BOUNDS[1]            # 1.5
    assert adj["horizons"]["1m"]["vol_mult"] == VOL_MULT_BOUNDS[0]            # 0.8
    assert -0.2 <= adj["horizons"]["1w"]["skew_adj"] <= 0.2
    # p_up_override above the [0.30,0.70] ceiling is rejected -> None
    assert adj["horizons"]["1w"]["p_up_override"] is None


def test_missing_horizon_raises():
    with pytest.raises(ValueError):
        parse_and_clamp({"horizons": {"1w": GOOD["horizons"]["1w"]}})


def test_non_dict_raises():
    with pytest.raises(ValueError):
        parse_and_clamp("not a dict")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_overlay.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'btc_oracle.overlay'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/btc_oracle/overlay.py
from .types import HORIZONS

DRIFT_CAP_BPS = {"1w": 50.0, "1m": 150.0, "1y": 100.0}   # spec §14 #6
VOL_MULT_BOUNDS = (0.8, 1.5)
PUP_BOUNDS = (0.30, 0.70)
SKEW_BOUNDS = (-0.2, 0.2)
_VALID_CONF = {"low", "medium", "high"}


def _clamp(x, lo, hi):
    return max(lo, min(hi, x))


def parse_and_clamp(payload) -> dict:
    """Validate the LLM's adjustment JSON and hard-clamp every knob (spec §2b).
    Raises ValueError on malformed input (caller falls back to baseline)."""
    if not isinstance(payload, dict):
        raise ValueError("adjustment must be a dict")
    horizons = payload.get("horizons")
    if not isinstance(horizons, dict):
        raise ValueError("missing 'horizons'")
    out = {}
    for h in HORIZONS:                       # require all three horizons
        if h not in horizons or not isinstance(horizons[h], dict):
            raise ValueError(f"missing horizon {h}")
        a = horizons[h]
        cap = DRIFT_CAP_BPS[h]
        drift = _clamp(float(a.get("drift_adj_bps", 0.0)), -cap, cap)
        vol_mult = _clamp(float(a.get("vol_mult", 1.0)), *VOL_MULT_BOUNDS)
        skew = _clamp(float(a.get("skew_adj", 0.0)), *SKEW_BOUNDS)
        override = a.get("p_up_override", None)
        if override is not None:
            override = float(override)
            if not (PUP_BOUNDS[0] <= override <= PUP_BOUNDS[1]):
                override = None              # reject implausible directional calls
        conf = a.get("confidence", "low")
        if conf not in _VALID_CONF:
            conf = "low"
        out[h] = {"drift_adj_bps": drift, "vol_mult": vol_mult, "skew_adj": skew,
                  "p_up_override": override, "confidence": conf}
    return {"horizons": out,
            "rationale": str(payload.get("rationale", "")),
            "event_refs": list(payload.get("event_refs", []))}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_overlay.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/overlay.py tests/test_overlay.py
git commit -m "feat(overlay): parse and hard-clamp the LLM adjustment"
```

---

### Task 7: Overlay — apply the bounded adjustment (`overlay.py` part 2)

**Files:**
- Modify: `src/btc_oracle/overlay.py` (add `EnrichedForecast` + `apply_overlay`)
- Test: `tests/test_overlay.py` (append)

- [ ] **Step 1: Write the failing test** (append)

```python
# tests/test_overlay.py  (add)
import math
from btc_oracle.baseline import baseline_forecast
from btc_oracle.overlay import apply_overlay, EnrichedForecast


def _base():
    return baseline_forecast(spot=60000.0, sigma_daily=0.03, horizon="1w",
                             horizon_days=7, mu_daily=0.0, conf_level=0.60)


def test_zero_adjustment_reproduces_baseline():
    b = _base()
    adj = {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
           "p_up_override": None, "confidence": "medium"}
    f = apply_overlay(b, adj, llm_applied=True)
    assert isinstance(f, EnrichedForecast)
    assert abs(f.central - b.central) < 1e-6
    assert abs(f.lower - b.lower) < 1e-6
    assert abs(f.upper - b.upper) < 1e-6
    assert f.baseline_central == b.central


def test_positive_drift_raises_central_and_p_up():
    b = _base()
    adj = {"drift_adj_bps": 50.0, "vol_mult": 1.0, "skew_adj": 0.0,
           "p_up_override": None, "confidence": "high"}
    f = apply_overlay(b, adj, llm_applied=True)
    assert f.central > b.central
    assert f.p_up > b.p_up
    assert 0.30 <= f.p_up <= 0.70


def test_vol_mult_widens_band():
    b = _base()
    adj = {"drift_adj_bps": 0.0, "vol_mult": 1.5, "skew_adj": 0.0,
           "p_up_override": None, "confidence": "low"}
    f = apply_overlay(b, adj, llm_applied=True)
    assert (f.upper - f.lower) > (b.upper - b.lower)


def test_p_up_override_within_bounds_wins():
    b = _base()
    adj = {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
           "p_up_override": 0.65, "confidence": "high"}
    f = apply_overlay(b, adj, llm_applied=True)
    assert abs(f.p_up - 0.65) < 1e-9
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_overlay.py -v`
Expected: FAIL — `ImportError: cannot import name 'apply_overlay'`

- [ ] **Step 3: Write minimal implementation** (append to `overlay.py`)

```python
import math
from dataclasses import dataclass
from statistics import NormalDist
from .types import BaselineForecast

_ND = NormalDist()


@dataclass(frozen=True)
class EnrichedForecast:
    horizon: str
    horizon_days: int
    spot: float
    central: float
    lower: float
    upper: float
    conf_level: float
    p_up: float
    mu_h: float
    sigma_h: float
    confidence_label: str
    band_width_pct: float
    vol_model: str
    vol_window: int
    baseline_central: float
    baseline_p_up: float
    baseline_sigma_h: float
    drift_adj_bps: float
    vol_mult: float
    skew_adj: float
    llm_applied: bool


def apply_overlay(baseline: BaselineForecast, adj: dict, llm_applied: bool) -> EnrichedForecast:
    """Apply a single clamped horizon adjustment to a baseline forecast.
    MVP applies drift + vol only; skew_adj is recorded but not yet applied."""
    mu2 = baseline.mu_h + float(adj["drift_adj_bps"]) / 10_000.0
    sigma2 = baseline.sigma_h * float(adj["vol_mult"])
    central = baseline.spot * math.exp(mu2)
    z = _ND.inv_cdf((1 + baseline.conf_level) / 2)
    lower = baseline.spot * math.exp(mu2 - z * sigma2)
    upper = baseline.spot * math.exp(mu2 + z * sigma2)
    p_up = _ND.cdf(mu2 / sigma2) if sigma2 > 0 else 0.5
    override = adj.get("p_up_override")
    if override is not None:
        p_up = float(override)
    p_up = max(PUP_BOUNDS[0], min(PUP_BOUNDS[1], p_up))
    return EnrichedForecast(
        horizon=baseline.horizon, horizon_days=baseline.horizon_days, spot=baseline.spot,
        central=central, lower=lower, upper=upper, conf_level=baseline.conf_level, p_up=p_up,
        mu_h=mu2, sigma_h=sigma2, confidence_label=adj.get("confidence", "low"),
        band_width_pct=(upper - lower) / baseline.spot,
        vol_model=baseline.vol_model, vol_window=baseline.vol_window,
        baseline_central=baseline.central, baseline_p_up=baseline.p_up,
        baseline_sigma_h=baseline.sigma_h,
        drift_adj_bps=float(adj["drift_adj_bps"]), vol_mult=float(adj["vol_mult"]),
        skew_adj=float(adj["skew_adj"]), llm_applied=llm_applied,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_overlay.py -v`
Expected: PASS (8 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/overlay.py tests/test_overlay.py
git commit -m "feat(overlay): apply bounded drift/vol adjustment to baseline"
```

---

### Task 8: Overlay — orchestrate the LLM call with fallback (`overlay.py` part 3)

**Files:**
- Modify: `src/btc_oracle/overlay.py` (add `run_overlay`)
- Test: `tests/test_overlay.py` (append)

- [ ] **Step 1: Write the failing test** (append) — success path + the three failure modes

```python
# tests/test_overlay.py  (add)
import json
from btc_oracle.baseline import build_baseline_forecasts
from btc_oracle.overlay import run_overlay


def _baselines():
    return build_baseline_forecasts(spot=60000.0, sigma_daily=0.03)


def test_run_overlay_success_applies_and_flags_true():
    payload = {"horizons": {
        "1w": {"drift_adj_bps": 50, "vol_mult": 1.2, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
        "1m": {"drift_adj_bps": 0, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
        "1y": {"drift_adj_bps": 0, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "low"},
    }, "rationale": "crowded longs", "event_refs": ["evt1"]}
    def fake_claude(system, user):
        return json.dumps(payload)
    forecasts, rationale, applied = run_overlay(_baselines(), "events...", fake_claude)
    assert applied is True
    assert rationale == "crowded longs"
    f1w = next(f for f in forecasts if f.horizon == "1w")
    assert f1w.vol_mult == 1.2 and f1w.drift_adj_bps == 50


def test_run_overlay_falls_back_on_exception():
    def boom(system, user):
        raise RuntimeError("API down")
    forecasts, rationale, applied = run_overlay(_baselines(), "events", boom)
    assert applied is False
    for f in forecasts:
        assert f.vol_mult == 1.0 and f.drift_adj_bps == 0.0  # untouched baseline
    assert "baseline" in rationale.lower()


def test_run_overlay_falls_back_on_bad_json():
    def junk(system, user):
        return "not json at all"
    _, _, applied = run_overlay(_baselines(), "events", junk)
    assert applied is False


def test_run_overlay_falls_back_on_invalid_structure():
    def missing(system, user):
        return json.dumps({"horizons": {"1w": {"vol_mult": 1.0}}})  # missing 1m/1y
    _, _, applied = run_overlay(_baselines(), "events", missing)
    assert applied is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_overlay.py -v`
Expected: FAIL — `ImportError: cannot import name 'run_overlay'`

- [ ] **Step 3: Write minimal implementation** (append to `overlay.py`)

```python
import json as _json

_NEUTRAL = {"drift_adj_bps": 0.0, "vol_mult": 1.0, "skew_adj": 0.0,
            "p_up_override": None, "confidence": "low"}
_FALLBACK_RATIONALE = "Baseline only — LLM adjustment unavailable this run."


def run_overlay(baselines, condensed_events, claude_call):
    """Call the (injected) Claude function, clamp + apply its adjustment, and
    fall back to the untouched baseline on ANY failure. Returns
    (list[EnrichedForecast], rationale, llm_applied)."""
    from .llm import SYSTEM_PROMPT, build_user_prompt  # local import: avoids needing the SDK in math tests
    try:
        raw = claude_call(SYSTEM_PROMPT, build_user_prompt(baselines, condensed_events))
        adj = parse_and_clamp(_json.loads(raw))
        forecasts = [apply_overlay(b, adj["horizons"][b.horizon], llm_applied=True) for b in baselines]
        return forecasts, adj["rationale"] or "", True
    except Exception:
        forecasts = [apply_overlay(b, dict(_NEUTRAL), llm_applied=False) for b in baselines]
        return forecasts, _FALLBACK_RATIONALE, False
```

> NOTE: `run_overlay` imports `SYSTEM_PROMPT`/`build_user_prompt` from `llm` (Task 9). Implement Task 9 before running the `run_overlay` tests, OR temporarily define them. Since this plan is executed in order, Task 9 follows immediately — but to keep THIS task's tests green now, add the two names as simple stubs in `llm.py` first if needed. (The clean path: do Task 9's `build_user_prompt`/`SYSTEM_PROMPT` definitions, which have no SDK import at module top, then these tests pass.)

To avoid an ordering trap, create `src/btc_oracle/llm.py` now with just the pure pieces (the SDK import lives inside the factory, not at module top):
```python
# src/btc_oracle/llm.py  (pure pieces needed by overlay; SDK factory added in Task 9)
SYSTEM_PROMPT = (
    "You are a careful quantitative assistant for a Bitcoin forecasting engine. "
    "You are given a humble random-walk baseline (central price, confidence band, P(up)) "
    "for 1-week, 1-month, and 1-year horizons, plus a few condensed world-event signals. "
    "Bitcoin is near-random-walk at short horizons, so your adjustments MUST be small. "
    "Return ONLY JSON of the form "
    '{"horizons":{"1w":{"drift_adj_bps":<int>,"vol_mult":<0.8-1.5>,"skew_adj":<-0.2..0.2>,'
    '"p_up_override":<null or 0.30-0.70>,"confidence":"low|medium|high"},"1m":{...},"1y":{...}},'
    '"rationale":"<one short paragraph>","event_refs":[]}. '
    "drift_adj_bps is capped at +/-50 (1w), +/-150 (1m), +/-100 (1y); values outside bounds will be clamped. "
    "Prefer widening the band for event risk over moving the central estimate. No prose outside the JSON."
)


def build_user_prompt(baselines, condensed_events) -> str:
    lines = ["BASELINE (random-walk):"]
    for b in baselines:
        lines.append(
            f"- {b.horizon}: central={b.central:,.0f} "
            f"[{b.lower:,.0f}-{b.upper:,.0f}] P(up)={b.p_up:.2f} sigma_h={b.sigma_h:.4f}"
        )
    lines.append("\nWORLD-EVENT SIGNALS:")
    lines.append(condensed_events)
    lines.append("\nReturn the bounded adjustment JSON now.")
    return "\n".join(lines)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_overlay.py -v`
Expected: PASS (12 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/overlay.py src/btc_oracle/llm.py tests/test_overlay.py
git commit -m "feat(overlay): orchestrate Claude call with baseline fallback"
```

---

### Task 9: Real Claude client + prompt builder test (`llm.py`)

**Files:**
- Modify: `src/btc_oracle/llm.py` (add `make_claude_call`)
- Modify: `requirements.txt` (add `anthropic`)
- Test: `tests/test_llm.py`

- [ ] **Step 1: Add the dependency and install**

Append to `requirements.txt`:
```
anthropic>=0.40
```
Run: `.venv/Scripts/python -m pip install -q "anthropic>=0.40"`
Expected: installs cleanly.

- [ ] **Step 2: Write the failing test** (prompt builder is pure + testable; the network call is not unit-tested)

```python
# tests/test_llm.py
from btc_oracle.llm import build_user_prompt, SYSTEM_PROMPT, make_claude_call
from btc_oracle.baseline import build_baseline_forecasts


def test_user_prompt_contains_baseline_and_events():
    bs = build_baseline_forecasts(spot=60000.0, sigma_daily=0.03)
    prompt = build_user_prompt(bs, "- [fng] fear_greed = 11: Extreme Fear")
    assert "central=" in prompt
    assert "P(up)=" in prompt
    assert "Extreme Fear" in prompt
    assert "1w" in prompt and "1y" in prompt


def test_system_prompt_demands_json_only():
    assert "ONLY JSON" in SYSTEM_PROMPT
    assert "clamp" in SYSTEM_PROMPT.lower()


def test_make_claude_call_returns_callable():
    # No API key needed to construct the callable (network only happens when called).
    fn = make_claude_call(api_key="sk-test-not-real", model="claude-sonnet-4-6")
    assert callable(fn)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_llm.py -v`
Expected: FAIL — `ImportError: cannot import name 'make_claude_call'`

- [ ] **Step 4: Write minimal implementation** (append to `llm.py`)

```python
# append to src/btc_oracle/llm.py
DEFAULT_MODEL = "claude-sonnet-4-6"


def make_claude_call(api_key: str, model: str = DEFAULT_MODEL):
    """Build a callable(system, user) -> str that calls Claude with prompt
    caching on the static system prompt. The SDK is imported lazily so the rest
    of the engine (and tests) never require it at import time."""
    from anthropic import Anthropic
    client = Anthropic(api_key=api_key)

    def _call(system: str, user: str) -> str:
        resp = client.messages.create(
            model=model,
            max_tokens=1024,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
        )
        return "".join(block.text for block in resp.content if getattr(block, "type", "") == "text")

    return _call
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_llm.py -v`
Expected: PASS (3 passed)

- [ ] **Step 6: Commit**

```bash
git add src/btc_oracle/llm.py requirements.txt tests/test_llm.py
git commit -m "feat(llm): prompt-cached Claude Sonnet client (injected, lazy SDK)"
```

---

### Task 10: `forecast-preview` CLI command (end-to-end, fail-soft)

**Files:**
- Modify: `src/btc_oracle/cli.py` (add `build_enriched_forecasts` + `cmd_preview` + subparser)
- Test: `tests/test_cli_preview.py`

- [ ] **Step 1: Write the failing test** (pure assembly with fakes — no network, no real LLM)

```python
# tests/test_cli_preview.py
import json
from btc_oracle.cli import build_enriched_forecasts
from btc_oracle.config import Settings
from btc_oracle.store import insert_prices


def _settings():
    return Settings(db_path=":memory:", conf_level=0.60, vol_lambda=0.94, mu_daily=0.0,
                    anthropic_api_key=None, coingecko_demo_key=None)


def test_build_enriched_forecasts_with_events_and_fake_llm(mem_db):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])

    def fake_http_get(url, params, headers):
        if "alternative.me" in url:
            return {"data": [{"value": "11", "value_classification": "Extreme Fear", "timestamp": "1780444800"}]}
        if "funding" in url:
            return {"result": {"list": [{"fundingRate": "0.00008", "fundingRateTimestamp": "1780502400000"}]}}
        if "open-interest" in url:
            return {"result": {"list": [{"openInterest": "59000", "timestamp": "1780509600000"}]}}
        if "gdelt" in url:
            return {"timeline": [{"data": [{"date": "20260603T100000Z", "value": 2.0}]}]}
        raise AssertionError(url)

    def fake_claude(system, user):
        return json.dumps({"horizons": {
            "1w": {"drift_adj_bps": 20, "vol_mult": 1.1, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
            "1m": {"drift_adj_bps": 0, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "medium"},
            "1y": {"drift_adj_bps": 0, "vol_mult": 1.0, "skew_adj": 0.0, "p_up_override": None, "confidence": "low"},
        }, "rationale": "fear is high", "event_refs": []})

    forecasts, rationale, applied, events = build_enriched_forecasts(
        mem_db, _settings(), spot=140.0, http_get=fake_http_get, claude_call=fake_claude)

    assert applied is True
    assert rationale == "fear is high"
    assert len(forecasts) == 3
    assert {e.source for e in events} >= {"fng", "funding", "oi", "gdelt"}
    f1w = next(f for f in forecasts if f.horizon == "1w")
    assert f1w.vol_mult == 1.1


def test_build_enriched_forecasts_without_llm_falls_back(mem_db):
    insert_prices(mem_db, [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i, 0) for i in range(40)])

    def fake_http_get(url, params, headers):
        return {"data": []} if "alternative.me" in url else {"result": {"list": []}, "timeline": []}

    # claude_call=None simulates "no API key configured" -> fallback path
    forecasts, rationale, applied, events = build_enriched_forecasts(
        mem_db, _settings(), spot=140.0, http_get=fake_http_get, claude_call=None)
    assert applied is False
    assert len(forecasts) == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_cli_preview.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_enriched_forecasts'`

- [ ] **Step 3: Write minimal implementation** (append/modify `cli.py`)

Add these imports near the top of `cli.py` (with the existing imports):
```python
from .events import collect_events, condense
from .overlay import run_overlay
from .llm import make_claude_call
```

Add the assembly function and command:
```python
def _noop_claude(system, user):
    # Used when no API key is configured: forces the honest baseline-only path.
    raise RuntimeError("no LLM configured")


def build_enriched_forecasts(conn, settings, spot, http_get, claude_call):
    """Baseline -> live events -> bounded Claude overlay (or fallback).
    Returns (forecasts, rationale, llm_applied, events)."""
    baselines = compute_current_baseline(conn, settings, spot=spot)
    events = collect_events(http_get)
    call = claude_call if claude_call is not None else _noop_claude
    forecasts, rationale, applied = run_overlay(baselines, condense(events), call)
    return forecasts, rationale, applied, events


def cmd_preview(settings):
    conn = connect(settings.db_path)
    init_schema(conn)
    spot = fetch_spot(_httpx_get, demo_key=settings.coingecko_demo_key)
    claude_call = (make_claude_call(settings.anthropic_api_key)
                   if settings.anthropic_api_key else None)
    forecasts, rationale, applied, events = build_enriched_forecasts(
        conn, settings, spot=spot, http_get=_httpx_get, claude_call=claude_call)
    print(f"spot={spot:,.0f}  llm_applied={applied}  events={len(events)}")
    for f in forecasts:
        print(f"{f.horizon:>3} [{f.confidence_label:>6}]: central={f.central:,.0f} "
              f"[{f.lower:,.0f} - {f.upper:,.0f}] P(up)={f.p_up:.0%} "
              f"(driftbps={f.drift_adj_bps:+.0f} volx={f.vol_mult:.2f})")
    print(f"rationale: {rationale}")
```

Update `main()` to register the subcommand (modify the existing `main`):
```python
def main(argv=None):
    p = argparse.ArgumentParser(prog="btc-oracle")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("backfill", help="ingest BTC daily history")
    sub.add_parser("baseline", help="print current baseline forecasts")
    sub.add_parser("preview", help="print event-aware (overlay) forecasts")
    args = p.parse_args(argv)
    settings = get_settings()
    {"backfill": cmd_backfill, "baseline": cmd_baseline, "preview": cmd_preview}[args.cmd](settings)
```

> `_httpx_get` already exists in `cli.py` from Plan 1 — reuse it (do not redefine).

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_cli_preview.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Run the FULL suite**

Run: `.venv/Scripts/python -m pytest -q`
Expected: PASS (all Plan 1 + Plan 2 tests green)

- [ ] **Step 6: Manual smoke test (no API key needed — exercises the fail-soft path against live event APIs)**

Run:
```bash
.venv/Scripts/python -m btc_oracle.cli backfill
.venv/Scripts/python -m btc_oracle.cli preview
```
Expected: prints `spot=… llm_applied=False events=N` (N ≥ 2 from the live keyless sources) and three forecasts. With `llm_applied=False` the bands equal the baseline (drift=0, volx=1.00) — proving the honest fallback. (Set `ANTHROPIC_API_KEY` in `.env` to see `llm_applied=True` with a real bounded nudge + rationale.)

- [ ] **Step 7: Commit**

```bash
git add src/btc_oracle/cli.py tests/test_cli_preview.py
git commit -m "feat(cli): preview command wiring baseline + events + overlay"
```

---

## Self-Review

**1. Spec coverage (this plan's slice — §2b overlay, §5 events, §14 #6 clamps):**
- §5 event sources (free starter set): GDELT (Task 4), Fear & Greed (Task 2), Bybit funding+OI (Task 3) → Tasks 1–5 ✓ ; CoinDesk/marketaux are correctly deferred (optional, keyed) — `_SOURCES` in `collect.py` is the documented extension point ✓
- §2b "what Claude sees" (baseline + condensed bullets) → `condense` (Task 1) + `build_user_prompt` (Task 8/9) ✓
- §2b "what Claude outputs" (strict JSON) + clamps (drift ±50/150/100, vol [0.8,1.5], P(up) [0.30,0.70], reject bad override) → `parse_and_clamp` (Task 6) ✓ matches §14 #6 exactly
- §2b "bounded apply" (drift+vol; skew recorded not applied in MVP) → `apply_overlay` (Task 7) ✓
- §2b "fallback on failure → llm_applied=false" (exception / bad JSON / invalid structure) → `run_overlay` (Task 8), 3 failure tests ✓
- §2a prompt caching on static system prompt → `make_claude_call` cache_control (Task 9) ✓
- Fail-soft per source (the GDELT-429 lesson) → `collect_events` (Task 5) ✓
- Out of this plan (correctly): persistence/run_hourly/resolution/scoring/snapshots → Plan 3; dashboard → Plan 4; deploy → Plan 5.

**2. Placeholder scan:** No TBD/TODO. Every code/test step is complete. The two ordering NOTES (events `__init__` in Task 1/5; `llm.py` pure pieces created in Task 8 before Task 9's factory) are explicit, with the exact code to write — not deferrals.

**3. Type consistency:** `Event` fields (Task 1) are constructed identically in every adapter (Tasks 2–4) and read by `condense`. `EnrichedForecast` (Task 7) is produced by `apply_overlay` and consumed in `run_overlay` (Task 8) and `cli` (Task 10). `parse_and_clamp` returns `{"horizons":{h:{drift_adj_bps,vol_mult,skew_adj,p_up_override,confidence}}, "rationale", "event_refs"}`; `apply_overlay` reads exactly those per-horizon keys; `run_overlay` indexes `adj["horizons"][b.horizon]` — consistent. `claude_call(system, user)->str`, `http_get(url, params, headers)->dict`, and `build_enriched_forecasts(conn, settings, spot, http_get, claude_call)` signatures match across overlay/llm/cli and all tests. `make_claude_call(api_key, model=...)` matches its Task 9 test and the Task 10 call site (`make_claude_call(settings.anthropic_api_key)`).

---

## Next plans (not part of this one)
- **Plan 3:** store write helpers (insert_run/forecast/event/link, queries) → `run_hourly` orchestrator (backfill → baseline → events → overlay → persist) → resolution + scoring (Brier/MAPE/coverage vs random walk) → JSON snapshot emitter → `cli run`.
- **Plan 4:** Next.js static-export command dashboard (Recharts) reading `/data/*.json`.
- **Plan 5:** cPanel deploy — Python app + real hourly cron + secrets + go-live, then rotate the shared cPanel password.
