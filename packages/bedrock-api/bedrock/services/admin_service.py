"""
Module:  admin_service.py
Layer:   api/services
Desc:    Admin console business logic for the reusable application platform.

         Covers the surfaces that depend only on platform-owned tables:
         app-config CRUD, grid settings + column CRUD, export history, system
         logs, the import-run ledger (schedule/status), database summary, and
         the project audit history.

         MLBTracker's baseball admin services — teams, player aliases, seasons,
         collection statuses, the KPI rollup, photo review — live in
         ./admin_domain_service. The split follows table ownership: a service
         belongs to the domain half if and only if it touches a domain table.

         Route handlers collapse to `parse -> service call -> wrap in
         ApiResponse -> translate domain exceptions to HTTPException`. Every
         SQL statement lives here and every rule (duplicate detection,
         whitelist enforcement, audit-log emission) is unit-testable in ~10ms
         with the in-memory SQLite fixture — no FastAPI, no HTTP context.
"""
from typing import Any, Optional

from loguru import logger

from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T, Views as V
from bedrock.core.config_constants import (
    CANONICAL_CATEGORIES,
    CANONICAL_VALUE_TYPES,
    category_for_key,
    is_valid_category,
    is_valid_key,
    is_valid_value_type,
)



class AdminValidationError(ValueError):
    """Raised when a payload violates a domain rule (unknown field, etc.)."""

class AdminNotFoundError(LookupError):
    """Raised when the target row does not exist. Routes → HTTP 404."""

class AdminConflictError(RuntimeError):
    """Raised when a create would collide with an existing row. Routes → HTTP 409."""

class AdminForbiddenError(RuntimeError):
    """Raised when a policy blocks a deletion (e.g. non-manual alias). Routes → HTTP 403."""


# ─── App config settings CRUD ─────────────────────────────────────────────────
#
# Extracted from api/routes/admin.py::get_config_settings / create /
# update / delete. Same URL surface, same envelopes; the frontend hooks
# (Phase 3.a queryKeys.admin.config*) keep working unchanged.

_CONFIG_UPDATE_ALLOWED_FIELDS = frozenset({"value", "value_type", "description", "category", "key"})

_UI_QUERY_CONFIG_ALLOWED_FIELDS = frozenset({
    "stale_time_ms", "refetch_interval_ms",
    "refetch_on_window_focus", "description", "modified_by",
})


def _validate_config_shape(*, key: str, category: str, value_type: str) -> None:
    """Enforce the <category>_<name> naming rule + canonical enums.

    Raises AdminValidationError on the first violation. The rule set is
    imported from bedrock.core.config_constants so it stays in sync with
    scripts/maintenance/audit_config.py.
    """
    if not is_valid_category(category):
        raise AdminValidationError(
            f"Category '{category}' is not canonical. "
            f"Allowed: {', '.join(CANONICAL_CATEGORIES)}."
        )
    if not is_valid_value_type(value_type):
        raise AdminValidationError(
            f"value_type '{value_type}' is not canonical. "
            f"Allowed: {', '.join(CANONICAL_VALUE_TYPES)}."
        )
    if not is_valid_key(key):
        raise AdminValidationError(
            f"Key '{key}' must match ^<category>_[a-z0-9_]+$ using one of the "
            f"canonical category prefixes ({', '.join(CANONICAL_CATEGORIES)})."
        )
    prefix_cat = category_for_key(key)
    if prefix_cat and prefix_cat != category:
        raise AdminValidationError(
            f"Key '{key}' starts with '{prefix_cat}_' but category='{category}'. "
            "Rename the key or fix the category."
        )

def _sanitize(rows: list[dict]) -> list[dict]:
    """Replace NaN/Inf floats with None for JSON serialization.

    Kept here as a pure helper so routes don't need to import math or
    inspect the shape of DB rows.
    """
    import math
    sanitized: list[dict] = []
    for row in rows:
        clean: dict[str, Any] = {}
        for k, v in row.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                clean[k] = None
            else:
                clean[k] = v
        sanitized.append(clean)
    return sanitized

def list_config_settings_service(*, category: Optional[str] = None) -> list[dict]:
    """Return every app_config_settings row, optionally filtered by category.

    Result rows are sanitized (NaN/Inf → None) so FastAPI's Pydantic
    response model can serialize them without special-case handling.
    """
    where = "WHERE 1=1"
    params: list[Any] = []
    if category:
        where += " AND category = %s"
        params.append(category)
    df = db.query(
        f"SELECT key, value, value_type, description, category, modified_at FROM {T.APP_CONFIG_SETTINGS} {where} ORDER BY category, key",
        tuple(params) if params else None,
    )
    rows = df.to_dict(orient="records") if hasattr(df, "to_dict") else []
    return _sanitize(rows)

