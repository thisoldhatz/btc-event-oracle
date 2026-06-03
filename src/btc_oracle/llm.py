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
