"""
Module:  security_service.py
Layer:   bedrock-api/services
Desc:    Granular authorization engine:
         - Computes effective capabilities per module: { module_slug: { view, update, delete, execute } }
         - Supports dynamic roles and multi-role bitwise OR resolution
         - Handles tri-state per-user overrides (NULL = inherit, 1 = grant, 0 = deny)
         - Role & permissions matrix CRUD
         - All operations record audit columns (created_at, created_by, modified_at, modified_by)
"""
from __future__ import annotations

from typing import Any, Literal
from loguru import logger

from bedrock.core.database import db, DatabaseManager
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import auth_activity_service as audit

ActionType = Literal["view", "update", "delete", "execute"]
CORE_ROLE_SLUGS: frozenset[str] = frozenset({"anon", "viewer", "member", "admin"})


def _get_db(database: DatabaseManager | None = None) -> DatabaseManager:
    return database or db


def list_modules(*, database: DatabaseManager | None = None) -> list[dict[str, Any]]:
    """List all registered modules."""
    d = _get_db(database)
    df = d.query(f"SELECT * FROM {T.AUTH_MODULES} ORDER BY sort_order, slug")
    if df.empty:
        return []
    return [dict(r) for r in df.to_dict(orient="records")]


def list_roles(*, database: DatabaseManager | None = None) -> list[dict[str, Any]]:
    """List all roles with metadata and assigned user counts."""
    d = _get_db(database)
    df = d.query(
        f"""
        SELECT r.role_id, r.slug, r.label, r.description, r.created_at, r.created_by, r.modified_at, r.modified_by,
               COUNT(ur.user_id) AS user_count
          FROM {T.AUTH_ROLES} r
          LEFT JOIN {T.AUTH_USER_ROLES} ur ON ur.role_id = r.role_id
         GROUP BY r.role_id
         ORDER BY r.role_id
        """
    )
    if df.empty:
        return []
    return [dict(r) for r in df.to_dict(orient="records")]


def create_custom_role(
    slug: str,
    label: str,
    description: str | None = None,
    created_by: str = "System",
    *,
    database: DatabaseManager | None = None,
) -> dict[str, Any]:
    """Create a new dynamic application role."""
    d = _get_db(database)
    slug = slug.strip().lower()
    df_exist = d.query(f"SELECT role_id FROM {T.AUTH_ROLES} WHERE slug = %s", (slug,))
    if not df_exist.empty:
        raise ValueError(f"Role with slug '{slug}' already exists")

    d.execute(
        f"""
        INSERT INTO {T.AUTH_ROLES} (slug, label, description, created_at, created_by, modified_at, modified_by)
        VALUES (%s, %s, %s, datetime('now'), %s, datetime('now'), %s)
        """,
        (slug, label, description, created_by, created_by),
    )
    df_new = d.query(f"SELECT * FROM {T.AUTH_ROLES} WHERE slug = %s", (slug,))
    role = dict(df_new.iloc[0])
    logger.info("Created custom role: slug={} by={}", slug, created_by)
    return role


def update_role(
    role_id: int,
    label: str | None = None,
    description: str | None = None,
    modified_by: str = "System",
    *,
    database: DatabaseManager | None = None,
) -> dict[str, Any]:
    """Update role label or description."""
    d = _get_db(database)
    df = d.query(f"SELECT * FROM {T.AUTH_ROLES} WHERE role_id = %s", (role_id,))
    if df.empty:
        raise ValueError(f"Role ID {role_id} not found")

    cur_label = df.iloc[0]["label"]
    cur_desc = df.iloc[0]["description"]
    new_label = label if label is not None else cur_label
    new_desc = description if description is not None else cur_desc

    d.execute(
        f"""
        UPDATE {T.AUTH_ROLES}
           SET label = %s, description = %s, modified_at = datetime('now'), modified_by = %s
         WHERE role_id = %s
        """,
        (new_label, new_desc, modified_by, role_id),
    )
    df_fresh = d.query(f"SELECT * FROM {T.AUTH_ROLES} WHERE role_id = %s", (role_id,))
    return dict(df_fresh.iloc[0])


