import pytest
from btc_oracle.prices import fetch_spot_resilient

CG = {"bitcoin": {"usd": 65000.0}}
CB = {"data": {"amount": "64000.50"}}
KR = {"result": {"XXBTZUSD": {"c": ["63000.0", "1.0"]}}}


def test_uses_coingecko_first():
    def get(url, params, headers):
        if "coingecko" in url:
            return CG
        raise AssertionError("should not reach fallback")
    assert fetch_spot_resilient(get) == (65000.0, "coingecko")


def test_falls_back_to_coinbase():
    def get(url, params, headers):
        if "coingecko" in url:
            raise RuntimeError("cg down")
        if "coinbase" in url:
            return CB
        raise AssertionError("should not reach kraken")
    assert fetch_spot_resilient(get) == (64000.5, "coinbase")


def test_falls_back_to_kraken():
    def get(url, params, headers):
        if "kraken" in url:
            return KR
        raise RuntimeError("down")
    price, source = fetch_spot_resilient(get)
    assert source == "kraken" and abs(price - 63000.0) < 1e-6


def test_raises_when_all_fail():
    def get(url, params, headers):
        raise RuntimeError("everything down")
    with pytest.raises(RuntimeError):
        fetch_spot_resilient(get)


def test_rejects_implausible_glitch_and_falls_through():
    # a decimal-shift / stale-cache glitch (1.0) must be rejected, not anchored
    def get(url, params, headers):
        if "coingecko" in url:
            return {"bitcoin": {"usd": 1.0}}
        if "coinbase" in url:
            return CB
        raise AssertionError("should not reach kraken")
    price, source = fetch_spot_resilient(get, last_close=65000.0)
    assert source == "coinbase" and abs(price - 64000.5) < 1e-6


def test_absolute_floor_rejects_subdollar_price():
    def get(url, params, headers):
        if "coingecko" in url:
            return {"bitcoin": {"usd": 0.5}}     # below the $1k sanity floor
        if "coinbase" in url:
            return CB
        raise AssertionError("should not reach kraken")
    assert fetch_spot_resilient(get) == (64000.5, "coinbase")


def test_all_implausible_raises():
    def get(url, params, headers):
        return {"bitcoin": {"usd": 1.0}, "data": {"amount": "1.0"},
                "result": {"XXBTZUSD": {"c": ["1.0", "1"]}}}
    with pytest.raises(RuntimeError):
        fetch_spot_resilient(get, last_close=65000.0)
