"""
Module:  test_providers.py
Layer:   bedrock-api/tests
Desc:    Contract tests for the provider extension point (plan F0).

         The behaviours worth pinning here are the failure modes, not the happy
         path. A provider registry is the thing three later capabilities (mail,
         media storage, error reporting) will be built on, and each of them is
         reached from a request path where the wrong answer to "what happens
         when this is misconfigured?" means a 500 on an unrelated page.

         Nothing here touches a real backend: the implementations are strings
         and counters, which is the point — the registry must be testable
         without any of the things it will eventually hand out.
"""
from __future__ import annotations

import threading

import pytest

from bedrock.core.providers import NULL_PROVIDER, ProviderRegistry


@pytest.fixture
def registry(monkeypatch):
    """A registry whose config key is backed by a dict rather than a database.

    Patching `db.get_config` keeps these tests independent of the schema and
    lets a case flip the active provider mid-test, which is exactly what the
    admin UI does.
    """
    from bedrock.core import database

    settings: dict[str, object] = {}

    def fake_get_config(key, default=None):
        return settings.get(key, default)

    monkeypatch.setattr(database.db, "get_config", fake_get_config)

    reg = ProviderRegistry[str](
        capability="greeting",
        config_key="greeting_provider",
        fallback=lambda: "null-greeting",
    )
    reg.settings = settings  # type: ignore[attr-defined]
    return reg


@pytest.fixture
def warnings():
    """Captured WARNING-and-above messages.

    Not `caplog`: the platform logs through loguru, which does not propagate to
    the stdlib `logging` tree pytest captures, so a `caplog` assertion here
    passes against zero records whatever the code does. A sink is the only
    honest way to assert on a loguru message.
    """
    from loguru import logger

    messages: list[str] = []
    sink_id = logger.add(lambda m: messages.append(m.record["message"]), level="WARNING")
    yield messages
    logger.remove(sink_id)


class TestUnconfigured:
    """An app that registers nothing must still work."""

    def test_active_returns_the_fallback(self, registry):
        assert registry.active() == "null-greeting"

    def test_active_name_is_null(self, registry):
        assert registry.active_name() == NULL_PROVIDER

    def test_is_configured_is_false(self, registry):
        assert registry.is_configured() is False

    def test_null_is_always_registered(self, registry):
        assert registry.registered_names() == (NULL_PROVIDER,)

    def test_registering_without_selecting_changes_nothing(self, registry):
        """Registration alone must not activate — config selects the winner."""
        registry.register("loud", lambda: "HELLO")
        assert registry.active() == "null-greeting"
        assert registry.is_configured() is False


class TestSelection:
    def test_configured_provider_wins(self, registry):
        registry.register("loud", lambda: "HELLO")
        registry.settings["greeting_provider"] = "loud"
        assert registry.active() == "HELLO"
        assert registry.is_configured() is True

    def test_selection_is_reread_not_frozen(self, registry):
        """Flipping the setting takes effect without a restart."""
        registry.register("loud", lambda: "HELLO")
        registry.register("soft", lambda: "hello")
        registry.settings["greeting_provider"] = "loud"
        assert registry.active() == "HELLO"
        registry.settings["greeting_provider"] = "soft"
        assert registry.active() == "hello"

    def test_explicit_default_is_used_when_key_is_unset(self, monkeypatch):
        from bedrock.core import database

        monkeypatch.setattr(
            database.db, "get_config", lambda key, default=None: default
        )
        reg = ProviderRegistry[str](
            capability="greeting",
            config_key="greeting_provider",
            fallback=lambda: "null-greeting",
            default="loud",
        )
        reg.register("loud", lambda: "HELLO")
        assert reg.active() == "HELLO"

    @pytest.mark.parametrize("blank", ["", "   ", None])
    def test_blank_config_falls_back_to_default(self, registry, blank):
        """An empty string in the settings table means "unset", not a name."""
        registry.register("loud", lambda: "HELLO")
        registry.settings["greeting_provider"] = blank
        assert registry.active_name() == NULL_PROVIDER

    def test_name_is_stripped(self, registry):
        registry.register("loud", lambda: "HELLO")
        registry.settings["greeting_provider"] = "  loud  "
        assert registry.active() == "HELLO"


