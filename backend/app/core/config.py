from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://clearflow:clearflow@db:5432/clearflow"

    class Config:
        env_file = ".env"


settings = Settings()
