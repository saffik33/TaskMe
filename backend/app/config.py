from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_FILE, override=True)


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./taskme.db"
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    LLM_PROVIDER: str = "openai"
    OPENAI_MODEL: str = "gpt-4o"
    ANTHROPIC_MODEL: str = "claude-sonnet-4-20250514"
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    JWT_SECRET_KEY: str = "CHANGE-ME-IN-PRODUCTION"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    model_config = {"env_file": str(ENV_FILE)}


settings = Settings()


def check_jwt_secret():
    """Call at app startup (not import time) to validate JWT secret."""
    import os
    # Re-read from OS env in case Railway injected it after module import
    jwt_from_env = os.getenv("JWT_SECRET_KEY", "")
    if jwt_from_env and jwt_from_env != "CHANGE-ME-IN-PRODUCTION":
        # Railway env var is set correctly — update settings object
        settings.JWT_SECRET_KEY = jwt_from_env
        return
    if settings.JWT_SECRET_KEY == "CHANGE-ME-IN-PRODUCTION":
        import warnings
        warnings.warn(
            "SECURITY WARNING: JWT_SECRET_KEY is set to the default placeholder. "
            "Set a strong random secret via environment variable JWT_SECRET_KEY.",
            stacklevel=2,
        )
        if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("ENV", "").lower() in ("production", "prod"):
            raise SystemExit("FATAL: JWT_SECRET_KEY must be changed from the default in production.")