def delete_custom_role(
    role_id: int,
    actor: str = "System",
    *,
    database: DatabaseManager | None = None,
) -> None:
    """Delete a custom role. Core roles cannot be deleted."""
    d = _get_db(database)
    df = d.query(f"SELECT slug FROM {T.AUTH_ROLES} WHERE role_id = %s", (role_id,))
    if df.empty:
        raise ValueError(f"Role ID {role_id} not found")
    slug = df.iloc[0]["slug"]
    if slug in CORE_ROLE_SLUGS:
        raise ValueError(f"Cannot delete protected core role: '{slug}'")

    d.execute(f"DELETE FROM {T.AUTH_ROLES} WHERE role_id = %s", (role_id,))
    logger.info("Deleted custom role: slug={} by={}", slug, actor)


def get_role_permissions_matrix(*, database: DatabaseManager | None = None) -> list[dict[str, Any]]:
    """Return full matrix of (role, module) permissions."""
    d = _get_db(database)
    df = d.query(
        f"""
        SELECT r.role_id, r.slug AS role_slug, r.label AS role_label,
               m.module_id, m.slug AS module_slug, m.label AS module_label, m.is_core,
               COALESCE(rm.can_view, 0) AS can_view,
               COALESCE(rm.can_update, 0) AS can_update,
               COALESCE(rm.can_delete, 0) AS can_delete,
               COALESCE(rm.can_execute, 0) AS can_execute
          FROM {T.AUTH_ROLES} r
         CROSS JOIN {T.AUTH_MODULES} m
          LEFT JOIN {T.AUTH_ROLE_MODULES} rm ON rm.role_id = r.role_id AND rm.module_id = m.module_id
         ORDER BY m.sort_order, m.slug, r.role_id
        """
    )
    if df.empty:
        return []
    return [dict(r) for r in df.to_dict(orient="records")]


def update_role_matrix(
    updates: list[dict[str, Any]],
    modified_by: str = "System",
    *,
    database: DatabaseManager | None = None,
) -> None:
    """Atomic bulk-update of capability flags in auth_role_modules."""
    d = _get_db(database)
    with d.transaction() as conn:
        for u in updates:
            role_id = int(u["role_id"])
            module_id = int(u["module_id"])
            can_v = 1 if u.get("can_view") else 0
            can_u = 1 if u.get("can_update") else 0
            can_d = 1 if u.get("can_delete") else 0
            can_e = 1 if u.get("can_execute") else 0

            # Protect admin role from losing capabilities
            df_role = d.query_conn(conn, f"SELECT slug FROM {T.AUTH_ROLES} WHERE role_id = %s", (role_id,))
            if not df_role.empty and df_role.iloc[0]["slug"] == "admin":
                can_v, can_u, can_d, can_e = 1, 1, 1, 1

            d.execute_conn(
                conn,
                f"""
                INSERT INTO {T.AUTH_ROLE_MODULES} 
                    (role_id, module_id, can_view, can_update, can_delete, can_execute, created_at, created_by, modified_at, modified_by)
                VALUES (%s, %s, %s, %s, %s, %s, datetime('now'), %s, datetime('now'), %s)
                ON CONFLICT(role_id, module_id) DO UPDATE SET
                    can_view    = excluded.can_view,
                    can_update  = excluded.can_update,
                    can_delete  = excluded.can_delete,
                    can_execute = excluded.can_execute,
                    modified_at = excluded.modified_at,
                    modified_by = excluded.modified_by
                """,
                (role_id, module_id, can_v, can_u, can_d, can_e, modified_by, modified_by),
            )
    logger.info("Updated role permissions matrix ({} entries) by={}", len(updates), modified_by)


