from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MFA_ISSUER: str = "NetGuard-SOC"
    ONOS_URL: str = "http://192.168.91.133:8181"
    ONOS_USER: str = "onos"
    ONOS_PASSWORD: str = "rocks"
    CORS_ORIGINS: str = "http://localhost:3000"
    MAX_LOGIN_ATTEMPTS: int = 5
    IDS_URL: str = "http://192.168.91.133:8000"
    VM_HOST: str = "192.168.91.133"
    VM_USER: str = "wissal"
    VM_SSH_KEY_PATH: str = "/app/ssh/netguard_key"
    ABUSEIPDB_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",")]

@lru_cache
def get_settings() -> Settings:
    return Settings()