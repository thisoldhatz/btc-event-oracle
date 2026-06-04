# BTC Oracle — OG Share Cards + RSS Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every forecast shareable + subscribable: the engine renders a **1200×630 OG share image** (Pillow) each hour with the current forecast, and emits an **RSS feed** of forecasts — both pushed to the host alongside the JSON. The dashboard + homepage `<meta og:image>` point at the live card.

**Architecture:** Pure-ish `og.py` (`render_og_card(latest, out_path)`, Pillow, fail-soft) + `feed.py` (`build_rss(latest)`, stdlib). `write_snapshots` writes `og.png` + `rss.xml` into the snapshot dir (so they SFTP to `public_html/btc/data/`), wrapped in try/except so they can never break a run. Frontend metadata gains `openGraph.images`. This is the final pass of the improvement roadmap.

**Tech Stack:** Python 3.10+, **Pillow** (manylinux + Windows wheels; installs on the runner), stdlib `xml`/`email.utils`. Next.js metadata.

**Data:** `latest.json` = `{run_at, spot, llm_applied, model_id, forecasts:[{horizon,central,lower,upper,p_up,...}], regime:{label}, signals, news, markets}`.

---

### Task 1: OG card renderer (`og.py`) + Pillow dep

**Files:**
- Modify: `requirements.txt`
- Create: `src/btc_oracle/og.py`
- Test: `tests/test_og.py`

- [ ] **Step 1: Add dependency + install**

Append to `requirements.txt`:
```
Pillow>=10.0
```
Run: `.venv/Scripts/python -m pip install -q "Pillow>=10.0"`

- [ ] **Step 2: Write the failing test**

```python
# tests/test_og.py
from PIL import Image
from btc_oracle.og import render_og_card

LATEST = {
    "run_at": "2026-06-03T20:00:00+00:00", "spot": 62822.0, "llm_applied": True,
    "regime": {"label": "normal"},
    "forecasts": [{"horizon": "1w", "central": 62711.0, "lower": 59000.0, "upper": 66000.0, "p_up": 0.49}],
}


def test_render_og_writes_valid_png(tmp_path):
    out = str(tmp_path / "og.png")
    render_og_card(LATEST, out)
    img = Image.open(out)
    assert img.size == (1200, 630)
    assert img.format == "PNG"


def test_render_og_fail_soft_on_bad_data(tmp_path):
    out = str(tmp_path / "og2.png")
    # missing forecasts -> should still produce a card (not raise)
    render_og_card({"spot": None, "forecasts": []}, out)
    assert Image.open(out).size == (1200, 630)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_og.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 4: Write minimal implementation**

```python
# src/btc_oracle/og.py
import os
from PIL import Image, ImageDraw, ImageFont

_BG = (9, 9, 11)
_ORANGE = (247, 147, 26)
_WHITE = (228, 228, 231)
_GREY = (140, 140, 150)
_BLUE = (96, 165, 250)


