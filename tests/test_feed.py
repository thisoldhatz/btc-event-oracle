# tests/test_feed.py
import xml.etree.ElementTree as ET

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
    # Structural validity: must parse as well-formed XML
    ET.fromstring(xml)


def test_build_rss_empty_is_valid():
    xml = build_rss({"forecasts": []})
    assert "<rss" in xml and xml.count("<item>") == 0


def test_build_rss_p_up_none_does_not_raise():
    """build_rss must not raise when p_up is None (SQLite NULL -> dict value None)."""
    xml = build_rss({"forecasts": [{"horizon": "1w", "central": 60000.0, "p_up": None}]})
    assert xml.count("<item>") == 1
    ET.fromstring(xml)
