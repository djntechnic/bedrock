"""
Module:  logging.py
Layer:   bedrock/core
Desc:    Centralized backend logging bootstrapper using Loguru.
"""
import os
import sys
import logging
from loguru import logger
from bedrock.core.paths import APP_ROOT, app_path, safe_load_dotenv
from bedrock.core.config import config

# Ensure environment variables from .env are loaded before initialization.
# `bedrock.core.config` does this too, but logging is deliberately importable
# without pulling in the database layer, so it repeats the load rather than
# depending on import order.
project_root = APP_ROOT
safe_load_dotenv()


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

    Reads BACKEND_LOG_SHOW_SOURCE or LOG_SHOW_SOURCE environment variable (truthy
    values: 'true', '1', 'yes', 'on'). Defaults to False, which strips the source
    annotation for cleaner day-to-day pipeline output.

    Never queries the database at module import time (issue #114). Dynamic DB
    overrides from `app_config_settings` are deferred to application lifespan
    startup via `configure_backend_logging_from_db()`.
    """
    env_source = os.environ.get("BACKEND_LOG_SHOW_SOURCE") or os.environ.get("LOG_SHOW_SOURCE")
    if env_source is not None:
        return env_source.strip().lower() in ("true", "1", "yes", "on")
    return False


def _get_log_level() -> str:
    """
    Determine log level:
    1. Read BACKEND_LOG_LEVEL or LOG_LEVEL environment variable (e.g., "DEBUG", "INFO", "WARNING").
    2. Fallback to "DEBUG" if DEBUG env var is set or config.DEBUG is True, else "INFO".

    Never queries the database at module import time (issue #114). Dynamic DB
    overrides from `app_config_settings` are deferred to application lifespan
    startup via `configure_backend_logging_from_db()`.
    """
    env_level = os.environ.get("BACKEND_LOG_LEVEL") or os.environ.get("LOG_LEVEL")
    if env_level:
        return env_level.upper()

    env_debug = os.environ.get("DEBUG", "").strip().lower()
    if env_debug in ("true", "1", "yes", "on"):
        return "DEBUG"

    return "DEBUG" if getattr(config, "DEBUG", False) else "INFO"


def initialize_backend_logging(
    log_level: str | None = None,
    show_source: bool | None = None,
):
    """
    Completely neutralizes default framework logging sinks and maps
    clean, color-coded, line-tracked streams for local developer terminals.

    :param log_level: Optional explicit log level override. Defaults to
        environment variables (BACKEND_LOG_LEVEL, LOG_LEVEL) or config.DEBUG.
    :param show_source: Optional boolean to include/exclude source file and line.
        Defaults to environment variables (BACKEND_LOG_SHOW_SOURCE).
    """
    # 1. Clear out absolutely all pre-existing standard library handlers
    logging.getLogger().handlers = []

    # 2. Drop Loguru's implicit default configuration
    logger.remove()

    # 3. Inject our precise development layout window sink
    # Note: We omit complex date components locally to maximize available space for log text.
    effective_level = log_level.upper() if log_level else _get_log_level()
    effective_show_source = show_source if show_source is not None else _show_source_location()
    log_format = os.environ.get("BACKEND_LOG_FORMAT", "HUMAN").upper()
    is_json = (log_format == "JSON")

    logger.add(
        sys.stdout,
        level=effective_level,
        format=_backend_log_format(show_source=effective_show_source),
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
    root_logger.setLevel(getattr(logging, effective_level, logging.INFO))

    # Explicitly clear and intercept Uvicorn's sub-loggers
    for logger_name in ("uvicorn", "uvicorn.meta", "uvicorn.access", "fastapi"):
        mod_logger = logging.getLogger(logger_name)
        mod_logger.handlers = [intercept_handler]
        mod_logger.propagate = False  # Prevent logs from multiplying upward to root


def configure_backend_logging_from_db():
    """
    Read dynamic logging overrides from `app_config_settings` (logging_level,
    logging_show_source_location) and apply them to the active logging sink.

    Designed for invocation during application lifespan startup (e.g. after_bootstrap)
    or runtime admin setting change handlers. Never invoked at module import time.
    """
    try:
        from bedrock.core.database import db

        env_level = os.environ.get("BACKEND_LOG_LEVEL") or os.environ.get("LOG_LEVEL")
        if env_level:
            level = env_level.upper()
        else:
            db_level = db.get_config("logging_level", None)
            level = str(db_level).upper() if db_level else _get_log_level()

        env_source = os.environ.get("BACKEND_LOG_SHOW_SOURCE") or os.environ.get("LOG_SHOW_SOURCE")
        if env_source is not None:
            show_source = env_source.strip().lower() in ("true", "1", "yes", "on")
        else:
            db_source = db.get_config("logging_show_source_location", None)
            show_source = bool(db_source) if db_source is not None else False

        initialize_backend_logging(log_level=level, show_source=show_source)
    except Exception as e:
        logger.warning(f"Failed to refresh logging configuration from database: {e}")