class TestMisconfiguration:
    """Config is admin-editable, so any string can arrive at runtime."""

    def test_unknown_name_degrades_instead_of_raising(self, registry):
        registry.settings["greeting_provider"] = "typo"
        assert registry.active() == "null-greeting"
        assert registry.is_configured() is False

    def test_unknown_name_warns_once(self, registry, warnings):
        """A bad name on a hot path must not write a log line per request."""
        registry.settings["greeting_provider"] = "typo"
        for _ in range(5):
            registry.active()
        assert sum("typo" in m for m in warnings) == 1

    def test_the_warning_names_the_key_and_the_known_providers(
        self, registry, warnings
    ):
        """The message has to be actionable without reading the source."""
        registry.register("loud", lambda: "HELLO")
        registry.settings["greeting_provider"] = "typo"
        registry.active()
        assert len(warnings) == 1
        assert "greeting_provider" in warnings[0]
        assert "loud" in warnings[0]

    def test_registering_the_missing_name_later_recovers(self, registry):
        """Warn state must not pin the fallback once the name shows up."""
        registry.settings["greeting_provider"] = "loud"
        assert registry.active() == "null-greeting"
        registry.register("loud", lambda: "HELLO")
        assert registry.active() == "HELLO"

    def test_unreadable_config_falls_back(self, registry, monkeypatch):
        """A provider reached before the pool is up behaves as if unset."""
        from bedrock.core import database

        def boom(key, default=None):
            raise RuntimeError("no database yet")

        monkeypatch.setattr(database.db, "get_config", boom)
        assert registry.active() == "null-greeting"


class TestFactoryFailure:
    def test_raising_factory_falls_back(self, registry):
        def broken():
            raise RuntimeError("bad credentials")

        registry.register("broken", broken)
        registry.settings["greeting_provider"] = "broken"
        assert registry.active() == "null-greeting"

    def test_raising_factory_is_retried(self, registry):
        """A transient failure must not cache "mail is off" for the process."""
        attempts = {"n": 0}

        def flaky():
            attempts["n"] += 1
            if attempts["n"] == 1:
                raise RuntimeError("transient")
            return "HELLO"

        registry.register("flaky", flaky)
        registry.settings["greeting_provider"] = "flaky"
        assert registry.active() == "null-greeting"
        assert registry.active() == "HELLO"

    def test_broken_null_override_raises(self, registry):
        """The no-op is contractually not allowed to fail; say so loudly."""

        def broken():
            raise RuntimeError("nope")

        registry.register(NULL_PROVIDER, broken)
        with pytest.raises(RuntimeError, match="must never raise"):
            registry.active()


class TestInstantiation:
    def test_factory_runs_once(self, registry):
        calls = {"n": 0}

        def counted():
            calls["n"] += 1
            return "HELLO"

        registry.register("loud", counted)
        registry.settings["greeting_provider"] = "loud"
        for _ in range(3):
            registry.active()
        assert calls["n"] == 1

    def test_factory_is_not_called_at_registration(self, registry):
        """Lazy construction is what keeps registration order irrelevant."""
        calls = {"n": 0}

        def counted():
            calls["n"] += 1
            return "HELLO"

        registry.register("loud", counted)
        assert calls["n"] == 0

    def test_reregistering_drops_the_cached_instance(self, registry):
        registry.register("loud", lambda: "first")
        registry.settings["greeting_provider"] = "loud"
        assert registry.active() == "first"
        registry.register("loud", lambda: "second")
        assert registry.active() == "second"

    def test_concurrent_callers_share_one_instance(self, registry):
        """Two threads racing first use must not each build a backend."""
        built: list[object] = []
        start = threading.Barrier(8)

        def slow():
            obj = object()
            built.append(obj)
            return obj

        registry.register("slow", slow)
        registry.settings["greeting_provider"] = "slow"

        seen: list[object] = []

        def worker():
            start.wait()
            seen.append(registry.active())

        threads = [threading.Thread(target=worker) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len({id(o) for o in seen}) == 1


class TestResetForTests:
    def test_reset_drops_registrations_but_keeps_null(self, registry):
        registry.register("loud", lambda: "HELLO")
        registry.reset_for_tests()
        assert registry.registered_names() == (NULL_PROVIDER,)
        assert registry.active() == "null-greeting"

    def test_reset_clears_warn_state(self, registry, warnings):
        registry.settings["greeting_provider"] = "typo"
        registry.active()
        assert len(warnings) == 1
        registry.reset_for_tests()
        registry.active()
        assert len(warnings) == 2