def create_config_setting_service(
    *,
    key: str,
    value: Any,
    value_type: str,
    description: Optional[str],
    category: str,
) -> dict:
    """Insert a new config setting; raise AdminConflictError if key exists.

    Emits an activity log entry on success ("config_create") so the admin
    audit-history tab sees the change.
    """
    clean_key = key.strip()
    _validate_config_shape(key=clean_key, category=category, value_type=value_type)

    existing = db.query(
        f"SELECT key FROM {T.APP_CONFIG_SETTINGS} WHERE key = :key",
        params={"key": clean_key},
    )
    if not existing.empty:
        raise AdminConflictError(f"Setting '{clean_key}' already exists")
    db.execute(
        f"""INSERT INTO {T.APP_CONFIG_SETTINGS} (key, value, value_type, description, category, modified_at, modified_by)
           VALUES (:key, :value, :value_type, :description, :category, datetime('now'), 'Admin')""",
        params={
            "key": clean_key,
            "value": str(value).strip(),
            "value_type": value_type,
            "description": description,
            "category": category,
        },
    )
    db.log_activity("config_create", f"Created setting '{clean_key}'", f"value={value}")
    return {"message": f"Created {clean_key}"}

def update_config_setting_service(*, key: str, body: dict) -> dict:
    """Update whitelisted fields on a config setting.

    - Unknown fields silently drop (matches previous route behavior).
    - Zero whitelisted fields → AdminValidationError.
    - Missing key → AdminNotFoundError.
    - `modified_by` is pulled off the body for the audit trail; defaults to "Admin".
    """
    body = dict(body)  # Don't mutate caller's dict.
    modified_by = body.pop("modified_by", "Admin")
    updates = {k: v for k, v in body.items() if k in _CONFIG_UPDATE_ALLOWED_FIELDS}
    if not updates:
        raise AdminValidationError("No updatable fields provided")

    old_row = db.query(
        f"SELECT value, value_type, category FROM {T.APP_CONFIG_SETTINGS} WHERE key = :key",
        params={"key": key},
    )
    if old_row.empty:
        raise AdminNotFoundError(f"Setting '{key}' not found")
    old_value = old_row.iloc[0]["value"]

    # Enforce canonical shape whenever a field that participates in the naming
    # rule is being changed. Fall back to the current row's value for fields
    # the caller didn't touch so partial updates validate against the merged state.
    if updates.keys() & {"key", "category", "value_type"}:
        merged_key = updates.get("key", key)
        merged_category = updates.get("category", old_row.iloc[0]["category"])
        merged_value_type = updates.get("value_type", old_row.iloc[0]["value_type"])
        _validate_config_shape(
            key=merged_key,
            category=merged_category,
            value_type=merged_value_type,
        )

    set_clauses = ", ".join(f"{col} = :{col}" for col in updates)
    params = {**updates, "key": key, "modified_by": modified_by}
    db.execute(
        f"""UPDATE {T.APP_CONFIG_SETTINGS}
           SET {set_clauses}, modified_at = datetime('now'), modified_by = :modified_by
           WHERE key = :key""",
        params=params,
    )
    new_key = updates.get("key", key)
    detail = f"Updated from value='{old_value}' fields={list(updates.keys())}"
    db.log_activity("config_update", f"Updated setting '{key}'", detail)
    return {"message": f"Updated {new_key}"}

def delete_config_setting_service(*, key: str) -> dict:
    """Delete a config setting by key. Raises AdminNotFoundError if absent."""
    existing = db.query(
        f"SELECT key FROM {T.APP_CONFIG_SETTINGS} WHERE key = :key",
        params={"key": key},
    )
    if existing.empty:
        raise AdminNotFoundError(f"Setting '{key}' not found")
    db.execute(
        f"DELETE FROM {T.APP_CONFIG_SETTINGS} WHERE key = :key",
        params={"key": key},
    )
    db.log_activity("config_delete", f"Deleted setting '{key}'", "")
    return {"message": f"Deleted {key}"}


# ─── Grid settings CRUD (Phase 5.e) ──────────────────────────────────────────
#
# Extracted from api/routes/admin.py::get_grid_settings /
# get_grid_pages / get_grid_columns / update_grid_column /
# update_grid_setting. Same URL surface, same envelopes; the
# frontend hooks (Phase 3.a queryKeys.admin.grids*) keep working.
#
# The grid-level and column-level UPDATEs preserve the pre-existing
# behavior exactly — including the on-wire int/bool coercion loop that
# every grid response carries so Pydantic (Phase 2.c) coerces to bool
# on the way out. Column-level allowed-field whitelists mirror the
# route's frozen sets.

_GRID_SETTINGS_BOOL_COLS: tuple[str, ...] = (
    "allow_column_toggle", "allow_export", "read_only",
    "pagination_enabled", "sticky_header", "sticky_first_column",
    "row_striping", "dense_mode", "show_row_count", "wrap_text",
    "allow_selection", "allow_print",
    "show_search", "show_density_toggle", "show_medal_toggles",
    "allow_column_reorder",
    # Phase 10 B2
    "allow_expansion",
    # Phase 3 §S9
    "live_update_highlight", "team_accent_reactive",
)