def resolve_user_permissions(
    user_id: int | None,
    *,
    is_superuser: bool = False,
    database: DatabaseManager | None = None,
) -> dict[str, dict[str, bool]]:
    """
    Resolve the complete, effective { module_slug: { view, update, delete, execute } } dictionary.
    - Superusers or users holding 'admin' role get True for all actions on all modules.
    - Anonymous (user_id is None) gets the 'anon' role capabilities from auth_role_modules.
    - Authenticated users get the union (OR) of capabilities across all assigned roles,
      modified by explicit non-null user overrides in auth_user_module_overrides.
    """
    d = _get_db(database)
    modules = list_modules(database=d)
    all_slugs = [m["slug"] for m in modules]

    # Full bypass for superuser
    if is_superuser:
        return {slug: {"view": True, "update": True, "delete": True, "execute": True} for slug in all_slugs}

    # Anonymous branch
    if user_id is None:
        df_anon = d.query(
            f"""
            SELECT m.slug, rm.can_view, rm.can_update, rm.can_delete, rm.can_execute
              FROM {T.AUTH_ROLES} r
              JOIN {T.AUTH_ROLE_MODULES} rm ON rm.role_id = r.role_id
              JOIN {T.AUTH_MODULES} m       ON m.module_id = rm.module_id
             WHERE r.slug = 'anon'
            """
        )
        res: dict[str, dict[str, bool]] = {
            slug: {"view": False, "update": False, "delete": False, "execute": False} for slug in all_slugs
        }
        if not df_anon.empty:
            for row in df_anon.itertuples(index=False):
                res[row.slug] = {
                    "view": bool(row.can_view),
                    "update": bool(row.can_update),
                    "delete": bool(row.can_delete),
                    "execute": bool(row.can_execute),
                }
        return res

    # Check if user holds admin role
    df_user_roles = d.query(
        f"""
        SELECT r.slug
          FROM {T.AUTH_USER_ROLES} ur
          JOIN {T.AUTH_ROLES} r ON r.role_id = ur.role_id
         WHERE ur.user_id = %s
        """,
        (user_id,),
    )
    user_role_slugs = set(df_user_roles["slug"].tolist()) if not df_user_roles.empty else set()
    if "admin" in user_role_slugs:
        return {slug: {"view": True, "update": True, "delete": True, "execute": True} for slug in all_slugs}

    # Step 1: Base capabilities = Bitwise OR across all assigned roles
    df_caps = d.query(
        f"""
        SELECT m.slug,
               MAX(COALESCE(rm.can_view, 0)) AS can_view,
               MAX(COALESCE(rm.can_update, 0)) AS can_update,
               MAX(COALESCE(rm.can_delete, 0)) AS can_delete,
               MAX(COALESCE(rm.can_execute, 0)) AS can_execute
          FROM {T.AUTH_USER_ROLES} ur
          JOIN {T.AUTH_ROLE_MODULES} rm ON rm.role_id = ur.role_id
          JOIN {T.AUTH_MODULES} m       ON m.module_id = rm.module_id
         WHERE ur.user_id = %s
         GROUP BY m.slug
        """,
        (user_id,),
    )
    effective: dict[str, dict[str, bool]] = {
        slug: {"view": False, "update": False, "delete": False, "execute": False} for slug in all_slugs
    }
    if not df_caps.empty:
        for row in df_caps.itertuples(index=False):
            effective[row.slug] = {
                "view": bool(row.can_view),
                "update": bool(row.can_update),
                "delete": bool(row.can_delete),
                "execute": bool(row.can_execute),
            }

    # Step 2: Apply non-null user overrides
    df_over = d.query(
        f"""
        SELECT m.slug, umo.can_view, umo.can_update, umo.can_delete, umo.can_execute
          FROM {T.AUTH_USER_MODULE_OVERRIDES} umo
          JOIN {T.AUTH_MODULES} m ON m.module_id = umo.module_id
         WHERE umo.user_id = %s
        """,
        (user_id,),
    )
    if not df_over.empty:
        for row in df_over.itertuples(index=False):
            slug = row.slug
            if slug not in effective:
                effective[slug] = {"view": False, "update": False, "delete": False, "execute": False}
            if row.can_view is not None:
                effective[slug]["view"] = bool(row.can_view)
            if row.can_update is not None:
                effective[slug]["update"] = bool(row.can_update)
            if row.can_delete is not None:
                effective[slug]["delete"] = bool(row.can_delete)
            if row.can_execute is not None:
                effective[slug]["execute"] = bool(row.can_execute)

    return effective


