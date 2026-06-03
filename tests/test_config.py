from btc_oracle.config import get_settings


def test_defaults_when_env_absent(monkeypatch):
    for k in ("DB_PATH", "CONF_LEVEL", "VOL_LAMBDA", "MU_DAILY", "ANTHROPIC_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    s = get_settings()
    assert s.db_path == "./data/oracle.db"
    assert s.conf_level == 0.60
    assert s.vol_lambda == 0.94
    assert s.mu_daily == 0.0
    assert s.anthropic_api_key is None


def test_env_overrides(monkeypatch):
    monkeypatch.setenv("DB_PATH", "/tmp/x.db")
    monkeypatch.setenv("CONF_LEVEL", "0.8")
    monkeypatch.setenv("VOL_LAMBDA", "0.97")
    s = get_settings()
    assert s.db_path == "/tmp/x.db"
    assert s.conf_level == 0.8
    assert s.vol_lambda == 0.97
