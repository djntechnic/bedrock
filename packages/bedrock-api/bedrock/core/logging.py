"""
Module:  logging.py
Layer:   api/core
Desc:    Centralized backend logging bootstrapper using Loguru.
"""
import os
import sys
import logging
from loguru import logger
from dotenv import load_dotenv

# Ensure environment variables from .env are loaded before initialization
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(project_root, ".env"), override=True)

def _backend_log_format(show_source: bool) -> str:
    """
    Build the Loguru format string for backend logs. When show_source is
    True, the module:function:line annotation is included next to the log
    level; otherwise it is omitted entirely.
    """
    if show_source:
        return (
            "<green>{time:HH:mm:ss}</green> | "
            "<level>{level: <7}</level> | "
            "<cyan>{name}:{function}:{line}</cyan> - "
            "<level>{message}</level>"
        )
    return (
        "<green>{time:HH:mm:ss}</green> | "
        "<level>{level: <7}</level> | "
        "<level>{message}</level>"
    )


def _show_source_location() -> bool:
    """
    Whether to include `{name}:{function}:{line}` source annotation in log lines.

    Reads app_config_settings.logging_show_source_location. Defaults to False,
    which strips the source annotation for cleaner day-to-day pipeline output.
    Any failure to read config (e.g. DB not yet initialized) falls back to False.

    Bypasses the DB read entirely when the SQLite file is missing or empty —
    otherwise sqlite3.connect() would create a zero-byte mlbtracker.db and
    poison test/fresh-checkout runs (conftest copies that empty file instead
    of initializing the schema).
    """
    try:
        from bedrock.core.database import db
        if not getattr(db, "is_postgres", False):
            path = getattr(db, "sqlite_path", None)
            if not path or not os.path.isfile(path) or os.path.getsize(path) == 0:
                return False
        return bool(db.get_config("logging_show_source_location", False))
    except Exception:
        return False


def _get_log_level() -> str:
    """
    Determine log level:
    1. Read LOG_LEVEL environment variable (e.g., "DEBUG", "INFO", "WARNING").
    2. Read app_config_settings.logging_level from DB.
    3. Fallback to "DEBUG" if Config.DEBUG is True, else "INFO".
    """
    env_level = os.environ.get("BACKEND_LOG_LEVEL") or os.environ.get("LOG_LEVEL")
    if env_level:
        return env_level.upper()

    try:
        from bedrock.core.database import db
        if not getattr(db, "is_postgres", False):
            path = getattr(db, "sqlite_path", None)
            if not path or not os.path.isfile(path) or os.path.getsize(path) == 0:
                pass
            else:
                db_level = db.get_config("logging_level", None)
                if db_level:
                    return str(db_level).upper()
    except Exception:
        pass

    try:
        from bedrock.core.config import config
        return "DEBUG" if getattr(config, "DEBUG", False) else "INFO"
    except Exception:
        return "INFO"


def initialize_backend_logging():
    """
    Completely neutralizes default framework logging sinks and maps
    clean, color-coded, line-tracked streams for local developer terminals.
    """
    # 1. Clear out absolutely all pre-existing standard library handlers
    logging.getLogger().handlers = []

    # 2. Drop Loguru's implicit default configuration
    logger.remove()

    # 3. Inject our precise development layout window sink
    # Note: We omit complex date components locally to maximize available space for log text.
    log_level = _get_log_level()
    log_format = os.environ.get("BACKEND_LOG_FORMAT", "HUMAN").upper()
    is_json = (log_format == "JSON")

    logger.add(
        sys.stdout,
        level=log_level,
        format=_backend_log_format(show_source=_show_source_location()),
        colorize=not is_json,
        serialize=is_json,
    )

    # 4. Intercept framework outputs (FastAPI / Uvicorn) and route them to Loguru
    class InterceptHandler(logging.Handler):
        def emit(self, record):
            try:
                level = logger.level(record.levelname).name
            except ValueError:
                level = record.levelno

            # Dynamically traverse the stack frame to find where the framework log originated
            frame, depth = logging.currentframe(), 2
            while frame.f_code.co_filename == logging.__file__:
                frame = frame.f_back
                depth += 1

            logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())

    intercept_handler = InterceptHandler()
    
    # Configure root logger to intercept all standard logging at or above target level
    root_logger = logging.getLogger()
    root_logger.handlers = [intercept_handler]
    root_logger.setLevel(getattr(logging, log_level, logging.INFO))

    # Explicitly clear and intercept Uvicorn's sub-loggers
    for logger_name in ("uvicorn", "uvicorn.meta", "uvicorn.access", "fastapi"):
        mod_logger = logging.getLogger(logger_name)
        mod_logger.handlers = [intercept_handler]
        mod_logger.propagate = False  # Prevent logs from multiplying upward to root



