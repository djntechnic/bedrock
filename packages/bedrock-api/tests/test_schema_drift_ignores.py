"""
Module:  test_schema_drift_ignores.py
Layer:   bedrock-api/tests
Desc:    Objects an app knows about and deliberately keeps out of its catalog.

         Two real cases motivated this. A DELETE-tripwire table a maintenance
         script installs out of band, which the catalog generator filters on
         purpose; and the scratch tables a long migration creates and drops,
         which linger on any database where that migration did not finish. Both
         reported as drift on every boot, and a warning that can never be
         cleared trains people to stop reading warnings.

         The asymmetry is the part worth pinning: an ignore removes an object
         from `extra` and never from `missing`. "Exists live, uncatalogued on
         purpose" says nothing about an object the catalog expects and the
         database does not have.
"""
from __future__ import annotations

import pytest

from bedrock.core import schema_drift

_clear_ignored = getattr(schema_drift, "__clear_ignored_objects")
_clear_registered = getattr(schema_drift, "__clear_schema_objects")


@pytest.fixture(autouse=True)
def clean_registry():
    _clear_ignored()
    _clear_registered()
    yield
    _clear_ignored()
    _clear_registered()


@pytest.fixture
def live(monkeypatch):
    """Pin the live schema to an explicit set of names."""
    def _set(*names: str):
        monkeypatch.setattr(
            schema_drift, "_fetch_live_names", lambda: set(names)
        )
    return _set


class TestTheRegistry:
    def test_nothing_is_ignored_by_default(self):
        assert schema_drift.registered_ignored_objects() == frozenset()
        assert schema_drift.registered_ignored_prefixes() == ()

    def test_names_round_trip(self):
        schema_drift.register_ignored_objects("_wipe_audit")
        assert schema_drift.registered_ignored_objects() == frozenset({"_wipe_audit"})

    def test_prefixes_round_trip(self):
        schema_drift.register_ignored_objects(prefixes=["mig053_"])
        assert schema_drift.registered_ignored_prefixes() == ("mig053_",)

    def test_the_reader_returns_an_immutable_snapshot(self):
        schema_drift.register_ignored_objects("_wipe_audit")
        assert isinstance(schema_drift.registered_ignored_objects(), frozenset)
        assert isinstance(schema_drift.registered_ignored_prefixes(), tuple)

    def test_registering_twice_overwrites(self):
        """Registration is a module import side effect, so a module imported
        twice must not accumulate."""
        schema_drift.register_ignored_objects("_wipe_audit", prefixes=["mig053_"])
        schema_drift.register_ignored_objects("_wipe_audit", prefixes=["mig053_"])
        assert schema_drift.registered_ignored_objects() == frozenset({"_wipe_audit"})
        assert schema_drift.registered_ignored_prefixes() == ("mig053_",)


class TestTheFilter:
    def test_an_unignored_extra_object_is_still_drift(self, live):
        live("auth_users", "_wipe_audit")
        schema_drift.register_schema_objects("auth_users")
        assert "_wipe_audit" in schema_drift.check_schema_drift().extra

    def test_an_ignored_name_is_dropped_from_extra(self, live):
        live("auth_users", "_wipe_audit")
        schema_drift.register_schema_objects("auth_users")
        schema_drift.register_ignored_objects("_wipe_audit")
        assert "_wipe_audit" not in schema_drift.check_schema_drift().extra

    def test_a_prefix_covers_a_family(self, live):
        live("mig053_set_type_map", "mig053_set_distribution_map")
        schema_drift.register_ignored_objects(prefixes=["mig053_"])
        assert schema_drift.check_schema_drift().extra == frozenset()

    def test_a_prefix_does_not_swallow_unrelated_names(self, live):
        live("mig053_scratch", "mig054_scratch")
        schema_drift.register_ignored_objects(prefixes=["mig053_"])
        assert schema_drift.check_schema_drift().extra == frozenset({"mig054_scratch"})

    def test_ignoring_everything_extra_reports_clean(self, live):
        live("_wipe_audit")
        schema_drift.register_ignored_objects("_wipe_audit")
        assert schema_drift.check_schema_drift().extra == frozenset()

    def test_ignores_do_not_touch_missing(self, live):
        """A catalogued object absent from the database is drift whatever the
        ignore list says — the two halves mean different things."""
        live()
        schema_drift.register_schema_objects("app_thing")
        schema_drift.register_ignored_objects("app_thing")
        assert "app_thing" in schema_drift.check_schema_drift().missing

    def test_an_ignored_object_does_not_have_to_exist(self, live):
        """Registering an ignore for something already dropped is not an error;
        the whole point is that these objects come and go."""
        live("auth_users")
        schema_drift.register_schema_objects("auth_users")
        schema_drift.register_ignored_objects("_wipe_audit", prefixes=["mig053_"])
        assert schema_drift.check_schema_drift().extra == frozenset()


class TestWarnOnDrift:
    def test_ignored_objects_alone_warn_about_nothing(self, live, caplog):
        live(*schema_drift.ALL_OBJECTS, "_wipe_audit")
        schema_drift.register_ignored_objects("_wipe_audit")
        with caplog.at_level("WARNING"):
            report = schema_drift.warn_on_drift()
        assert report.clean
        assert not caplog.records

    def test_the_extra_warning_points_at_both_remedies(self, live, caplog):
        """Regenerating the catalog is the wrong advice for an object the
        generator filters on purpose, so the message has to offer the other."""
        live(*schema_drift.ALL_OBJECTS, "_wipe_audit")
        with caplog.at_level("WARNING"):
            schema_drift.warn_on_drift()
        message = "\n".join(r.getMessage() for r in caplog.records)
        assert "register_ignored_objects" in message