_GRID_COLUMN_BOOL_COLS: tuple[str, ...] = (
    "default_visible", "allow_sort", "allow_filter", "read_only",
    "wrap_text", "resizable", "group_by",
    # Phase 8 H3
    "editable",
)

_GRID_COLUMN_NUM_COLS: tuple[str, ...] = (
    "width", "min_width", "max_width", "column_order",
)

_GRID_SETTING_UPDATE_ALLOWED = frozenset({
    "read_only", "allow_column_toggle", "allow_export",
    "title", "sub_header", "footer",
    "default_page_size", "page_size_options", "pagination_enabled",
    "sticky_header", "sticky_first_column", "row_striping",
    "dense_mode", "default_sort_column", "default_sort_direction",
    "show_row_count", "show_ranking", "wrap_text", "min_column_width",
    "sort_asc_color", "sort_desc_color", "hover_color",
    "allow_selection", "allow_print",
    "page", "tooltip_delay_duration", "show_search",
    "show_density_toggle", "show_medal_toggles",
    "row_key_column",
    "caption",
    "allow_column_reorder",
    # Phase 10 B2
    "allow_expansion",
    # Phase 3 §S9
    "numeral_style", "live_update_highlight", "team_accent_reactive",
    "modified_by",
})

_GRID_COLUMN_UPDATE_ALLOWED = frozenset({
    "label_override", "tooltip_override", "default_visible",
    "default_sort", "default_filter", "column_order",
    "format_string", "null_display", "allow_sort", "allow_sort_mode", "allow_filter",
    "read_only", "width", "min_width", "max_width",
    "pinned", "text_align", "wrap_text", "resizable",
    "cell_type", "aggregate_function", "conditional_format",
    "link_target", "group_by",
    "sort_asc_color", "sort_desc_color",
    "gradient_from_color", "gradient_to_color",
    # Phase 8 H3: `editable` gates the `<EditableCell>` runtime primitive.
    "editable",
    "modified_by",
})

def _coerce_grid_row_bools(row: dict, bool_cols: tuple[str, ...]) -> dict:
    """Coerce 0/1 columns to canonical 0/1 ints (Pydantic later → bool)."""
    for col in bool_cols:
        if col in row:
            row[col] = 1 if row.get(col) else 0
    return row

def _coerce_grid_row_numbers(row: dict, num_cols: tuple[str, ...]) -> dict:
    """Replace NaN/Inf numeric columns with None so JSON serialization is safe."""
    import math
    for col in num_cols:
        if col in row:
            v = row[col]
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                row[col] = None
    return row

def list_grid_settings_service() -> list[dict]:
    """Return every app_grid_settings row (grid-level UI config).

    Boolean 0/1 columns are normalised so Pydantic's Phase-2.c bool
    coercion sees canonical ints on the way out.
    """
    df = db.query(f"SELECT * FROM {T.APP_GRID_SETTINGS} ORDER BY grid_label")
    rows = df.to_dict(orient="records") if hasattr(df, "to_dict") else []
    logger.debug("list_grid_settings_service: {count} grids returned", count=len(rows))
    return [_coerce_grid_row_bools(r, _GRID_SETTINGS_BOOL_COLS) for r in rows]

def list_grid_pages_service() -> list[str]:
    """Return the distinct set of non-null `page` values for the admin Screen dropdown."""
    df = db.query(
        f"SELECT DISTINCT page FROM {T.APP_GRID_SETTINGS} "
        "WHERE page IS NOT NULL AND page <> '' ORDER BY page"
    )
    return [r["page"] for r in df.to_dict(orient="records")]

def list_grid_columns_service(*, grid_id: str) -> list[dict]:
    """Return every app_grid_column_settings row for `grid_id`, ordered by column_order."""
    df = db.query(
        f"""
        SELECT agcs.*
        FROM {T.APP_GRID_COLUMN_SETTINGS} agcs
        JOIN {T.APP_GRID_SETTINGS} ags ON agcs.grid_setting_id = ags.grid_setting_id
        WHERE ags.grid_id = %s
        ORDER BY agcs.column_order
        """,
        (grid_id,),
    )
    rows = df.to_dict(orient="records") if hasattr(df, "to_dict") else []
    if not rows:
        logger.warning(
            "list_grid_columns_service: no columns configured for grid_id={grid_id} — "
            "frontend DataGrid will render zero columns until app_grid_settings + "
            "app_grid_column_settings are seeded",
            grid_id=grid_id,
        )
    else:
        logger.debug(
            "list_grid_columns_service: grid_id={grid_id} → {count} columns",
            grid_id=grid_id, count=len(rows),
        )
    out = []
    for r in rows:
        _coerce_grid_row_bools(r, _GRID_COLUMN_BOOL_COLS)
        _coerce_grid_row_numbers(r, _GRID_COLUMN_NUM_COLS)
        out.append(r)
    return out

