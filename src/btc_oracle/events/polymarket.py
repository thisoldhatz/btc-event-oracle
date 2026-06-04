# src/btc_oracle/events/polymarket.py
import json

URL = "https://gamma-api.polymarket.com/markets"


def parse_markets(raw_list, limit: int = 5) -> list[dict]:
    """Keep live BTC price-threshold markets with a parseable Yes price. Returns
    [{question, yes_prob, end_date}] — context for 'what real-money markets imply'."""
    out = []
    for m in raw_list or []:
        q = (m.get("question") or "")
        if "bitcoin" not in q.lower() and "btc" not in q.lower():
            continue
        try:
            prices = json.loads(m.get("outcomePrices") or "[]")
            yes = float(prices[0])
        except Exception:
            continue
        out.append({"question": q, "yes_prob": yes, "end_date": m.get("endDate")})
        if len(out) >= limit:
            break
    return out


def fetch_markets(http_get, limit: int = 5) -> list[dict]:
    """Fetch top live BTC markets from Polymarket gamma. Fail-soft -> []."""
    try:
        raw = http_get(URL, {"closed": "false", "order": "volume24hr",
                             "ascending": "false", "limit": 200}, {})
        return parse_markets(raw, limit=limit)
    except Exception:
        return []