def _font(size: int, bold: bool = False):
    names = (["DejaVuSans-Bold.ttf", "arialbd.ttf"] if bold else ["DejaVuSans.ttf", "arial.ttf"])
    paths = ["/usr/share/fonts/truetype/dejavu/", "C:/Windows/Fonts/", ""]
    for p in paths:
        for n in names:
            try:
                return ImageFont.truetype(p + n, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _usd(x):
    try:
        return "$" + format(round(float(x)), ",")
    except Exception:
        return "$—"


def render_og_card(latest: dict, out_path: str) -> str:
    """Render a 1200x630 social share card for the current forecast. Fail-soft:
    always writes a valid PNG even on partial/missing data."""
    img = Image.new("RGB", (1200, 630), _BG)
    d = ImageDraw.Draw(img)
    try:
        d.text((60, 54), "BTC EVENT ORACLE", font=_font(40, bold=True), fill=_ORANGE)
        d.text((60, 110), "Honest, hourly Bitcoin forecasts — scored vs. random walk",
                font=_font(26), fill=_GREY)

        spot = latest.get("spot")
        d.text((60, 180), _usd(spot) if spot else "BTC", font=_font(120, bold=True), fill=_WHITE)
        d.text((64, 312), "live BTC", font=_font(22), fill=_GREY)

        f1w = next((f for f in (latest.get("forecasts") or []) if f.get("horizon") == "1w"),
                   (latest.get("forecasts") or [None])[0])
        if f1w:
            p = round(float(f1w.get("p_up", 0.5)) * 100)
            line = f"1-week: {_usd(f1w.get('central'))}   range {_usd(f1w.get('lower'))} – {_usd(f1w.get('upper'))}"
            d.text((60, 380), line, font=_font(34, bold=True), fill=_WHITE)
            d.text((60, 430), f"P(up) {p}%", font=_font(30), fill=(_BLUE if p >= 50 else (251, 113, 133)))
            regime = (latest.get("regime") or {}).get("label", "")
            if regime and regime != "normal":
                d.text((300, 432), f"· {regime} volatility (wider bands)", font=_font(26), fill=_GREY)

        d.text((60, 545), "vadym.online/btc  ·  not financial advice  ·  past performance ≠ future results",
               font=_font(24), fill=_GREY)
        # accent bar
        d.rectangle([0, 0, 1200, 8], fill=_ORANGE)
    except Exception:
        pass  # whatever rendered so far is still saved below
    img.save(out_path, "PNG")
    return out_path
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_og.py -v`
Expected: PASS (2 passed)

- [ ] **Step 6: Commit**

```bash
git add requirements.txt src/btc_oracle/og.py tests/test_og.py
git commit -m "feat(og): Pillow-rendered 1200x630 forecast share card"
```

---

### Task 2: RSS feed (`feed.py`)

**Files:**
- Create: `src/btc_oracle/feed.py`
- Test: `tests/test_feed.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_feed.py
from btc_oracle.feed import build_rss

LATEST = {"run_at": "2026-06-03T20:00:00+00:00", "regime": {"label": "elevated"},
          "forecasts": [
              {"horizon": "1w", "central": 62711.0, "lower": 59000.0, "upper": 66000.0, "p_up": 0.49},
              {"horizon": "1m", "central": 62586.0, "lower": 55000.0, "upper": 70000.0, "p_up": 0.49},
          ]}


def test_build_rss_has_items_per_forecast():
    xml = build_rss(LATEST)
    assert xml.startswith("<?xml")
    assert "<rss" in xml and "</rss>" in xml
    assert xml.count("<item>") == 2
    assert "1-week" in xml or "1w" in xml
    assert "BTC Event Oracle" in xml


def test_build_rss_empty_is_valid():
    xml = build_rss({"forecasts": []})
    assert "<rss" in xml and xml.count("<item>") == 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_feed.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/Scripts/python -m pytest tests/test_feed.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add src/btc_oracle/feed.py tests/test_feed.py
git commit -m "feat(feed): RSS feed of current forecasts"
```

---

### Task 3: Emit og.png + rss.xml from `write_snapshots`

**Files:**
- Modify: `src/btc_oracle/snapshots.py`
- Test: `tests/test_snapshots_feed.py` (append) — and FIX any exact-set assertion in `tests/test_snapshots.py`

- [ ] **Step 1: Write the failing test** (append to `tests/test_snapshots_feed.py`)

```python
# tests/test_snapshots_feed.py  (add)
import os
from PIL import Image


def test_write_snapshots_also_emits_og_and_rss(mem_db, tmp_path):
    _seed(mem_db)   # existing helper in this file
    written = write_snapshots(mem_db, str(tmp_path))
    assert "og.png" in written and "rss.xml" in written
    assert os.path.exists(tmp_path / "og.png") and os.path.exists(tmp_path / "rss.xml")
    assert Image.open(tmp_path / "og.png").size == (1200, 630)
    assert (tmp_path / "rss.xml").read_text().startswith("<?xml")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/Scripts/python -m pytest tests/test_snapshots_feed.py -q`
Expected: FAIL — og.png/rss.xml not produced.

- [ ] **Step 3: Write minimal implementation** (modify `snapshots.py`)

Add `import os` (if not already present) at the top. In `write_snapshots`, after the JSON files are
written and before `return`, add the fail-soft OG + RSS emission and include them in the return list:
```python
    latest_payload = payloads["latest.json"]
    extra_files = []
    try:
        from .og import render_og_card
        render_og_card(latest_payload, os.path.join(out_dir, "og.png"))
        extra_files.append("og.png")
    except Exception:
        pass
    try:
        from .feed import build_rss
        with open(os.path.join(out_dir, "rss.xml"), "w", encoding="utf-8") as fh:
            fh.write(build_rss(latest_payload))
        extra_files.append("rss.xml")
    except Exception:
        pass
    return list(payloads.keys()) + extra_files
```

- [ ] **Step 4: Fix the exact-set snapshot test if needed**

Run: `.venv/Scripts/python -m pytest tests/test_snapshots.py -q`
If `test_write_snapshots_emits_three_files` (or similar) asserts an EXACT set equal to
`{"latest.json","history.json","scores.json","extras.json"}`, it will now fail because og.png/rss.xml
were added. Change that assertion from `==`/exact to `.issuperset(...)`:
```python
    assert set(written).issuperset({"latest.json", "history.json", "scores.json", "extras.json"})
```
(Only change the assertion operator; keep everything else. If the test already uses `in`/subset, no edit
needed.)

- [ ] **Step 5: Run tests + full suite + smoke**

Run: `.venv/Scripts/python -m pytest tests/test_snapshots_feed.py tests/test_snapshots.py -q`
Expected: PASS.
Run: `.venv/Scripts/python -m pytest -q`
Expected: PASS (whole suite).
Smoke:
```bash
.venv/Scripts/python -m btc_oracle.cli run
ls public_html/data/og.png public_html/data/rss.xml
```
Expected: both files exist after a real run.

- [ ] **Step 6: Commit**

```bash
git add src/btc_oracle/snapshots.py tests/test_snapshots_feed.py tests/test_snapshots.py
git commit -m "feat(snapshots): emit og.png + rss.xml alongside the JSON (fail-soft)"
```

---

### Task 4: Point the dashboard's OG metadata at the live card (`app/layout.tsx`)

**Files:**
- Modify: `web/app/layout.tsx`

- [ ] **Step 1: Update the metadata** (read the file, then set metadataBase + openGraph)

Replace the `metadata` export in `web/app/layout.tsx` with:
```tsx
export const metadata: Metadata = {
  metadataBase: new URL("https://vadym.online"),
  title: "BTC Event Oracle",
  description: "Honest hourly Bitcoin forecasting driven by world events, scored against random walk.",
  openGraph: {
    title: "BTC Event Oracle",
    description: "Honest, hourly Bitcoin forecasts — scored openly against a random walk. Not a crystal ball; a tracked method.",
    url: "https://vadym.online/btc",
    images: [{ url: "/btc/data/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BTC Event Oracle",
    description: "Honest, hourly Bitcoin forecasts — scored openly against a random walk.",
    images: ["/btc/data/og.png"],
  },
};
```
(Keep the rest of `layout.tsx` — the `import`, `RootLayout` function, `<html>/<body>` — unchanged. Ensure
`import type { Metadata } from "next";` is present at the top; it already is.)

- [ ] **Step 2: Type-check + build**

Run: `cd web && npx tsc --noEmit` → clean. Run: `npm run build` → succeeds; the built `out/index.html`
contains an `og:image` meta referencing `/btc/data/og.png`.

- [ ] **Step 3: Commit**

```bash
git add web/app/layout.tsx
git commit -m "feat(web): OG/Twitter share-image metadata -> live forecast card"
```

---

## Self-Review

**1. Coverage:** engine-rendered OG card (Task 1, fail-soft, valid 1200×630 PNG even on bad data), RSS
feed of forecasts (Task 2), both emitted into the snapshot dir → SFTP'd to the host (Task 3, fail-soft so
they can never break a run), and the dashboard + (already-present) homepage OG metadata point at the live
card (Task 4). The public JSON "API" already exists at `/btc/data/latest.json`.

**2. Placeholder scan:** No TBD/TODO; complete code; the exact-set snapshot-test fix is conditional with
the exact change. Pillow font lookup tries Linux (runner) + Windows (dev) paths + `load_default` fallback.

**3. Type consistency:** `render_og_card(latest: dict, out_path) -> str` and `build_rss(latest: dict) ->
str` both take the `latest.json` payload dict that `write_snapshots` already builds (`payloads["latest.json"]`).
`write_snapshots` return type stays `list[str]` (now includes `og.png`/`rss.xml`). No call-site changes
elsewhere — `run_once` only reads `len`/membership of the return.

---

## Done after this
That completes the research-backed roadmap's buildable items. Remaining (explicitly deferred, larger
standalone efforts): HAR intraday-realized-variance volatility, multi-asset (ETH/SOL), and a Telegram
channel. The cPanel-password rotation + optional healthchecks.io secret remain user actions.
