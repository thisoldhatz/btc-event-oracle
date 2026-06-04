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
