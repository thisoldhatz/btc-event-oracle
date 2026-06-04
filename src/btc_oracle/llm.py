# src/btc_oracle/llm.py  (pure pieces needed by overlay; SDK factory added in Task 9)
SYSTEM_PROMPT = (
    "You are a careful quantitative assistant for a Bitcoin forecasting engine. "
    "You are given a humble random-walk baseline (central price, confidence band, P(up)) "
    "for 1-week, 1-month, and 1-year horizons, plus a few condensed world-event signals. "
    "Bitcoin is near-random-walk at short horizons, so your adjustments MUST be small. "
    "Return ONLY JSON of the form "
    '{"horizons":{"1w":{"drift_adj_bps":<int>,"vol_mult":<0.8-1.5>,'
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