def set_user_granular_override(
    user_id: int,
    module_slug: str,
    capabilities: dict[str, bool | None],
    actor: str = "System",
    *,
    database: DatabaseManager | None = None,
) -> None:
    """
    Set or clear tri-state capability overrides for a user on a module.
    capabilities: { 'view': bool | None, 'update': bool | None, 'delete': bool | None, 'execute': bool | None }
    If all 4 are None, removes the override row completely.
    """
    d = _get_db(database)
    df_m = d.query(f"SELECT module_id FROM {T.AUTH_MODULES} WHERE slug = %s", (module_slug,))
    if df_m.empty:
        raise ValueError(f"Unknown module slug: '{module_slug}'")
    module_id = int(df_m.iloc[0]["module_id"])

    cv = capabilities.get("view")
    cu = capabilities.get("update")
    cd = capabilities.get("delete")
    ce = capabilities.get("execute")

    # If all None, delete override row
    if cv is None and cu is None and cd is None and ce is None:
        d.execute(
            f"DELETE FROM {T.AUTH_USER_MODULE_OVERRIDES} WHERE user_id = %s AND module_id = %s",
            (user_id, module_id),
        )
        logger.info("Cleared user override: user={} module={} by={}", user_id, module_slug, actor)
        return

    val_v = 1 if cv is True else (0 if cv is False else None)
    val_u = 1 if cu is True else (0 if cu is False else None)
    val_d = 1 if cd is True else (0 if cd is False else None)
    val_e = 1 if ce is True else (0 if ce is False else None)

    cols = {r["name"] for r in d.query(f"PRAGMA table_info({T.AUTH_USER_MODULE_OVERRIDES})").to_dict(orient="records")}
    if "granted" in cols:
        val_g = 1 if val_v == 1 else 0
        d.execute(
            f"""
            INSERT INTO {T.AUTH_USER_MODULE_OVERRIDES}
                (user_id, module_id, can_view, can_update, can_delete, can_execute, granted, created_at, created_by, modified_at, modified_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, datetime('now'), %s, datetime('now'), %s)
            ON CONFLICT(user_id, module_id) DO UPDATE SET
                can_view    = excluded.can_view,
                can_update  = excluded.can_update,
                can_delete  = excluded.can_delete,
                can_execute = excluded.can_execute,
                granted     = excluded.granted,
                modified_at = excluded.modified_at,
                modified_by = excluded.modified_by
            """,
            (user_id, module_id, val_v, val_u, val_d, val_e, val_g, actor, actor),
        )
    else:
        d.execute(
            f"""
            INSERT INTO {T.AUTH_USER_MODULE_OVERRIDES}
                (user_id, module_id, can_view, can_update, can_delete, can_execute, created_at, created_by, modified_at, modified_by)
            VALUES (%s, %s, %s, %s, %s, %s, datetime('now'), %s, datetime('now'), %s)
            ON CONFLICT(user_id, module_id) DO UPDATE SET
                can_view    = excluded.can_view,
                can_update  = excluded.can_update,
                can_delete  = excluded.can_delete,
                can_execute = excluded.can_execute,
                modified_at = excluded.modified_at,
                modified_by = excluded.modified_by
            """,
            (user_id, module_id, val_v, val_u, val_d, val_e, actor, actor),
        )
    logger.info("Set user override: user={} module={} caps={} by={}", user_id, module_slug, capabilities, actor)


