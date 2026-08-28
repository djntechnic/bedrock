"""
Module:  nav_service.py
Layer:   bedrock-api/services
Desc:    Dynamic navigation item settings service:
         - Retrieves all navigation customization settings (sort_order, label_override, icon_override, tooltip_override, is_hidden_override)
         - Updates navigation settings with audit columns
"""
from __future__ import annotations

from typing import Any
from loguru import logger

from bedrock.core.database import db, DatabaseManager
from bedrock.core.schema_catalog import Tables as T


def _get_db(database: DatabaseManager | None = None) -> DatabaseManager:
    return database or db


def get_nav_settings(*, database: DatabaseManager | None = None) -> list[dict[str, Any]]:
    """Retrieve all navigation item customization rows."""
    d = _get_db(database)
    df = d.query(
        f"""
        SELECT nav_setting_id, nav_key, parent_key, sort_order,
               label_override, icon_override, tooltip_override, is_hidden_override,
               created_at, created_by, modified_at, modified_by
          FROM {T.APP_NAV_ITEM_SETTINGS}
         ORDER BY sort_order, nav_key
        """
    )
    if df.empty:
        return []
    return [dict(r) for r in df.to_dict(orient="records")]


def update_nav_settings(
    settings: list[dict[str, Any]],
    actor: str = "System",
    *,
    database: DatabaseManager | None = None,
) -> list[dict[str, Any]]:
    """
    Bulk update or insert navigation settings.
    Each item: { nav_key, parent_key?, sort_order?, label_override?, icon_override?, tooltip_override?, is_hidden_override? }
    """
    d = _get_db(database)
    with d.transaction() as conn:
        for item in settings:
            nav_key = item["nav_key"]
            parent_key = item.get("parent_key")
            sort_order = int(item.get("sort_order", 0))
            label_ovr = item.get("label_override")
            icon_ovr = item.get("icon_override")
            tooltip_ovr = item.get("tooltip_override")
            is_hidden = 1 if item.get("is_hidden_override") else 0

            d.execute_conn(
                conn,
                f"""
                INSERT INTO {T.APP_NAV_ITEM_SETTINGS}
                    (nav_key, parent_key, sort_order, label_override, icon_override, tooltip_override, is_hidden_override,
                     created_at, created_by, modified_at, modified_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, datetime('now'), %s, datetime('now'), %s)
                ON CONFLICT(nav_key) DO UPDATE SET
                    parent_key         = excluded.parent_key,
                    sort_order         = excluded.sort_order,
                    label_override     = excluded.label_override,
                    icon_override      = excluded.icon_override,
                    tooltip_override   = excluded.tooltip_override,
                    is_hidden_override = excluded.is_hidden_override,
                    modified_at        = excluded.modified_at,
                    modified_by        = excluded.modified_by
                """,
                (nav_key, parent_key, sort_order, label_ovr, icon_ovr, tooltip_ovr, is_hidden, actor, actor),
            )
    logger.info("Updated {} navigation item settings by={}", len(settings), actor)
    return get_nav_settings(database=d)
