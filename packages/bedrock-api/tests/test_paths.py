"""
Module:  test_paths.py
Layer:   bedrock-api/tests
Desc:    The application root must come from the application.

         Every path constant in bedrock was written when this code lived in
         MLBTracker's `api/core/`, where three directories up from `__file__`
         happened to be the repo root. Installed as a package that expression
         resolves into site-packages: the `.env` is never found, the SQLite
         file is created in the wrong place, and the migration runner looks
         for the app's schema history inside the library.

         Nothing about that failure is loud — it produces an app that boots
         against an empty database in a directory nobody looks at. These tests
         are the guard, so they assert the negative directly: no bedrock path
         may be derived from the package's own location.
"""
from __future__ import annotations

import ast
import importlib
import os
import pathlib

import pytest

PACKAGE_DIR = pathlib.Path(__file__).resolve().parents[1] / "bedrock"


def _reload(monkeypatch, app_root: str, **env: str):
    """Re-import the path-dependent modules with a fresh environment.

    :param app_root: Value for BEDROCK_APP_ROOT.
    :param env: Additional environment variables to set (or clear, if empty).
    :returns: (paths, config, migrations) module objects.
    """
    monkeypatch.setenv("BEDROCK_APP_ROOT", app_root)
    for key in ("BEDROCK_DATA_DIR", "SQLITE_DB_PATH", "BEDROCK_MIGRATIONS_DIR"):
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)

    import bedrock.core.paths as paths
    import bedrock.core.config as config

    paths = importlib.reload(paths)
    config = importlib.reload(config)
    return paths, config


@pytest.fixture(autouse=True)
def _restore_modules():
    """Leave the real modules loaded for every other test in the session."""
    yield
    import bedrock.core.config
    import bedrock.core.migrations
    import bedrock.core.paths

    importlib.reload(bedrock.core.paths)
    importlib.reload(bedrock.core.config)
    importlib.reload(bedrock.core.migrations)


class TestAppRoot:
    def test_env_var_wins(self, monkeypatch, tmp_path):
        paths, _ = _reload(monkeypatch, str(tmp_path))
        assert paths.APP_ROOT == str(tmp_path)

    def test_defaults_to_cwd(self, monkeypatch, tmp_path):
        monkeypatch.delenv("BEDROCK_APP_ROOT", raising=False)
        monkeypatch.chdir(tmp_path)
        import bedrock.core.paths as paths

        paths = importlib.reload(paths)
        assert paths.APP_ROOT == os.path.realpath(str(tmp_path)) or \
            paths.APP_ROOT == str(tmp_path)

    def test_never_resolves_into_the_package(self, monkeypatch, tmp_path):
        """The regression this module exists for."""
        paths, config = _reload(monkeypatch, str(tmp_path))
        for value in (paths.APP_ROOT, config.config.PROJECT_ROOT,
                      config.config.DATA_DIR, config.config.SQLITE_DB_PATH,
                      config.config.CACHE_DIR):
            assert PACKAGE_DIR not in pathlib.Path(value).parents, \
                f"{value} resolves inside the installed package"

    def test_relative_configured_path_is_app_relative(self, monkeypatch, tmp_path):
        """A relative path in .env must not depend on the working directory."""
        paths, _ = _reload(monkeypatch, str(tmp_path))
        monkeypatch.chdir(pathlib.Path(__file__).parent)
        assert paths.resolve_app_path("data/app.db") == \
            os.path.join(str(tmp_path), "data/app.db")

    def test_absolute_configured_path_is_left_alone(self, monkeypatch, tmp_path):
        paths, _ = _reload(monkeypatch, str(tmp_path))
        absolute = os.path.join(os.sep, "srv", "db", "app.db")
        assert paths.resolve_app_path(absolute) == absolute


class TestSqlitePath:
    def test_defaults_under_the_app_data_dir(self, monkeypatch, tmp_path):
        _, config = _reload(monkeypatch, str(tmp_path))
        assert config.config.SQLITE_DB_PATH == \
            os.path.join(str(tmp_path), "data", "app.db")

    def test_env_override_is_honoured(self, monkeypatch, tmp_path):
        _, config = _reload(monkeypatch, str(tmp_path),
                            SQLITE_DB_PATH="data/app.db")
        assert config.config.SQLITE_DB_PATH == \
            os.path.join(str(tmp_path), "data/app.db")

    def test_data_dir_override_moves_the_default(self, monkeypatch, tmp_path):
        _, config = _reload(monkeypatch, str(tmp_path),
                            BEDROCK_DATA_DIR="var/state")
        assert config.config.DATA_DIR == os.path.join(str(tmp_path), "var/state")
        assert config.config.SQLITE_DB_PATH == \
            os.path.join(str(tmp_path), "var/state", "app.db")

    def test_database_url_wins_over_the_sqlite_path(self, monkeypatch, tmp_path):
        monkeypatch.setenv("DATABASE_URL", "postgresql://host/db")
        _, config = _reload(monkeypatch, str(tmp_path))
        assert config.config.get_db_path() == "postgresql://host/db"
        monkeypatch.delenv("DATABASE_URL", raising=False)