def get_user_security_profile(
    user_id: int,
    *,
    database: DatabaseManager | None = None,
) -> dict[str, Any]:
    """Compile full read-only security breakdown for a user."""
    d = _get_db(database)
    df_u = d.query(f"SELECT user_id, email, display_name, is_superuser, is_active FROM {T.AUTH_USERS} WHERE user_id = %s", (user_id,))
    if df_u.empty:
        raise ValueError(f"User {user_id} not found")
    user_info = dict(df_u.iloc[0])

    df_roles = d.query(
        f"""
        SELECT r.role_id, r.slug, r.label
          FROM {T.AUTH_USER_ROLES} ur
          JOIN {T.AUTH_ROLES} r ON r.role_id = ur.role_id
         WHERE ur.user_id = %s
        """,
        (user_id,),
    )
    roles = [dict(r) for r in df_roles.to_dict(orient="records")] if not df_roles.empty else []

    df_overrides = d.query(
        f"""
        SELECT m.slug, umo.can_view, umo.can_update, umo.can_delete, umo.can_execute
          FROM {T.AUTH_USER_MODULE_OVERRIDES} umo
          JOIN {T.AUTH_MODULES} m ON m.module_id = umo.module_id
         WHERE umo.user_id = %s
        """,
        (user_id,),
    )
    overrides = {r["slug"]: dict(r) for r in df_overrides.to_dict(orient="records")} if not df_overrides.empty else {}
    effective = resolve_user_permissions(user_id, is_superuser=bool(user_info.get("is_superuser")), database=d)

    return {
        "user": user_info,
        "roles": roles,
        "overrides": overrides,
        "effective": effective,
    }


def get_user_overrides_list(
    user_id: int,
    *,
    database: DatabaseManager | None = None,
) -> list[dict[str, Any]]:
    """Retrieve all modules with any user override flags for user_id."""
    d = _get_db(database)
    df = d.query(
        f"""
        SELECT m.module_id, m.slug AS module_slug, m.label AS module_label, m.is_core,
               umo.user_id,
               umo.can_view, umo.can_update, umo.can_delete, umo.can_execute
          FROM {T.AUTH_MODULES} m
          LEFT JOIN {T.AUTH_USER_MODULE_OVERRIDES} umo
            ON umo.module_id = m.module_id AND umo.user_id = %s
         ORDER BY m.is_core DESC, m.label
        """,
        (user_id,),
    )
    if df.empty:
        return []
    return [dict(r) for r in df.to_dict(orient="records")]


def update_user_overrides_bulk(
    user_id: int,
    overrides: list[dict[str, Any]],
    actor: str = "System",
    *,
    database: DatabaseManager | None = None,
) -> list[dict[str, Any]]:
    """Bulk update user capability overrides across modules."""
    d = _get_db(database)
    with d.transaction() as conn:
        for item in overrides:
            module_id = int(item["module_id"])
            can_v = item.get("can_view")
            can_u = item.get("can_update")
            can_d = item.get("can_delete")
            can_e = item.get("can_execute")

            val_v = 1 if can_v is True else (0 if can_v is False else None)
            val_u = 1 if can_u is True else (0 if can_u is False else None)
            val_d = 1 if can_d is True else (0 if can_d is False else None)
            val_e = 1 if can_e is True else (0 if can_e is False else None)

            if all(v is None for v in [val_v, val_u, val_d, val_e]):
                d.execute_conn(
                    conn,
                    f"DELETE FROM {T.AUTH_USER_MODULE_OVERRIDES} WHERE user_id = %s AND module_id = %s",
                    (user_id, module_id),
                )
            else:
                d.execute_conn(
                    conn,
                    f"""
                    INSERT INTO {T.AUTH_USER_MODULE_OVERRIDES}
                        (user_id, module_id, can_view, can_update, can_delete, can_execute, created_at, created_by, modified_at, modified_by)
                    VALUES (%s, %s, %s, %s, %s, %s, datetime('now'), %s, datetime('now'), %s)
                    ON CONFLICT(user_id, module_id) DO UPDATE SET
                        can_view    = excluded.can_view,
                        can_update  = excluded.can_update,
                        can_delete  = excluded.can_delete,
                        can_execute = excluded.can_execute,
                        modified_at = excluded.modified_at,
                        modified_by = excluded.modified_by
                    """,
                    (user_id, module_id, val_v, val_u, val_d, val_e, actor, actor),
                )
    return get_user_overrides_list(user_id, database=d)
