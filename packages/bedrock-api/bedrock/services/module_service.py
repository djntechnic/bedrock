"""
Module:  module_service.py
Layer:   api/services
Desc:    Phase 5.9 — per-user module enablement. Modules are top-level
         features (dashboard, leaderboards, rankings, trends, players,
         inventory, admin, health). Each role has a default set of granted
         module slugs (role_modules); admins can override on a per-user
         basis via user_module_overrides (granted=1 forces on, granted=0
         forces off). The effective module set for a user is:

             (union of role defaults) - negative overrides + positive overrides
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from loguru import logger

from bedrock.core.database import db, DatabaseManager
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import auth_activity_service as audit


@dataclass(frozen=True)
class ModuleRecord:
    module_id: int
    slug: str
    label: str
    description: str | None
    sort_order: int
    is_core: bool

    def to_public(self) -> dict[str, Any]:
        return {
            "module_id": self.module_id,
            "slug": self.slug,
            "label": self.label,
            "description": self.description,
            "sort_order": self.sort_order,
            "is_core": self.is_core,
        }


def _row_to_module(row: dict[str, Any]) -> ModuleRecord:
    return ModuleRecord(
        module_id=int(row["module_id"]),
        slug=row["slug"],
        label=row["label"],
        description=row.get("description"),
        sort_order=int(row.get("sort_order") or 0),
        is_core=bool(row.get("is_core", 0)),
    )


def list_modules(*, database: DatabaseManager | None = None) -> list[ModuleRecord]:
    d = database or db
    df = d.query(f"SELECT * FROM {T.AUTH_MODULES} ORDER BY sort_order, slug")
    if df.empty:
        return []
    return [_row_to_module(r._asdict()) if hasattr(r, "_asdict") else _row_to_module(dict(r))
            for r in df.to_dict(orient="records")]


def list_modules_public(*, database: DatabaseManager | None = None) -> list[dict[str, Any]]:
    return [m.to_public() for m in list_modules(database=database)]



def _module_id(slug: str, *, database: DatabaseManager | None = None) -> int | None:
    d = database or db
    df = d.query(f"SELECT module_id FROM {T.AUTH_MODULES} WHERE slug = %s", (slug,))
    if df.empty:
        return None
    return int(df.iloc[0]["module_id"])


def get_user_modules(user_id: int, *, database: DatabaseManager | None = None) -> set[str]:
    """Resolve the effective set of enabled module slugs for a user.

    Formula: union(role defaults) minus explicit negative overrides plus
    explicit positive overrides.
    """
    d = database or db

    # Role defaults for every role the user holds.
    df_role = d.query(
        f"""
        SELECT DISTINCT m.slug
          FROM {T.AUTH_USER_ROLES} ur
          JOIN {T.AUTH_ROLE_MODULES} rm ON rm.role_id = ur.role_id AND rm.can_view = 1
          JOIN {T.AUTH_MODULES} m       ON m.module_id = rm.module_id
         WHERE ur.user_id = %s
        """,
        (user_id,),
    )
    slugs: set[str] = set(df_role["slug"].tolist()) if not df_role.empty else set()

    # Overrides
    df_over = d.query(
        f"""
        SELECT m.slug, umo.can_view
          FROM {T.AUTH_USER_MODULE_OVERRIDES} umo
          JOIN {T.AUTH_MODULES} m ON m.module_id = umo.module_id
         WHERE umo.user_id = %s
        """,
        (user_id,),
    )
    if not df_over.empty:
        for row in df_over.itertuples(index=False):
            if row.can_view == 1:
                slugs.add(row.slug)
            elif row.can_view == 0:
                slugs.discard(row.slug)
    return slugs


def get_anon_modules(*, database: DatabaseManager | None = None) -> set[str]:
    """Modules that unauthenticated visitors are allowed to reach."""
    d = database or db
    df = d.query(
        f"""
        SELECT DISTINCT m.slug
          FROM {T.AUTH_ROLES} r
          JOIN {T.AUTH_ROLE_MODULES} rm ON rm.role_id = r.role_id AND rm.can_view = 1
          JOIN {T.AUTH_MODULES} m       ON m.module_id = rm.module_id
         WHERE r.slug = 'anon'
        """
    )
    return set(df["slug"].tolist()) if not df.empty else set()


def set_user_module_override(
    user_id: int,
    slug: str,
    granted: bool | None,
    *,
    actor_user_id: int | None = None,
    database: DatabaseManager | None = None,
) -> None:
    """Create, flip, or clear a per-user override for a module.

    granted=True  → force enable  (INSERT/UPDATE can_view=1)
    granted=False → force disable (INSERT/UPDATE can_view=0)
    granted=None  → clear override (DELETE row so role defaults apply again)
    """
    d = database or db
    mid = _module_id(slug, database=d)
    if mid is None:
        raise ValueError(f"unknown module slug: {slug}")

    if granted is None:
        d.execute(
            f"DELETE FROM {T.AUTH_USER_MODULE_OVERRIDES} WHERE user_id = %s AND module_id = %s",
            (user_id, mid),
        )
        logger.info("Cleared module override user={} module={}", user_id, slug)
        audit.record(
            "module_revoked",
            user_id=actor_user_id,
            target_user_id=user_id,
            detail={"module": slug, "action": "override_cleared"},
        )
        return

    actor = str(actor_user_id) if actor_user_id is not None else "System"
    cols = {r["name"] for r in d.query(f"PRAGMA table_info({T.AUTH_USER_MODULE_OVERRIDES})").to_dict(orient="records")}
    if "granted" in cols:
        d.execute(
            f"""
            INSERT INTO {T.AUTH_USER_MODULE_OVERRIDES}
                (user_id, module_id, can_view, granted, created_at, created_by, modified_at, modified_by)
            VALUES (%s, %s, %s, %s, datetime('now'), %s, datetime('now'), %s)
            ON CONFLICT(user_id, module_id) DO UPDATE SET
                can_view    = excluded.can_view,
                granted     = excluded.granted,
                modified_at = excluded.modified_at,
                modified_by = excluded.modified_by
            """,
            (user_id, mid, 1 if granted else 0, 1 if granted else 0, actor, actor),
        )
    else:
        d.execute(
            f"""
            INSERT INTO {T.AUTH_USER_MODULE_OVERRIDES}
                (user_id, module_id, can_view, created_at, created_by, modified_at, modified_by)
            VALUES (%s, %s, %s, datetime('now'), %s, datetime('now'), %s)
            ON CONFLICT(user_id, module_id) DO UPDATE SET
                can_view    = excluded.can_view,
                modified_at = excluded.modified_at,
                modified_by = excluded.modified_by
            """,
            (user_id, mid, 1 if granted else 0, actor, actor),
        )
    logger.info(
        "Module override set user={} module={} granted={} by={}",
        user_id, slug, granted, actor_user_id,
    )
    audit.record(
        "module_granted" if granted else "module_revoked",
        user_id=actor_user_id,
        target_user_id=user_id,
        detail={"module": slug, "granted": granted},
    )


def list_user_overrides(user_id: int, *, database: DatabaseManager | None = None) -> dict[str, bool]:
    """Return {slug: bool} for every override on this user (positive OR negative)."""
    d = database or db
    df = d.query(
        f"""
        SELECT m.slug, umo.granted
          FROM {T.AUTH_USER_MODULE_OVERRIDES} umo
          JOIN {T.AUTH_MODULES} m ON m.module_id = umo.module_id
         WHERE umo.user_id = %s
        """,
        (user_id,),
    )
    if df.empty:
        return {}
    return {row.slug: bool(row.granted) for row in df.itertuples(index=False)}


def list_role_module_defaults(*, database: DatabaseManager | None = None) -> dict[str, set[str]]:
    """{role_slug: {module_slug, ...}} default grants."""
    d = database or db
    df = d.query(
        f"""
        SELECT r.slug AS role_slug, m.slug AS module_slug
          FROM {T.AUTH_ROLE_MODULES} rm
          JOIN {T.AUTH_ROLES}   r ON r.role_id = rm.role_id
          JOIN {T.AUTH_MODULES} m ON m.module_id = rm.module_id
         ORDER BY r.slug, m.sort_order
        """
    )
    out: dict[str, set[str]] = {}
    if df.empty:
        return out
    for row in df.itertuples(index=False):
        out.setdefault(row.role_slug, set()).add(row.module_slug)
    return out
