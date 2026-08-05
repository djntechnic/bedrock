"""
Module:  config.py
Layer:   api/routes
Desc:    Single app-config endpoint consumed by the frontend on load, returning
         every boot-time configuration section in one call to minimise round
         trips.

         The route composes rather than queries: platform sections
         (`app_config`, `ui_query_config`) and application sections
         (MLBTracker adds `current_season`, `seasons`, `inventory_statuses`)
         are all registered through api/core/app_config_sections.py, so this
         module carries no knowledge of which sections exist.
"""
import math

from fastapi import APIRouter, HTTPException

from bedrock.core.app_config_sections import (
    build_app_config,
    register_app_config_section,
)
from bedrock.core.database import db as _db
from bedrock.core.schema_catalog import Tables as T
from bedrock.schemas.base import ApiResponse

router = APIRouter()


def _san(v):
    """Return None for NaN/Inf float values."""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


# ─── Platform sections ────────────────────────────────────────────────────────
# Both are backed by platform-owned tables. Registered here at import so they
# are always present, whatever the host application adds.


def _build_ui_query_config() -> dict:
    """Per-hook staleTime / refetchInterval tuning, keyed for O(1) lookup."""
    uqc_df = _db.query(
        "SELECT hook_name, stale_time_ms, refetch_interval_ms, "
        f"refetch_on_window_focus FROM {T.APP_UI_QUERY_CONFIG}"
    )
    return {
        r["hook_name"]: {
            "staleTime": _san(r["stale_time_ms"]),
            "refetchInterval": _san(r["refetch_interval_ms"]),
            "refetchOnWindowFocus": bool(r["refetch_on_window_focus"]),
        }
        for r in uqc_df.to_dict(orient="records")
    }


def _build_app_config_settings() -> dict:
    """Flat key/value view of app_config_settings."""
    cfg_df = _db.query(
        f"SELECT key, value FROM {T.APP_CONFIG_SETTINGS} ORDER BY key"
    )
    return {r["key"]: r["value"] for r in cfg_df.to_dict(orient="records")}


register_app_config_section("ui_query_config", _build_ui_query_config)
register_app_config_section("app_config", _build_app_config_settings)


@router.get("/app", response_model=ApiResponse[dict])
def get_app_config():
    """
    Returns all runtime configuration consumed by the frontend on startup.

    The section set is whatever has been registered — platform sections plus
    the host application's. MLBTracker's payload is:

      - current_season: the season_year where is_current = 1   (application)
      - seasons: full season list                              (application)
      - inventory_statuses: ordered valid card statuses        (application)
      - ui_query_config: per-hook query tuning                 (platform)
      - app_config: key/value app settings                     (platform)

    Returns:
        ApiResponse: nested dict with all registered config sections
    """
    try:
        return ApiResponse(status="ok", data=build_app_config())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
