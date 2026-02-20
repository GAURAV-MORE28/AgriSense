"""
Configuration settings for ML Service.
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    """Application settings."""
    
    # Service
    app_name: str = "KRISHI-AI ML Service"
    debug: bool = True
    
    # LLM Configuration
    llm_enabled: bool = False
    llm_mock: bool = True
    openai_api_key: Optional[str] = None
    
    # OCR Configuration
    tesseract_path: str = "/usr/bin/tesseract"
    use_google_vision: bool = False
    google_vision_api_key: Optional[str] = None
    
    # Data paths
    schemes_data_path: str = "data/schemes.yaml"
    
    # Model paths
    ranking_model_path: str = "models/ranking_model.pkl"
    
    class Config:
        env_file = ".env"


settings = Settings()
