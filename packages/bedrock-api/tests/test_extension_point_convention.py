"""
Module:  test_extension_point_convention.py
Layer:   bedrock-api/tests
Desc:    Enforces the two extension-point conventions documented in
         `docs/extension_points.md` (plan F0).

         A convention that lives only in a document is a convention until the
         first hurried afternoon. The specific failure this guards against is
         drift in the *reader* verb: the frontend accumulated `resolve*`,
         `get*` and `use*` for the same job before anyone noticed, and the
         backend is one careless `get_counters()` away from the same. So the
         shape is asserted here rather than described somewhere.

         The behavioural half — that the platform works with nothing
         registered — is asserted per-registry in the suites that own them, and
         for providers in test_providers.py. This file is about shape only.
"""
from __future__ import annotations

import importlib

import pytest

#: Every additive registry, as (module, register fn, reader fn, clear fn).
#: Adding a registry means adding a row; that is the point of the file.
REGISTRIES = [
    (
        "bedrock.core.app_config_sections",
        "register_app_config_section",
        "registered_section_names",
        "__clear_app_config_sections",
    ),
    (
        "bedrock.core.health_metrics",
        "register_health_counter",
        "registered_counter_names",
        "__clear_health_counters",
    ),
    (
        "bedrock.core.db_health",
        "register_canonical_tables",
        "registered_canonical_tables",
        "__clear_canonical_tables",
    ),
    (
        "bedrock.core.diagnostics_registry",
        "register_diagnostic_check",
        "registered_check_names",
        "__clear_diagnostic_checks",
    ),
    (
        "bedrock.core.schema_drift",
        "register_schema_objects",
        "registered_schema_objects",
        "__clear_schema_objects",
    ),
    (
        "bedrock.core.schema_drift",
        "register_ignored_objects",
        "registered_ignored_objects",
        "__clear_ignored_objects",
    ),
    (
        "bedrock.core.database",
        "register_current_season_resolver",
        "registered_current_season_resolver",
        "__clear_current_season_resolver",
    ),
    (
        "bedrock.core.sitemap",
        "register_sitemap_source",
        "registered_source_names",
        "__clear_sitemap_sources",
    ),
]

IDS = [f"{module.rsplit('.', 1)[-1]}:{register}" for module, register, *_ in REGISTRIES]

#: Functions whose name starts with `register_` but which are not registries.
#: The scan below is a prefix match, and `register` is a noun as often as a
#: verb — `register_limit()` is the rate limit for the `/auth/register`
#: endpoint. Kept explicit rather than solved with a cleverer heuristic,
#: because the next false positive should be a decision someone makes, not a
#: pattern that silently swallows a real registry.
NOT_REGISTRIES = {
    ("bedrock.core.rate_limit", "register_limit"),
    # Installs the platform's exception handlers onto a FastAPI app. It takes
    # the app rather than an entry to accumulate, so there is nothing to read
    # back and nothing to clear — the registry shape does not apply.
    ("bedrock.core.error_handlers", "register_error_handlers"),
}


@pytest.mark.parametrize("module,register,reader,clear", REGISTRIES, ids=IDS)
class TestRegistryShape:
    """Every additive registry exposes register / reader / clear."""

    def test_register_function_exists(self, module, register, reader, clear):
        assert callable(getattr(importlib.import_module(module), register))

    def test_reader_function_exists(self, module, register, reader, clear):
        """Named for its contents (`registered_*`), not `get_*`."""
        assert callable(getattr(importlib.import_module(module), reader))

    def test_clear_helper_exists(self, module, register, reader, clear):
        """Without this a test cannot undo a registration another test made."""
        assert callable(getattr(importlib.import_module(module), clear))

    def test_reader_returns_an_immutable_snapshot(
        self, module, register, reader, clear
    ):
        """Handing out the live container lets a caller mutate the registry."""
        value = getattr(importlib.import_module(module), reader)()
        assert isinstance(value, (tuple, frozenset)), (
            f"{module}.{reader}() returned {type(value).__name__}; readers "
            f"return a tuple or frozenset so callers cannot mutate the registry"
        )

    def test_register_is_annotated(self, module, register, reader, clear):
        """An unannotated extension point is undocumented at the call site."""
        fn = getattr(importlib.import_module(module), register)
        annotated = getattr(fn, "__annotations__", {})
        code = fn.__code__
        params = code.co_varnames[: code.co_argcount + code.co_kwonlyargcount]
        missing = [p for p in params if p not in annotated]
        assert not missing, f"{module}.{register} params unannotated: {missing}"


class TestConventionsAreDistinct:
    """The two kinds must not be confused for one another."""

    def test_providers_are_not_a_registry_module(self):
        """`providers` is the provider machinery, not an eighth registry.

        If someone adds `register_provider` at module scope it means the two
        kinds have been collapsed, and the "exactly one wins" guarantee is
        gone.
        """
        import bedrock.core.providers as providers

        module_level_registers = [
            name
            for name in dir(providers)
            if name.startswith("register_") and callable(getattr(providers, name))
        ]
        assert module_level_registers == []

    def test_every_registry_is_listed_here(self):
        """A new registry that skips this file skips the convention.

        Walks `bedrock.core` for `register_*` functions and requires each to
        appear in REGISTRIES above.
        """
        import pkgutil

        import bedrock.core

        listed = {(module, register) for module, register, _, _ in REGISTRIES}
        found: set[tuple[str, str]] = set()
        for info in pkgutil.iter_modules(bedrock.core.__path__):
            name = f"bedrock.core.{info.name}"
            mod = importlib.import_module(name)
            for attr in dir(mod):
                if not attr.startswith("register_"):
                    continue
                fn = getattr(mod, attr)
                # Only functions defined here, not ones imported from a sibling.
                if callable(fn) and getattr(fn, "__module__", None) == name:
                    found.add((name, attr))
        unlisted = found - listed - NOT_REGISTRIES
        assert not unlisted, (
            f"registries missing from REGISTRIES in this file: {sorted(unlisted)}. "
            f"Add a row, and a table row in docs/extension_points.md."
        )
