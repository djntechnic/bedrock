"""
Module:  user_preferences.py
Layer:   api/routes
Desc:    Per-user grid/dashboard customization — the first server-persisted
         per-user preference surface in the app (column visibility/order,
         sort, one saved filter set, dashboard-pin status). Layered on top
         of the admin-global app_grid_settings surface in api/routes/admin.py;
         never touches it. Gated on any active logged-in user (no role or
         module requirement) since this is personal data, not an admin
         action.
"""
from typing import Annotated, List

from fastapi import APIRouter, Depends
from loguru import logger

from bedrock.dependencies import get_current_active_user
from bedrock.services import user_service as us
from bedrock.schemas.base import ApiResponse
from bedrock.schemas.user_preferences import (
    UserGridPreferenceSchema,
    UserGridPreferenceUpdateSchema,
)
from bedrock.services.user_preferences_service import (
    get_user_grid_preference,
    list_user_grid_preferences,
    update_user_grid_preference,
    unpin_user_grid_column,
)

router = APIRouter()

CurrentUser = Annotated[us.UserRecord, Depends(get_current_active_user)]


@router.get("/grids", response_model=ApiResponse[List[UserGridPreferenceSchema]])
def list_my_grid_preferences(current_user: CurrentUser):
    """Every saved grid preference row for the caller, including the
    synthetic 'dashboard' and 'player_pins' rows when present."""
    return ApiResponse(
        status="ok",
        data=list_user_grid_preferences(user_id=current_user.user_id),
    )


@router.get("/grids/{grid_id}", response_model=ApiResponse[UserGridPreferenceSchema])
def get_my_grid_preference(grid_id: str, current_user: CurrentUser):
    """The caller's saved preference for `grid_id`, or the empty default
    shape when nothing has been saved yet (never 404 — a fresh account has
    no rows for any grid)."""
    return ApiResponse(
        status="ok",
        data=get_user_grid_preference(user_id=current_user.user_id, grid_id=grid_id),
    )


@router.patch("/grids/{grid_id}", response_model=ApiResponse[UserGridPreferenceSchema])
def update_my_grid_preference(
    grid_id: str,
    body: UserGridPreferenceUpdateSchema,
    current_user: CurrentUser,
):
    """Partial update — sort-only, columns-only, dashboard_pin-only, or any
    combination. Lazily creates the row on first save."""
    result = update_user_grid_preference(
        user_id=current_user.user_id,
        grid_id=grid_id,
        body=body.model_dump(exclude_unset=True),
    )
    logger.info(
        "PATCH /user-preferences/grids/{grid_id}: user_id={user_id} grid_id={grid_id}",
        grid_id=grid_id, user_id=current_user.user_id,
    )
    return ApiResponse(status="ok", data=result)


@router.delete(
    "/grids/{grid_id}/columns/{column_id}",
    response_model=ApiResponse[UserGridPreferenceSchema],
)
def unpin_my_grid_column(grid_id: str, column_id: str, current_user: CurrentUser):
    """Delete one column-override row. Used to unpin a dashboard widget
    (grid_id='dashboard'), unpin a player (grid_id='player_pins'), or clear
    a plain grid's per-column override back to the admin default."""
    result = unpin_user_grid_column(
        user_id=current_user.user_id, grid_id=grid_id, column_id=column_id,
    )
    return ApiResponse(status="ok", data=result)
