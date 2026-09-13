"""
Module:  test_module_service.py
Layer:   bedrock-api/tests
Desc:    Coverage for bedrock.services.module_service — the effective
         module-visibility resolver: role defaults, per-user overrides
         (grant / deny / clear), and the platform's own module catalog.

         Note: `list_user_overrides` selects `umo.granted`, a column that
         does not exist on `auth_user_module_overrides` in this package's
         own baseline schema (only `can_view`/`can_update`/`can_delete`/
         `can_execute` are defined — see bedrock/schema/baseline.sql). That
         makes `list_user_overrides` unusable against a freshly-provisioned
         platform database. `TestListUserOverrides` below documents this as
         the real, current behavior rather than papering over it; see the
         PR/task notes for the follow-up this should get filed under.
"""
from __future__ import annotations

import uuid

import pytest

from bedrock.core.database import db, DatabaseManager
from bedrock.core.database import DatabaseQueryError
from bedrock.core.schema_catalog import Tables as T
from bedrock.services import module_service as ms
from bedrock.services import user_service as us


@pytest.fixture
def user():
    return us.create_user(
        email=f"mod-{uuid.uuid4().hex[:12]}@example.com",
        password="pw-strong-123",
        default_role="member",
    )


@pytest.fixture
def admin():
    u = us.create_user(
        email=f"mod-admin-{uuid.uuid4().hex[:12]}@example.com",
        password="pw-strong-123",
        default_role="admin",
    )
    return u


# ── list_modules / list_modules_public ──────────────────────────────────────
class TestListModules:
    def test_returns_the_seeded_catalog(self):
        modules = ms.list_modules()
        slugs = {m.slug for m in modules}
        assert "health" in slugs
        assert "admin" in slugs

    def test_ordered_by_sort_order_then_slug(self):
        modules = ms.list_modules()
        sort_keys = [(m.sort_order, m.slug) for m in modules]
        assert sort_keys == sorted(sort_keys)

    def test_public_shape_matches_to_public(self):
        modules = ms.list_modules()
        public = ms.list_modules_public()
        assert len(public) == len(modules)
        assert public[0] == modules[0].to_public()
        assert set(public[0].keys()) == {
            "module_id", "slug", "label", "description", "sort_order", "is_core",
        }

    def test_is_core_is_a_real_bool(self):
        modules = ms.list_modules()
        assert all(isinstance(m.is_core, bool) for m in modules)


# ── get_user_modules ─────────────────────────────────────────────────────────
class TestGetUserModules:
    def test_member_gets_role_default_health(self, user):
        assert "health" in ms.get_user_modules(user.user_id)
        assert "admin" not in ms.get_user_modules(user.user_id)

    def test_admin_gets_admin_and_health(self, admin):
        mods = ms.get_user_modules(admin.user_id)
        assert "admin" in mods
        assert "health" in mods

    def test_unknown_user_has_no_modules(self):
        assert ms.get_user_modules(-999) == set()

    def test_positive_override_adds_a_module(self, user):
        ms.set_user_module_override(user.user_id, "admin", True)
        assert "admin" in ms.get_user_modules(user.user_id)

    def test_negative_override_removes_a_role_default(self, user):
        assert "health" in ms.get_user_modules(user.user_id)
        ms.set_user_module_override(user.user_id, "health", False)
        assert "health" not in ms.get_user_modules(user.user_id)

    def test_clearing_an_override_restores_role_default(self, user):
        ms.set_user_module_override(user.user_id, "health", False)
        assert "health" not in ms.get_user_modules(user.user_id)
        ms.set_user_module_override(user.user_id, "health", None)
        assert "health" in ms.get_user_modules(user.user_id)


# ── get_anon_modules ─────────────────────────────────────────────────────────
class TestGetAnonModules:
    def test_anon_can_see_health_but_not_admin(self):
        anon = ms.get_anon_modules()
        assert "health" in anon
        assert "admin" not in anon


