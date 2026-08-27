"""
Module:  user_preferences_service.py
Layer:   api/services
Desc:    Per-user grid/dashboard customization layered on top of the
         admin-global app_grid_settings / app_grid_column_settings pair.
         See migration 045 for the (user_id, grid_id) composite-key
         rationale and the 'dashboard' / 'player_pins' synthetic grid_id
         reuse — dashboard widget order/visibility and the leaderboard/
         PlayerProfileFlyout player-pin list both ride the same
         app_grid_column_settings_user shape (column_id repurposed as the
         pinned entity's id, visible/column_order as pinned/pin-rank).

         No audit-log emission here (unlike admin_service.py's grid-setting
         writes) — this is a user's own preference data, not an admin action.
"""
from loguru import logger

from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T

_USER_GRID_SETTING_BOOL_COLS: tuple[str, ...] = ("dashboard_pin",)
_USER_GRID_COLUMN_BOOL_COLS: tuple[str, ...] = ("visible",)

# Whitelisted grid-level fields a PATCH body may set. Deliberately excludes
# numeral_style / live_update_highlight / row_accent_reactive — those stay
# admin-only (app_grid_settings), never mirrored here.
_GRID_FIELDS: tuple[str, ...] = (
    "sort_column", "sort_direction", "pinned_filter_set", "dashboard_pin",
)


def _coerce_bools(row: dict, bool_cols: tuple[str, ...]) -> dict:
    """Coerce 0/1/NULL columns to canonical ints (Pydantic later -> bool).
    NULL stays NULL — for column overrides that's "inherit admin default",
    not "false"."""
    for col in bool_cols:
        if col in row and row[col] is not None:
            row[col] = 1 if row[col] else 0
    return row


def _empty_preference(user_id: int, grid_id: str) -> dict:
    """Shape returned when nothing has been saved yet — deliberately not a
    404, so the frontend merge treats "no row" identically to "admin
    defaults only" (no seed rows exist; see migration 045)."""
    return {
        "user_id": user_id,
        "grid_id": grid_id,
        "sort_column": None,
        "sort_direction": None,
        "pinned_filter_set": None,
        "dashboard_pin": 0,
        "columns": [],
    }


def _fetch_columns(user_id: int, grid_id: str) -> list[dict]:
    df = db.query(
        f"""SELECT column_id, visible, column_order
            FROM {T.APP_GRID_COLUMN_SETTINGS_USER}
            WHERE user_id = %s AND grid_id = %s
            ORDER BY column_order""",
        (user_id, grid_id),
    )
    rows = df.to_dict(orient="records") if hasattr(df, "to_dict") else []
    return [_coerce_bools(r, _USER_GRID_COLUMN_BOOL_COLS) for r in rows]


def get_user_grid_preference(*, user_id: int, grid_id: str) -> dict:
    """Return the user's saved preference row for `grid_id`, or the empty
    default shape when nothing has been saved yet."""
    df = db.query(
        f"""SELECT sort_column, sort_direction, pinned_filter_set, dashboard_pin
            FROM {T.APP_GRID_SETTINGS_USER}
            WHERE user_id = %s AND grid_id = %s""",
        (user_id, grid_id),
    )
    if df.empty:
        result = _empty_preference(user_id, grid_id)
        # A parent row can be absent while column rows exist in a narrow
        # window (a PATCH that only sent `columns`) — still lazily creates
        # the parent first (see update_user_grid_preference), but keep this
        # defensive so a GET is never wrong even if that invariant slips.
        result["columns"] = _fetch_columns(user_id, grid_id)
        return result
    row = _coerce_bools(df.to_dict(orient="records")[0], _USER_GRID_SETTING_BOOL_COLS)
    row["user_id"] = user_id
    row["grid_id"] = grid_id
    row["columns"] = _fetch_columns(user_id, grid_id)
    return row


