import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()  # loads .env if present; no-op otherwise


@dataclass(frozen=True)
class Settings:
    db_path: str
    conf_level: float
    vol_lambda: float
    mu_daily: float
    anthropic_api_key: str | None
    coingecko_demo_key: str | None


def get_settings() -> Settings:
    return Settings(
        db_path=os.getenv("DB_PATH", "./data/oracle.db"),
        conf_level=float(os.getenv("CONF_LEVEL", "0.60")),
        vol_lambda=float(os.getenv("VOL_LAMBDA", "0.94")),
        mu_daily=float(os.getenv("MU_DAILY", "0.0")),
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY") or None,
        coingecko_demo_key=os.getenv("COINGECKO_DEMO_KEY") or None,
    )