class TestMigrationsDir:
    def test_defaults_to_app_root_migrations(self, monkeypatch, tmp_path):
        _reload(monkeypatch, str(tmp_path))
        import bedrock.core.migrations as migrations

        migrations = importlib.reload(migrations)
        assert migrations.MIGRATIONS_DIR == \
            os.path.join(str(tmp_path), "migrations")

    def test_env_override_is_honoured(self, monkeypatch, tmp_path):
        _reload(monkeypatch, str(tmp_path),
                BEDROCK_MIGRATIONS_DIR="api/core/migrations")
        import bedrock.core.migrations as migrations

        migrations = importlib.reload(migrations)
        assert migrations.MIGRATIONS_DIR == \
            os.path.join(str(tmp_path), "api/core/migrations")

    def test_missing_directory_yields_no_files(self, monkeypatch, tmp_path):
        """An app with no on-disk migrations is valid, not an error."""
        _reload(monkeypatch, str(tmp_path))
        import bedrock.core.migrations as migrations

        migrations = importlib.reload(migrations)
        assert migrations._discover_sql_files() == []


def _code_strings(path: pathlib.Path) -> list[tuple[int, str]]:
    """Every string literal in `path` that is not a docstring.

    Prose is allowed to name the application bedrock was extracted from —
    saying "MLBTracker supplies the `sync` category" is the clearest way to
    explain an extension point. A *value* is a different thing: a default of
    `mlbtracker.db` is a working default for exactly one app and a silent
    misconfiguration for every other.

    Comments never reach the AST, so they are excluded for free.
    """
    tree = ast.parse(path.read_text(encoding="utf-8"))
    docstrings = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef,
                             ast.AsyncFunctionDef)):
            body = getattr(node, "body", None)
            if (body and isinstance(body[0], ast.Expr)
                    and isinstance(body[0].value, ast.Constant)
                    and isinstance(body[0].value.value, str)):
                docstrings.add(id(body[0].value))
    return [
        (node.lineno, node.value)
        for node in ast.walk(tree)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
        and id(node) not in docstrings
    ]


class TestPackageIsDomainFree:
    """Content, not imports.

    The package's file list is a computed import closure, which is why no
    platform module can import a baseball module without failing the build.
    A hardcoded application name is invisible to that check by construction —
    it is a value, not an edge — so it needs its own guard.
    """

    @pytest.mark.parametrize("needle", ["mlbtracker", "statsapi.mlb.com",
                                        "MLBTRACKER_"])
    def test_no_application_identifiers_in_values(self, needle):
        offenders = []
        for path in sorted(PACKAGE_DIR.rglob("*.py")):
            for lineno, value in _code_strings(path):
                if needle.lower() in value.lower():
                    offenders.append(
                        f"{path.relative_to(PACKAGE_DIR)}:{lineno}: {value!r}")
        assert not offenders, "\n".join(offenders)


@pytest.fixture(autouse=True)
def isolated_schema_objects():
    """Save, clear and restore the app-object registration around each test.

    `__clear_schema_objects` is name-mangled if referenced from inside a class
    body, so the reset lives here — the same shape db_health's canonical-table
    hook is driven with.
    """
    from bedrock.core import schema_drift

    saved = schema_drift.registered_schema_objects()
    schema_drift.__clear_schema_objects()
    yield
    schema_drift.register_schema_objects(*saved)


class TestSchemaDriftIsComposable:
    """The drift check must span both halves of the schema.

    `check_schema_drift()` originally diffed the live database against the
    platform catalog alone. That was correct while the platform *was* the
    application. Once an app owns tables of its own, the same code reports
    every one of them as an unexpected object — turning a signal into a wall
    of noise nobody reads, which is worse than having no check.
    """

    def test_platform_objects_are_expected_with_nothing_registered(self):
        from bedrock.core.schema_catalog import ALL_OBJECTS
        from bedrock.core.schema_drift import expected_objects

        assert expected_objects() == frozenset(ALL_OBJECTS)

    def test_registered_app_objects_join_the_expected_set(self):
        from bedrock.core.schema_catalog import ALL_OBJECTS
        from bedrock.core.schema_drift import (expected_objects,
                                               register_schema_objects)

        register_schema_objects("players", "teams", "v_players_visible")
        assert expected_objects() == frozenset(ALL_OBJECTS) | {
            "players", "teams", "v_players_visible"}

    def test_registered_objects_are_not_reported_as_drift(self, monkeypatch):
        from bedrock.core import schema_drift

        monkeypatch.setattr(schema_drift, "_fetch_live_names",
                            lambda: set(schema_drift.ALL_OBJECTS) | {"players"})

        assert "players" in schema_drift.check_schema_drift().extra
        schema_drift.register_schema_objects("players")
        assert schema_drift.check_schema_drift().clean
