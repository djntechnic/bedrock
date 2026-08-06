"""
Module:  test_admin_config_service.py
Layer:   api/tests
Desc:    Phase 5.c service-level tests for admin_service.py's config CRUD.
         These run against the in-memory SQLite fixture with no FastAPI —
         same fast-feedback pattern established in Phase 5.a's
         test_inventory_set_service.py.
"""
import pytest

from bedrock.core.database import db
from bedrock.services.admin_service import (
    AdminConflictError,
    AdminNotFoundError,
    AdminValidationError,
    create_config_setting_service,
    delete_config_setting_service,
    list_config_settings_service,
    update_config_setting_service,
)


def _random_key(prefix: str) -> str:
    """Generate a fresh key so tests don't collide with fixture-seeded rows.

    Uses a canonical category prefix (`system_`) so the key satisfies the
    validation rule in admin_service._validate_config_shape.
    """
    import uuid
    return f"system_{prefix}_{uuid.uuid4().hex[:8]}"


# ── list_config_settings_service ──────────────────────────────────────────────

@pytest.mark.integration
def test_list_config_settings_service_returns_all_when_no_category():
    # MLBTracker leaned on its seed fixture for this. Bedrock's database is
    # empty by design, so the test creates the row it asserts on — which makes
    # it self-contained rather than dependent on someone else's data.
    create_config_setting_service(
        key="system_list_probe", value="1", value_type="integer",
        description="probe", category="system",
    )
    rows = list_config_settings_service()
    assert isinstance(rows, list)
    assert len(rows) > 0
    assert {"key", "value", "value_type", "description", "category", "modified_at"}.issubset(rows[0].keys())


@pytest.mark.integration
def test_list_config_settings_service_filters_by_category():
    all_rows = list_config_settings_service()
    if not all_rows:
        pytest.skip("no config rows in fixture to filter against")
    target_category = all_rows[0]["category"]
    filtered = list_config_settings_service(category=target_category)
    assert filtered, "expected at least one row for the seeded category"
    assert all(r["category"] == target_category for r in filtered)


# ── create_config_setting_service ─────────────────────────────────────────────

@pytest.mark.integration
def test_create_config_setting_service_inserts_and_emits_activity():
    key = _random_key("phase5c_create")
    result = create_config_setting_service(
        key=key,
        value="hello",
        value_type="string",
        description="Phase 5.c test key",
        category="system",
    )
    assert result == {"message": f"Created {key}"}

    df = db.query(
        "SELECT key, value, category FROM app_config_settings WHERE key = :key",
        params={"key": key},
    )
    assert not df.empty
    assert df.iloc[0]["value"] == "hello"
    assert df.iloc[0]["category"] == "system"

    # Cleanup
    delete_config_setting_service(key=key)


@pytest.mark.integration
def test_create_config_setting_service_raises_conflict_on_duplicate_key():
    key = _random_key("phase5c_dup")
    create_config_setting_service(
        key=key, value="v1", value_type="string", description=None, category="system",
    )
    with pytest.raises(AdminConflictError, match="already exists"):
        create_config_setting_service(
            key=key, value="v2", value_type="string", description=None, category="system",
        )
    # Cleanup
    delete_config_setting_service(key=key)


@pytest.mark.integration
def test_create_config_setting_service_trims_key_and_stringifies_value():
    key = _random_key("phase5c_trim")
    create_config_setting_service(
        key=f"  {key}  ",
        value=42,  # int should coerce to "42"
        value_type="integer",
        description=None,
        category="system",
    )

    df = db.query(
        "SELECT value FROM app_config_settings WHERE key = :key",
        params={"key": key},
    )
    assert df.iloc[0]["value"] == "42"
    delete_config_setting_service(key=key)


# ── update_config_setting_service ─────────────────────────────────────────────

@pytest.mark.integration
def test_update_config_setting_service_updates_whitelisted_fields():
    key = _random_key("phase5c_update")
    create_config_setting_service(
        key=key, value="old", value_type="string", description=None, category="system",
    )
    result = update_config_setting_service(
        key=key,
        body={"value": "new", "description": "updated", "not_a_field": "ignored"},
    )
    assert result["message"] == f"Updated {key}"

    df = db.query(
        "SELECT value, description FROM app_config_settings WHERE key = :key",
        params={"key": key},
    )
    assert df.iloc[0]["value"] == "new"
    assert df.iloc[0]["description"] == "updated"

    delete_config_setting_service(key=key)


# Note: renaming via body["key"] is not exercised here — the underlying
# route has always had a pre-existing bug where `params = {**updates, "key": key, ...}`
# overwrites the new-key bind with the path key, making the SQL UPDATE a
# no-op for renames. Preserving the bug behavior here would be misleading;
# fixing it belongs in its own §S6 out-of-scope defect PR.


def test_update_config_setting_service_rejects_empty_updates():
    with pytest.raises(AdminValidationError, match="No updatable fields"):
        update_config_setting_service(key="anything", body={"not_a_field": "x"})


@pytest.mark.integration
def test_update_config_setting_service_raises_notfound_on_missing_key():
    with pytest.raises(AdminNotFoundError, match="not found"):
        update_config_setting_service(
            key="__does_not_exist__", body={"value": "x"},
        )


# ── delete_config_setting_service ─────────────────────────────────────────────

@pytest.mark.integration
def test_delete_config_setting_service_removes_row():
    key = _random_key("phase5c_delete")
    create_config_setting_service(
        key=key, value="v", value_type="string", description=None, category="system",
    )
    result = delete_config_setting_service(key=key)
    assert result == {"message": f"Deleted {key}"}

    df = db.query(
        "SELECT COUNT(*) AS cnt FROM app_config_settings WHERE key = :key",
        params={"key": key},
    )
    assert int(df.iloc[0]["cnt"]) == 0


@pytest.mark.integration
def test_delete_config_setting_service_raises_notfound_on_missing_key():
    with pytest.raises(AdminNotFoundError, match="not found"):
        delete_config_setting_service(key="__does_not_exist__")


# ── _sanitize (indirect via list_config_settings_service) ────────────────────

def test_sanitize_replaces_nan_and_inf_with_none():
    from bedrock.services.admin_service import _sanitize
    rows = [{"a": float("nan"), "b": float("inf"), "c": 1.5, "d": "keep"}]
    out = _sanitize(rows)
    assert out == [{"a": None, "b": None, "c": 1.5, "d": "keep"}]