def update_grid_setting_service(*, grid_id: str, body: dict) -> dict:
    """Update whitelisted grid-level settings and emit an audit-log entry.

    Raises AdminValidationError when no whitelisted field is present.
    Preserves the pre-existing behavior of the route exactly, including
    the audit-log detail string format ("field: 'old' -> 'new'" | ...).
    """
    body = dict(body)  # don't mutate caller's dict
    fields = {k: v for k, v in body.items() if k in _GRID_SETTING_UPDATE_ALLOWED}
    if not fields:
        raise AdminValidationError("No valid fields to update")
    modified_by = fields.pop("modified_by", "Admin")

    old_df = db.query(
        f"SELECT * FROM {T.APP_GRID_SETTINGS} WHERE grid_id = %s",
        (grid_id,),
    )
    old_values = old_df.to_dict(orient="records")[0] if not old_df.empty else {}

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    update_fields = {**fields, "modified_by": modified_by, "grid_id": grid_id}
    db.execute(
        f"""UPDATE {T.APP_GRID_SETTINGS}
            SET {set_clause},
                modified_at = datetime('now'),
                modified_by = :modified_by
            WHERE grid_id = :grid_id""",
        params=update_fields,
    )

    changes = [
        f"{k}: '{old_values.get(k)}' -> '{v}'"
        for k, v in fields.items()
        if str(old_values.get(k)) != str(v)
    ]
    detail = " | ".join(changes) if changes else "No changes detected"
    db.log_activity(
        "grid_config_update",
        f"Updated grid settings for '{grid_id}' by {modified_by}",
        detail,
    )
    return {"message": f"Grid {grid_id} updated"}

def update_grid_column_service(*, grid_id: str, column_id: str, body: dict) -> dict:
    """Update whitelisted column-level settings and emit an audit-log entry.

    Raises AdminValidationError when no whitelisted field is present.
    """
    body = dict(body)
    fields = {k: v for k, v in body.items() if k in _GRID_COLUMN_UPDATE_ALLOWED}
    if not fields:
        raise AdminValidationError("No valid fields to update")
    modified_by = fields.pop("modified_by", "Admin")

    old_df = db.query(
        f"""
        SELECT agcs.*
        FROM {T.APP_GRID_COLUMN_SETTINGS} agcs
        JOIN {T.APP_GRID_SETTINGS} ags ON agcs.grid_setting_id = ags.grid_setting_id
        WHERE ags.grid_id = %s AND agcs.column_id = %s
        """,
        (grid_id, column_id),
    )
    old_values = old_df.to_dict(orient="records")[0] if not old_df.empty else {}

    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    update_fields = {
        **fields,
        "modified_by": modified_by,
        "grid_id": grid_id,
        "column_id": column_id,
    }
    db.execute(
        f"""UPDATE {T.APP_GRID_COLUMN_SETTINGS}
            SET {set_clause},
                modified_at = datetime('now'),
                modified_by = :modified_by
            WHERE column_setting_id = (
                SELECT agcs.column_setting_id
                FROM {T.APP_GRID_COLUMN_SETTINGS} agcs
                JOIN {T.APP_GRID_SETTINGS} ags
                  ON agcs.grid_setting_id = ags.grid_setting_id
                WHERE ags.grid_id = :grid_id
                  AND agcs.column_id = :column_id
            )""",
        params=update_fields,
    )

    changes = [
        f"{k}: '{old_values.get(k)}' -> '{v}'"
        for k, v in fields.items()
        if str(old_values.get(k)) != str(v)
    ]
    detail = " | ".join(changes) if changes else "No changes detected"
    db.log_activity(
        "grid_config_update",
        f"Updated column '{column_id}' in grid '{grid_id}' by {modified_by}",
        detail,
    )
    return {"message": "Column updated"}

def _resolve_grid_setting_id(grid_id: str) -> int:
    """Return the grid_setting_id PK for `grid_id`.

    Raises AdminNotFoundError when the grid isn't seeded — the admin
    Column Editor should never send create/delete traffic for an
    unregistered grid.
    """
    df = db.query(
        f"SELECT grid_setting_id FROM {T.APP_GRID_SETTINGS} WHERE grid_id = %s",
        (grid_id,),
    )
    if df.empty:
        raise AdminNotFoundError(f"Grid '{grid_id}' not found")
    return int(df.iloc[0]["grid_setting_id"])

