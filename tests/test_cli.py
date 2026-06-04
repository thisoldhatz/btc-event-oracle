from btc_oracle.cli import compute_current_baseline
from btc_oracle.config import Settings
from btc_oracle.store import insert_prices


def _settings():
    return Settings(db_path=":memory:", conf_level=0.60, vol_lambda=0.94,
                    mu_daily=0.0, anthropic_api_key=None, coingecko_demo_key=None)


def test_compute_current_baseline_returns_three(mem_db):
    # seed 60 days of gently rising closes
    rows = [("coinbase", "1d", float(i), 0, 0, 0, 100.0 + i * 0.5, 0) for i in range(60)]
    insert_prices(mem_db, rows)
    fs, regime = compute_current_baseline(mem_db, _settings(), spot=130.0)
    assert regime["label"] in ("normal", "elevated", "high")
    assert [f.horizon for f in fs] == ["1w", "1m", "1y"]
    for f in fs:
        assert f.spot == 130.0
        assert f.lower < f.central < f.upper
        assert 0.0 < f.p_up < 1.0
        assert f.vol_model in ("gjr-garch", "ewma")
        assert f.vol_window == 59  # 60 closes -> 59 returns
