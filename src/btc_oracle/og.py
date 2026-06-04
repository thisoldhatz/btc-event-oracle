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