def create_grid_column_service(*, grid_id: str, body: dict) -> dict:
    """Insert a new column into `app_grid_column_settings` under `grid_id`.

    Body must contain `column_id`. Only whitelisted fields
    (`_GRID_COLUMN_UPDATE_ALLOWED`) are accepted for the initial
    values — the same posture as UPDATE, so an admin can't smuggle in
    a non-declared field. `column_order` defaults to
    MAX(column_order) + 1 when omitted so appended columns land at
    the tail.

    Raises:
        AdminValidationError: `column_id` missing / empty.
        AdminNotFoundError: `grid_id` doesn't exist.
        AdminConflictError: (grid_setting_id, column_id) already
            present — the schema-level unique index would otherwise
            surface as a 500.
    """
    body = dict(body)
    column_id = str(body.pop("column_id", "") or "").strip()
    if not column_id:
        raise AdminValidationError("column_id is required")

    grid_setting_id = _resolve_grid_setting_id(grid_id)

    # Reject dup at the service layer so we return a meaningful 409
    # rather than a raw IntegrityError from SQLite.
    dup = db.query(
        f"""
        SELECT column_setting_id
        FROM {T.APP_GRID_COLUMN_SETTINGS}
        WHERE grid_setting_id = %s AND column_id = %s
        """,
        (grid_setting_id, column_id),
    )
    if not dup.empty:
        raise AdminConflictError(
            f"Column '{column_id}' already exists on grid '{grid_id}'"
        )

    modified_by = body.pop("modified_by", "Admin")
    fields = {k: v for k, v in body.items() if k in _GRID_COLUMN_UPDATE_ALLOWED}

    # Default column_order to append when the caller didn't pick one.
    if "column_order" not in fields or fields["column_order"] is None:
        max_df = db.query(
            f"""
            SELECT COALESCE(MAX(column_order), 0) + 1 AS next_order
            FROM {T.APP_GRID_COLUMN_SETTINGS}
            WHERE grid_setting_id = %s
            """,
            (grid_setting_id,),
        )
        fields["column_order"] = int(max_df.iloc[0]["next_order"])

    insert_cols = ["grid_setting_id", "column_id", *fields.keys(),
                   "modified_at", "modified_by"]
    placeholders = [":grid_setting_id", ":column_id",
                    *[f":{k}" for k in fields.keys()],
                    "datetime('now')", ":modified_by"]
    params = {
        "grid_setting_id": grid_setting_id,
        "column_id": column_id,
        "modified_by": modified_by,
        **fields,
    }
    db.execute(
        f"""INSERT INTO {T.APP_GRID_COLUMN_SETTINGS} ({", ".join(insert_cols)})
            VALUES ({", ".join(placeholders)})""",
        params=params,
    )

    detail = f"Inserted column '{column_id}' with fields={list(fields.keys())}"
    db.log_activity(
        "grid_config_update",
        f"Created column '{column_id}' in grid '{grid_id}' by {modified_by}",
        detail,
    )
    return {"message": f"Column {column_id} created"}

def delete_grid_column_service(*, grid_id: str, column_id: str) -> dict:
    """Remove a column row from `app_grid_column_settings`.

    Raises AdminNotFoundError when the (grid_id, column_id) pair
    doesn't resolve to a row — the admin editor should refresh
    baseline before retrying.
    """
    grid_setting_id = _resolve_grid_setting_id(grid_id)

    existing = db.query(
        f"""
        SELECT column_setting_id
        FROM {T.APP_GRID_COLUMN_SETTINGS}
        WHERE grid_setting_id = %s AND column_id = %s
        """,
        (grid_setting_id, column_id),
    )
    if existing.empty:
        raise AdminNotFoundError(
            f"Column '{column_id}' not found on grid '{grid_id}'"
        )

    db.execute(
        f"""DELETE FROM {T.APP_GRID_COLUMN_SETTINGS}
           WHERE grid_setting_id = :grid_setting_id
             AND column_id = :column_id""",
        params={"grid_setting_id": grid_setting_id, "column_id": column_id},
    )
    db.log_activity(
        "grid_config_update",
        f"Deleted column '{column_id}' from grid '{grid_id}'",
        "",
    )
    return {"message": f"Column {column_id} deleted"}


# ─── Teams CRUD (Phase 5.f) ──────────────────────────────────────────────────

def list_export_history_service(*, limit: int = 100) -> list[dict]:
    """Return recent export history rows, newest first."""
    df = db.query(
        f"SELECT * FROM {T.SYS_EXPORT_RUNS} ORDER BY exported_at DESC LIMIT :lim",
        params={"lim": limit},
    )
    return df.to_dict(orient="records")

def log_export_service(*, export_type: str, page: str, row_count: int | None,
                       user_note: str | None) -> None:
    """Record a CSV/PDF export event."""
    db.execute(
        f"INSERT INTO {T.SYS_EXPORT_RUNS} (export_type, page, row_count, user_note) "
        "VALUES (:et, :pg, :rc, :un)",
        params={"et": export_type, "pg": page, "rc": row_count, "un": user_note},
    )

