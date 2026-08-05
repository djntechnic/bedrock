"""
Module:  config.py
Layer:   api/core
Desc:    Application configuration loader. Manages environment variables,
         file system paths, and application-wide settings.
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file at the project root
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(project_root, ".env"), override=True)

class Config:
    """
    Centralized configuration for the MLBTracker application.
    Aggregates settings from environment variables and provides sensible defaults.
    """
    
    # Project Paths
    PROJECT_ROOT = project_root
    DATA_DIR = os.path.join(PROJECT_ROOT, "data")
    SRC_DIR = os.path.join(PROJECT_ROOT, "api")
    
    # Database
    DATABASE_URL = os.environ.get("DATABASE_URL")
    SQLITE_DB_PATH = os.path.join(DATA_DIR, "mlbtracker.db")
    
    # MLB Stats API
    MLB_API_BASE = "https://statsapi.mlb.com/api/v1"
    CACHE_DIR = os.path.join(DATA_DIR, ".cache")
    
    # Cloudflare Images CDN
    CLOUDFLARE_ACCOUNT_ID = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
    CLOUDFLARE_API_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
    CLOUDFLARE_IMAGES_HASH = os.environ.get("CLOUDFLARE_IMAGES_HASH", "")

    # Application Settings
    DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
    PORT = int(os.environ.get("PORT", 8501))
    
    @classmethod
    def get_db_path(cls):
        """
        Helper to get the appropriate DB path or URL.

        Returns:
            str: The database connection string or file path.
        """
        return cls.DATABASE_URL if cls.DATABASE_URL else cls.SQLITE_DB_PATH

config = Config()
