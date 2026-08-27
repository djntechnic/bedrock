"""
Module:  user_preferences.py
Layer:   api/schemas
Desc:    Pydantic models for per-user grid/dashboard customization
         (app_grid_settings_user / app_grid_column_settings_user). Layered on
         top of the admin-global GridSettingSchema/GridColumnSettingSchema in
         admin.py — never persists numeral_style/live_update_highlight/
         row_accent_reactive, which stay admin-only.
"""
from pydantic import BaseModel
from typing import List, Optional


class UserGridColumnPreferenceSchema(BaseModel):
    """A single column's user-level visibility/order override.

    `visible`/`column_order` are `Optional` — `None` means "no override,
    inherit the admin default" rather than "hidden" / "position 0".
    """
    column_id: str
    visible: Optional[bool] = None
    column_order: Optional[int] = None
    model_config = {"from_attributes": True}


class UserGridPreferenceSchema(BaseModel):
    """Per-(user, grid) preference row, merged client-side over admin defaults.

    Bool coercion boundary — see GridSettingSchema's docstring in admin.py for
    the same int/bool contract: `dashboard_pin` and each column's `visible`
    land here as JSON true/false regardless of the SQLite/Postgres 0/1
    storage representation.
    """
    user_id: int
    grid_id: str
    sort_column: Optional[str] = None
    sort_direction: Optional[str] = None
    pinned_filter_set: Optional[str] = None
    dashboard_pin: bool = False
    columns: List[UserGridColumnPreferenceSchema] = []
    model_config = {"from_attributes": True}


class UserGridPreferenceUpdateSchema(BaseModel):
    """PATCH body — every field optional so partial updates (sort-only,
    columns-only, dashboard_pin-only) don't require resending the rest."""
    sort_column: Optional[str] = None
    sort_direction: Optional[str] = None
    pinned_filter_set: Optional[str] = None
    dashboard_pin: Optional[bool] = None
    columns: Optional[List[UserGridColumnPreferenceSchema]] = None