def get_sync_state_service() -> dict[str, str]:
    """Return the last_sync_ts / last_sync_error keys from sys_state."""
    df = db.query(
        f"SELECT key, value FROM {T.SYS_STATE} "
        "WHERE key IN ('last_sync_ts', 'last_sync_error')"
    )
    if df.empty:
        return {}
    return {row["key"]: row["value"] for _, row in df.iterrows()}

def get_audit_run_service(*, run_id: int) -> Optional[dict]:
    """Return one row from sys_audit_runs by id, or None."""
    df = db.query(f"SELECT * FROM {T.SYS_AUDIT_RUNS} WHERE id = :rid",
                  params={"rid": run_id})
    if df.empty:
        return None
    return df.iloc[0].to_dict()


# ─── System KPIs & database summary (Phase 5.d) ──────────────────────────────
#
# Extracted from api/routes/admin.py::get_admin_kpi / get_database_summary.
# The routes kept a `get_sqlite_table_size` helper that reached into a raw
# DB-API connection; it moves here with the query that feeds it so the whole
# size-estimation heuristic stays in one place.

def _estimate_sqlite_table_size(table_name: str, row_count: int, conn) -> int:
    """Estimate the on-disk byte size of a SQLite table by row sampling.

    Enumerates columns via PRAGMA table_info, averages the serialized length of
    up to 100 rows, then multiplies by row_count plus a 24-byte per-row
    allowance for SQLite's internal bookkeeping.

    Returns 0 for empty tables and on any error — this is a display-only
    estimate and must never fail the summary endpoint.
    """
    if row_count == 0:
        return 0
    try:
        cursor = conn.cursor()
        cursor.execute(f'PRAGMA table_info("{table_name}")')
        columns = [row[1] for row in cursor.fetchall()]
        if not columns:
            return 0
        sum_expr = " + ".join([f'coalesce(length("{c}"), 0)' for c in columns])
        cursor.execute(
            f'SELECT avg({sum_expr}) FROM (SELECT * FROM "{table_name}" LIMIT 100)'
        )
        avg_row_size = cursor.fetchone()[0]
        if avg_row_size is None:
            avg_row_size = 0
        return int((avg_row_size + 24) * row_count)
    except Exception:
        return 0