# ── set_user_module_override ────────────────────────────────────────────────
class TestSetUserModuleOverride:
    def test_unknown_slug_raises(self, user):
        with pytest.raises(ValueError, match="unknown module slug"):
            ms.set_user_module_override(user.user_id, "not-a-real-module", True)

    def test_grant_emits_module_granted_audit_event(self, user, admin):
        from bedrock.services import auth_activity_service as audit

        ms.set_user_module_override(user.user_id, "admin", True, actor_user_id=admin.user_id)
        events = audit.query_events(user_id=admin.user_id, event_type="module_granted", limit=50)
        assert any(
            e["target_user_id"] == user.user_id and (e.get("detail") or {}).get("module") == "admin"
            for e in events
        )

    def test_deny_emits_module_revoked_audit_event(self, user, admin):
        from bedrock.services import auth_activity_service as audit

        ms.set_user_module_override(user.user_id, "health", False, actor_user_id=admin.user_id)
        events = audit.query_events(user_id=admin.user_id, event_type="module_revoked", limit=50)
        assert any(
            e["target_user_id"] == user.user_id and (e.get("detail") or {}).get("module") == "health"
            for e in events
        )

    def test_clear_emits_module_revoked_with_override_cleared_marker(self, user, admin):
        from bedrock.services import auth_activity_service as audit

        ms.set_user_module_override(user.user_id, "health", False, actor_user_id=admin.user_id)
        ms.set_user_module_override(user.user_id, "health", None, actor_user_id=admin.user_id)
        events = audit.query_events(user_id=admin.user_id, event_type="module_revoked", limit=50)
        assert any(
            e["target_user_id"] == user.user_id
            and (e.get("detail") or {}).get("action") == "override_cleared"
            for e in events
        )

    def test_setting_an_override_twice_updates_rather_than_duplicates(self, user):
        ms.set_user_module_override(user.user_id, "admin", True)
        ms.set_user_module_override(user.user_id, "admin", False)
        df = db.query(
            f"""
            SELECT COUNT(*) AS n FROM {T.AUTH_USER_MODULE_OVERRIDES} umo
              JOIN {T.AUTH_MODULES} m ON m.module_id = umo.module_id
             WHERE umo.user_id = %s AND m.slug = 'admin'
            """,
            (user.user_id,),
        )
        assert int(df.iloc[0]["n"]) == 1
        assert "admin" not in ms.get_user_modules(user.user_id)

    def test_no_actor_id_records_none_user_id_on_audit_event(self, user):
        from bedrock.services import auth_activity_service as audit

        ms.set_user_module_override(user.user_id, "admin", True)
        events = [
            e for e in audit.query_events(event_type="module_granted", limit=500)
            if e["target_user_id"] == user.user_id and (e.get("detail") or {}).get("module") == "admin"
        ]
        assert events
        assert events[-1]["user_id"] is None

    def test_uses_injected_database(self):
        """Overrides operate against the caller-supplied `database`, not the
        module-level singleton — needed so callers can run inside a
        transaction of their own."""
        other = DatabaseManager()
        other.sqlite_path = db.sqlite_path
        other.is_postgres = db.is_postgres
        other.db_url = db.db_url

        u = us.create_user(
            email=f"mod-inject-{uuid.uuid4().hex[:12]}@example.com",
            password="pw-strong-123",
            default_role="member",
            database=other,
        )
        ms.set_user_module_override(u.user_id, "admin", True, database=other)
        assert "admin" in ms.get_user_modules(u.user_id, database=other)


# ── list_user_overrides ──────────────────────────────────────────────────────
class TestListUserOverrides:
    def test_raises_even_with_no_overrides(self, user):
        """The `granted` column reference is invalid regardless of whether
        any override row exists — SQLite rejects the query at parse time."""
        with pytest.raises(DatabaseQueryError):
            ms.list_user_overrides(user.user_id)

    def test_raises_against_the_baseline_schema(self, user):
        """Documents current, real behavior: the query selects a `granted`
        column that `auth_user_module_overrides` does not define in this
        package's baseline schema, so any override on the row makes this
        call fail rather than return data. This is a genuine defect, not an
        intentional contract — see the module docstring above."""
        ms.set_user_module_override(user.user_id, "admin", True)
        with pytest.raises(DatabaseQueryError):
            ms.list_user_overrides(user.user_id)


# ── list_role_module_defaults ────────────────────────────────────────────────
class TestListRoleModuleDefaults:
    def test_admin_role_includes_admin_and_health(self):
        defaults = ms.list_role_module_defaults()
        assert "admin" in defaults
        assert {"admin", "health"} <= defaults["admin"]

    def test_member_role_includes_health_but_not_admin(self):
        defaults = ms.list_role_module_defaults()
        assert "member" in defaults
        assert "health" in defaults["member"]
        assert "admin" not in defaults["member"]

    def test_shape_is_role_slug_to_set_of_module_slugs(self):
        defaults = ms.list_role_module_defaults()
        assert isinstance(defaults, dict)
        for slugs in defaults.values():
            assert isinstance(slugs, set)
