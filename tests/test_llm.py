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