def get_database_summary_service() -> dict:
    """Return overall DB size plus per-table row counts and size estimates.

    Postgres reports true sizes via pg_database_size / pg_total_relation_size;
    SQLite reports the file size on disk and the sampling estimate above.
    """
    import os
    from bedrock.core.config import config

    overall_size = 0
    if db.is_postgres:
        try:
            db_size_df = db.query("SELECT pg_database_size(current_database()) AS size")
            overall_size = int(db_size_df.iloc[0]["size"])
        except Exception:
            overall_size = 0
    elif os.path.exists(config.SQLITE_DB_PATH):
        overall_size = os.path.getsize(config.SQLITE_DB_PATH)

    if db.is_postgres:
        tables_df = db.query(
            "SELECT table_name AS name FROM information_schema.tables "
            "WHERE table_schema = 'public' ORDER BY table_name"
        )
    else:
        tables_df = db.query(
            "SELECT name FROM sqlite_master "
            "WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )

    tables = [r["name"] for r in tables_df.to_dict(orient="records")]
    result_tables: list[dict] = []

    with db.get_connection() as conn:
        for table in tables:
            try:
                cnt_df = db.query(f'SELECT COUNT(*) AS cnt FROM "{table}"')
                row_count = int(cnt_df.iloc[0]["cnt"])
            except Exception as exc:
                logger.warning("Could not count rows for {table}: {error}",
                               table=table, error=exc)
                row_count = 0

            if db.is_postgres:
                try:
                    size_df = db.query(
                        f"SELECT pg_total_relation_size('\"{table}\"') AS size"
                    )
                    table_size = int(size_df.iloc[0]["size"])
                except Exception:
                    table_size = 0
            else:
                table_size = _estimate_sqlite_table_size(table, row_count, conn)

            result_tables.append({
                "table_name": table,
                "row_count": row_count,
                "table_size": table_size,
            })

    return {"overall_size": overall_size, "tables": result_tables}


# ─── Unified log feed (Phase 5.d) ────────────────────────────────────────────
#
# Extracted from api/routes/admin.py::get_logs. Merges log_activity,
# import_runs and sys_export_runs into one chronological list.

def list_system_logs_service(
    *,
    source: Optional[str] = None,
    event_type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 200,
) -> list[dict]:
    """Return the merged, newest-first log feed, capped at `limit` rows.

    `source` selects one stream ('activity' | 'import' | 'export'); None or
    'all' merges every stream. Date bounds are inclusive ISO date strings.
    Each row carries a `display_type` resolved through the log_event_types
    lookup, falling back to a title-cased event key.
    """
    rows: list[dict] = []

    if source in (None, "all", "activity"):
        where = ["1=1"]
        params: dict = {}
        if event_type:
            where.append("event_type = :et")
            params["et"] = event_type
        if date_from:
            where.append("event_ts >= :df")
            params["df"] = date_from
        if date_to:
            where.append("event_ts <= :dt")
            params["dt"] = date_to + "T23:59:59"
        df_act = db.query(
            f"""SELECT
                    'activity' AS source,
                    event_type,
                    description AS message,
                    event_ts AS timestamp,
                    detail
                FROM {T.LOG_ACTIVITY}
                WHERE {' AND '.join(where)}
                ORDER BY event_ts DESC
                LIMIT :lim""",
            params={**params, "lim": limit},
        )
        rows.extend(df_act.to_dict(orient="records"))

    if source in (None, "all", "import"):
        where = ["1=1"]
        params = {}
        if date_from:
            where.append("started_ts >= :df")
            params["df"] = date_from
        if date_to:
            where.append("started_ts <= :dt")
            params["dt"] = date_to + "T23:59:59"
        df_imp = db.query(
            f"""SELECT
                    'import' AS source,
                    CASE
                        WHEN run_type = 'data' THEN 'Daily Sync'
                        WHEN run_type = 'milb' THEN 'MiLB Sync'
                        WHEN run_type = 'chadwick' THEN 'Chadwick Sync'
                        WHEN run_type = 'lahman' THEN 'Lahman Sync'
                        WHEN run_type = 'rankings' THEN 'BA Rankings'
                        ELSE COALESCE(run_type, 'Sync')
                    END AS event_type,
                    source || ' — ' || status AS message,
                    started_ts AS timestamp,
                    'Rows: ' || COALESCE(committed_rows, total_rows, 0) ||
                    ' | Duration: ' ||
                    CASE
                        WHEN completed_ts IS NOT NULL AND started_ts IS NOT NULL
                        THEN ROUND(
                            (julianday(completed_ts) - julianday(started_ts))
                            * 86400
                        ) || 's'
                        ELSE '—'
                    END AS detail
                FROM {T.IMPORT_RUNS}
                WHERE {' AND '.join(where)}
                ORDER BY started_ts DESC
                LIMIT :lim""",
            params={**params, "lim": limit},
        )
        rows.extend(df_imp.to_dict(orient="records"))

    if source in (None, "all", "export"):
        where = ["1=1"]
        params = {}
        if date_from:
            where.append("exported_at >= :df")
            params["df"] = date_from
        if date_to:
            where.append("exported_at <= :dt")
            params["dt"] = date_to + "T23:59:59"
        df_exp = db.query(
            f"""SELECT
                    'export' AS source,
                    export_type AS event_type,
                    page || ' — ' || export_type AS message,
                    exported_at AS timestamp,
                    'Rows: ' || COALESCE(row_count, 0) ||
                    ' | By: ' || exported_by AS detail
                FROM {T.SYS_EXPORT_RUNS}
                WHERE {' AND '.join(where)}
                ORDER BY exported_at DESC
                LIMIT :lim""",
            params={**params, "lim": limit},
        )
        rows.extend(df_exp.to_dict(orient="records"))

    rows = [r for r in rows if r.get("timestamp")]
    rows.sort(key=lambda r: str(r["timestamp"]), reverse=True)
    rows = rows[:limit]

    # Human-readable display types. A missing/unreadable lookup table must not
    # fail the feed — fall back to title-casing the raw key.
    try:
        lookup_df = db.query(f"SELECT event_key, display_label FROM {T.LOG_EVENT_TYPES}")
        lookup = {
            r["event_key"]: r["display_label"]
            for r in lookup_df.to_dict(orient="records")
        }
    except Exception as exc:
        logger.warning("Could not load log display types: {error}", error=exc)
        lookup = {}
    for row in rows:
        raw = row.get("event_type") or row.get("source") or ""
        row["display_type"] = lookup.get(raw, raw.replace("_", " ").title())

    return _sanitize(rows)


# ─── Sync schedule / status / trigger (Phase 5.d) ────────────────────────────

def get_sync_schedule_service(*, limit: int = 50) -> dict:
    """Return recent import_runs history plus any stuck ('orphaned') runs.

    A run still marked 'running' more than an hour after it started is
    reported as orphaned so the Admin console can surface it.
    """
    df = db.query(
        f"""SELECT
                source,
                CASE
                    WHEN run_type = 'data' THEN 'Daily Sync'
                    WHEN run_type = 'milb' THEN 'MiLB Sync'
                    WHEN run_type = 'chadwick' THEN 'Chadwick Sync'
                    WHEN run_type = 'lahman' THEN 'Lahman Sync'
                    WHEN run_type = 'rankings' THEN 'BA Rankings'
                    ELSE COALESCE(run_type, 'Sync')
                END AS run_type,
                status,
                started_ts AS started_at,
                completed_ts AS completed_at,
                COALESCE(committed_rows, total_rows, 0) AS total_rows,
                CASE
                    WHEN completed_ts IS NOT NULL AND started_ts IS NOT NULL
                    THEN ROUND(
                        (julianday(completed_ts) - julianday(started_ts))
                        * 86400
                    )
                    ELSE NULL
                END AS duration_seconds,
                'scheduled' AS trigger_type
            FROM {T.IMPORT_RUNS}
            ORDER BY started_ts DESC
            LIMIT :lim""",
        params={"lim": limit},
    )
    history = df.to_dict(orient="records")

    orphans_df = db.query(
        f"""SELECT import_run_id, source, started_ts
            FROM {T.IMPORT_RUNS}
            WHERE status = 'running'
              AND started_ts < datetime('now', '-1 hour')
            ORDER BY started_ts DESC"""
    )
    orphaned_runs = (
        orphans_df.to_dict(orient="records") if not orphans_df.empty else []
    )

    return {"history": _sanitize(history), "orphaned_runs": orphaned_runs}

def count_running_syncs_service() -> int:
    """Return how many import_runs rows are currently in the 'running' state."""
    df = db.query(
        f"SELECT COUNT(*) AS cnt FROM {T.IMPORT_RUNS} WHERE status = 'running'"
    )
    return int(df.iloc[0]["cnt"]) if not df.empty else 0

def get_sync_status_service() -> dict:
    """Return current sync state: running flag, last sync/error, recent runs."""
    state = get_sync_state_service()
    runs_df = db.query(
        f"SELECT * FROM {T.IMPORT_RUNS} ORDER BY started_ts DESC LIMIT 10"
    )
    return {
        "last_sync_ts": state.get("last_sync_ts"),
        "last_sync_error": state.get("last_sync_error"),
        "is_running": count_running_syncs_service() > 0,
        "recent_runs": runs_df.to_dict(orient="records"),
    }


# ─── Seasons (Phase 5.d) ─────────────────────────────────────────────────────


def list_ui_query_config_service() -> list[dict]:
    """Return every UI hook query-config row, ordered by hook name.

    Booleans are coerced to 0/1 so the payload shape matches SQLite's storage
    regardless of which backend answered the query.
    """
    df = db.query(f"SELECT * FROM {T.APP_UI_QUERY_CONFIG} ORDER BY hook_name")
    rows = df.to_dict(orient="records")
    for row in rows:
        if isinstance(row.get("refetch_on_window_focus"), bool):
            row["refetch_on_window_focus"] = 1 if row["refetch_on_window_focus"] else 0
    return _sanitize(rows)

def update_ui_query_config_service(*, hook_name: str, body: dict) -> dict:
    """Update whitelisted stale-time / refetch fields for one UI hook."""
    fields = {k: v for k, v in body.items() if k in _UI_QUERY_CONFIG_ALLOWED_FIELDS}
    if not fields:
        raise AdminValidationError("No valid fields")
    modified_by = fields.pop("modified_by", "Admin")
    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["modified_by"] = modified_by
    fields["hook_name"] = hook_name
    db.execute(
        f"""UPDATE {T.APP_UI_QUERY_CONFIG}
            SET {set_clause},
                modified_at = datetime('now'),
                modified_by = :modified_by
            WHERE hook_name = :hook_name""",
        params=fields,
    )
    return {"message": "Config updated"}


# ─── Photo preview + audit history (Phase 5.d) ───────────────────────────────

def list_audit_history_service(*, limit: int = 20) -> list[dict]:
    """Return past audit runs, newest first, with `checks_run` decoded to a list.

    A malformed checks_run payload degrades to an empty list rather than
    failing the whole history read.
    """
    import json
    import math

    df = db.query(
        f"SELECT id, run_at, triggered_by, checks_run, summary_p1, summary_p2, "
        f"summary_p3, total, duration_ms FROM {T.SYS_AUDIT_RUNS} "
        "ORDER BY id DESC LIMIT %s",
        (limit,),
    )

    def _nv(value):
        """NaN/None → None; everything else passes through."""
        if value is None or (isinstance(value, float) and math.isnan(value)):
            return None
        return value

    rows: list[dict] = []
    for _, row in df.iterrows():
        checks: list = []
        raw = _nv(row.get("checks_run"))
        if raw:
            try:
                checks = json.loads(raw)
            except (ValueError, TypeError):
                checks = []
        rows.append({
            "id": int(row["id"]),
            "run_at": _nv(row.get("run_at")),
            "triggered_by": _nv(row.get("triggered_by")) or "unknown",
            "checks_run": checks,
            "summary_p1": int(row.get("summary_p1") or 0),
            "summary_p2": int(row.get("summary_p2") or 0),
            "summary_p3": int(row.get("summary_p3") or 0),
            "total": int(row.get("total") or 0),
            "duration_ms": (
                int(row["duration_ms"])
                if _nv(row.get("duration_ms")) is not None else None
            ),
        })
    return rows