def list_user_grid_preferences(*, user_id: int) -> list[dict]:
    """Every saved grid row for `user_id`, including the synthetic
    'dashboard' (pinned-widget order/visibility) and 'player_pins' (pinned
    player list) rows when present. Used by the dashboard's pinned-content
    score strip to discover what to render without a per-grid round trip."""
    df = db.query(
        f"""SELECT grid_id, sort_column, sort_direction, pinned_filter_set, dashboard_pin
            FROM {T.APP_GRID_SETTINGS_USER}
            WHERE user_id = %s
            ORDER BY grid_id""",
        (user_id,),
    )
    rows = df.to_dict(orient="records") if hasattr(df, "to_dict") else []
    out = []
    for r in rows:
        r = _coerce_bools(r, _USER_GRID_SETTING_BOOL_COLS)
        r["user_id"] = user_id
        r["columns"] = _fetch_columns(user_id, r["grid_id"])
        out.append(r)
    return out


def update_user_grid_preference(*, user_id: int, grid_id: str, body: dict) -> dict:
    """Upsert the user's preference row for `grid_id`. Lazily creates the
    parent row on first save (`INSERT OR IGNORE`) — no seed rows exist."""
    body = dict(body)
    columns = body.pop("columns", None)
    fields = {k: v for k, v in body.items() if k in _GRID_FIELDS and v is not None}

    if fields or columns:
        db.execute(
            f"""INSERT OR IGNORE INTO {T.APP_GRID_SETTINGS_USER} (user_id, grid_id)
                VALUES (%s, %s)""",
            (user_id, grid_id),
        )

    if fields:
        if "dashboard_pin" in fields:
            fields["dashboard_pin"] = 1 if fields["dashboard_pin"] else 0
        set_clause = ", ".join(f"{k} = :{k}" for k in fields)
        db.execute(
            f"""UPDATE {T.APP_GRID_SETTINGS_USER}
                SET {set_clause}, modified_at = datetime('now')
                WHERE user_id = :user_id AND grid_id = :grid_id""",
            params={**fields, "user_id": user_id, "grid_id": grid_id},
        )

    for col in columns or []:
        column_id = str((col or {}).get("column_id", "") or "").strip()
        if not column_id:
            continue
        db.execute(
            f"""INSERT OR IGNORE INTO {T.APP_GRID_COLUMN_SETTINGS_USER}
                (user_id, grid_id, column_id) VALUES (%s, %s, %s)""",
            (user_id, grid_id, column_id),
        )
        col_fields: dict = {}
        if col.get("visible") is not None:
            col_fields["visible"] = 1 if col["visible"] else 0
        if col.get("column_order") is not None:
            col_fields["column_order"] = col["column_order"]
        if col_fields:
            set_clause = ", ".join(f"{k} = :{k}" for k in col_fields)
            db.execute(
                f"""UPDATE {T.APP_GRID_COLUMN_SETTINGS_USER}
                    SET {set_clause}, modified_at = datetime('now')
                    WHERE user_id = :user_id AND grid_id = :grid_id AND column_id = :column_id""",
                params={**col_fields, "user_id": user_id, "grid_id": grid_id, "column_id": column_id},
            )

    logger.info(
        "update_user_grid_preference: user_id={user_id} grid_id={grid_id} fields={fields} columns={n}",
        user_id=user_id, grid_id=grid_id, fields=list(fields.keys()), n=len(columns or []),
    )
    return get_user_grid_preference(user_id=user_id, grid_id=grid_id)


def unpin_user_grid_column(*, user_id: int, grid_id: str, column_id: str) -> dict:
    """Delete a single column row — unpins a dashboard widget (grid_id=
    'dashboard') or a player (grid_id='player_pins'), or clears a plain
    grid's per-column override back to the admin default."""
    db.execute(
        f"""DELETE FROM {T.APP_GRID_COLUMN_SETTINGS_USER}
            WHERE user_id = %s AND grid_id = %s AND column_id = %s""",
        (user_id, grid_id, column_id),
    )
    logger.info(
        "unpin_user_grid_column: user_id={user_id} grid_id={grid_id} column_id={column_id}",
        user_id=user_id, grid_id=grid_id, column_id=column_id,
    )
    return get_user_grid_preference(user_id=user_id, grid_id=grid_id)
