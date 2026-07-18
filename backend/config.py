from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    app_name: str = "English Learning AI"
    database_url: str = "postgresql://localhost/english_learning"
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    tts_model: str = "tts-1"
    tts_voice: str = "nova"
    chat_model: str = "gpt-4o-mini"
    debug: bool = os.getenv("DEBUG", "true").lower() == "true"

    class Config:
        env_file = ".env"


settings = Settings()
