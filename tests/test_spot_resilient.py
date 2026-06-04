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
