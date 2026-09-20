"""Unit tests for the S005-S008 platform audit CLI tools."""
import subprocess
from pathlib import Path

from bedrock.tools import (
    s005_audit_testing,
    s006_audit_pr_workflow,
    s007_audit_schema_catalog,
    s008_audit_guidance,
)


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _write_toml(tmp_path: Path, section: str = "") -> None:
    _write(tmp_path / "bedrock.toml", f"[tool.bedrock]\n{section}")


# ---------------------------------------------------------------------------
# s005_audit_testing
# ---------------------------------------------------------------------------


def test_s005_returns_zero_when_route_has_paired_test(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s005]\nexemptions = []\n")
    _write(tmp_path / "bedrock" / "routes" / "health.py", "def get_health(): ...\n")
    _write(tmp_path / "tests" / "test_health.py", "def test_get_health(): ...\n")

    assert s005_audit_testing.main(["--root", str(tmp_path)]) == 0


def test_s005_returns_one_on_missing_paired_test(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s005]\nexemptions = []\n")
    _write(tmp_path / "bedrock" / "routes" / "health.py", "def get_health(): ...\n")

    assert s005_audit_testing.main(["--root", str(tmp_path)]) == 1


def test_s005_returns_zero_when_missing_pairing_is_exempted(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s005]\nexemptions = ["bedrock/routes/health.py"]\n',
    )
    _write(tmp_path / "bedrock" / "routes" / "health.py", "def get_health(): ...\n")

    assert s005_audit_testing.main(["--root", str(tmp_path)]) == 0


def test_s005_returns_one_on_unexempted_skip_decorator(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s005]\nexemptions = []\n")
    _write(
        tmp_path / "tests" / "test_health.py",
        "import pytest\n\n@pytest.mark.skip(reason='flaky')\ndef test_get_health(): ...\n",
    )

    assert s005_audit_testing.main(["--root", str(tmp_path)]) == 1


def test_s005_returns_one_on_live_db_reference_without_conftest(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s005]\nexemptions = []\n")
    _write(
        tmp_path / "tests" / "test_health.py",
        "def test_uses_live_db():\n    connect('bedrock.db')\n",
    )

    assert s005_audit_testing.main(["--root", str(tmp_path)]) == 1


def test_s005_returns_zero_for_live_db_reference_with_conftest(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s005]\nexemptions = []\n")
    _write(tmp_path / "tests" / "conftest.py", "# isolated test db fixture\n")
    _write(
        tmp_path / "tests" / "test_health.py",
        "def test_uses_live_db():\n    connect('bedrock.db')\n",
    )

    assert s005_audit_testing.main(["--root", str(tmp_path)]) == 0


def test_s005_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert s005_audit_testing.main(["--root", str(tmp_path)]) == 2


def test_s005_ignores_venv_and_site_packages(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s005]\nexemptions = []\n")
    # Synthetic route under .venv/site-packages should not trigger missing paired test
    _write(
        tmp_path / ".venv" / "lib" / "site-packages" / "routes" / "third_party.py",
        "def get(): ...\n",
    )
    # Synthetic test with skip under .venv should not trigger unexempted skip
    _write(
        tmp_path / ".venv" / "lib" / "site-packages" / "tests" / "test_pkg.py",
        "import pytest\n@pytest.mark.skip(reason='dep')\ndef test_pkg(): ...\n",
    )
    # Synthetic test with live db name under node_modules or .venv should not trigger live db violation
    _write(
        tmp_path / ".venv" / "lib" / "site-packages" / "tests" / "test_db.py",
        "def test_db(): connect('app.db')\n",
    )

    assert s005_audit_testing.main(["--root", str(tmp_path)]) == 0


# ---------------------------------------------------------------------------
# s006_audit_pr_workflow
# ---------------------------------------------------------------------------


def test_s006_returns_zero_when_ledger_is_well_formed(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s006]\nledger_files = ["docs/ledger.md"]\nexemptions = []\n',
    )
    _write(tmp_path / "docs" / "ledger.md", "# Out-of-Scope Ledger\n\n- nothing yet\n")

    assert s006_audit_pr_workflow.main(["--root", str(tmp_path)]) == 0


def test_s006_returns_one_when_ledger_file_missing(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s006]\nledger_files = ["docs/ledger.md"]\nexemptions = []\n',
    )

    assert s006_audit_pr_workflow.main(["--root", str(tmp_path)]) == 1


def test_s006_returns_one_when_ledger_missing_markdown_header(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s006]\nledger_files = ["docs/ledger.md"]\nexemptions = []\n',
    )
    _write(tmp_path / "docs" / "ledger.md", "just some text, no header\n")

    assert s006_audit_pr_workflow.main(["--root", str(tmp_path)]) == 1


def test_s006_returns_zero_when_missing_ledger_is_exempted(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s006]\nledger_files = ["docs/ledger.md"]\n'
        'exemptions = ["docs/ledger.md"]\n',
    )

    assert s006_audit_pr_workflow.main(["--root", str(tmp_path)]) == 0


def test_s006_returns_one_on_dirty_working_tree(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s006]\nledger_files = []\nexemptions = []\n")
    subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True, check=True)
    _write(tmp_path / "untracked.txt", "dirty\n")

    assert s006_audit_pr_workflow.main(["--root", str(tmp_path)]) == 1


def test_s006_returns_zero_when_not_a_git_repository(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s006]\nledger_files = []\nexemptions = []\n")

    assert s006_audit_pr_workflow.main(["--root", str(tmp_path)]) == 0


def test_s006_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert s006_audit_pr_workflow.main(["--root", str(tmp_path)]) == 2


# ---------------------------------------------------------------------------
# s007_audit_schema_catalog
# ---------------------------------------------------------------------------


_AUDIT_COLUMNS_SQL = (
    "created_at TEXT, created_by TEXT, modified_at TEXT, modified_by TEXT, "
    "is_active INTEGER"
)


def test_s007_returns_zero_for_compliant_table(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s007]\nexemptions = []\n")
    _write(
        tmp_path / "schema" / "baseline.sql",
        f"CREATE TABLE app_config_settings (id INTEGER PRIMARY KEY, {_AUDIT_COLUMNS_SQL});\n",
    )

    assert s007_audit_schema_catalog.main(["--root", str(tmp_path)]) == 0


def test_s007_returns_one_on_bad_table_prefix(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s007]\nexemptions = []\n")
    _write(
        tmp_path / "schema" / "baseline.sql",
        f"CREATE TABLE settings (id INTEGER PRIMARY KEY, {_AUDIT_COLUMNS_SQL});\n",
    )

    assert s007_audit_schema_catalog.main(["--root", str(tmp_path)]) == 1


def test_s007_returns_one_on_missing_audit_columns(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s007]\nexemptions = []\n")
    _write(
        tmp_path / "schema" / "baseline.sql",
        "CREATE TABLE app_config_settings (id INTEGER PRIMARY KEY, value TEXT);\n",
    )

    assert s007_audit_schema_catalog.main(["--root", str(tmp_path)]) == 1


def test_s007_returns_zero_for_grandfathered_table(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s007]\ngrandfathered_tables = ["settings"]\nexemptions = []\n',
    )
    _write(
        tmp_path / "schema" / "baseline.sql",
        "CREATE TABLE settings (id INTEGER PRIMARY KEY, value TEXT);\n",
    )

    assert s007_audit_schema_catalog.main(["--root", str(tmp_path)]) == 0


def test_s007_returns_zero_for_declared_domain_prefix(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s007]\ndomain_prefixes = ["collectit"]\nexemptions = []\n',
    )
    _write(
        tmp_path / "schema" / "baseline.sql",
        f"CREATE TABLE collectit_cards (id INTEGER PRIMARY KEY, {_AUDIT_COLUMNS_SQL});\n",
    )

    assert s007_audit_schema_catalog.main(["--root", str(tmp_path)]) == 0


def test_s007_returns_one_on_bare_table_literal_outside_catalog(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s007]\nexemptions = []\n")
    _write(
        tmp_path / "services" / "settings.py",
        "def get_setting(db, key):\n"
        "    return db.query(\"SELECT value FROM app_config_settings WHERE key = ?\", key)\n",
    )

    assert s007_audit_schema_catalog.main(["--root", str(tmp_path)]) == 1


def test_s007_returns_zero_when_catalog_symbol_used(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s007]\nexemptions = []\n")
    _write(
        tmp_path / "services" / "settings.py",
        "from bedrock.core.schema_catalog import Tables\n\n"
        "def get_setting(db, key):\n"
        "    return db.query(f\"SELECT value FROM {Tables.APP_CONFIG_SETTINGS} WHERE key = ?\", key)\n",
    )

    assert s007_audit_schema_catalog.main(["--root", str(tmp_path)]) == 0


def test_s007_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert s007_audit_schema_catalog.main(["--root", str(tmp_path)]) == 2


# ---------------------------------------------------------------------------
# s008_audit_guidance
# ---------------------------------------------------------------------------


def test_s008_returns_zero_for_compliant_docs_layout(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _write(tmp_path / "CLAUDE.md", "\n".join(f"line {i}" for i in range(50)))
    _write(tmp_path / "docs" / "standards" / "s001-example.md", "# S001\n")
    _write(tmp_path / "docs" / "README.md", "# Docs Index\n")

    assert s008_audit_guidance.main(["--root", str(tmp_path)]) == 0


def test_s008_returns_one_when_guidance_doc_exceeds_max_lines(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nmax_lines = 10\nexemptions = []\n")
    _write(tmp_path / "CLAUDE.md", "\n".join(f"line {i}" for i in range(20)))

    assert s008_audit_guidance.main(["--root", str(tmp_path)]) == 1


def test_s008_returns_one_on_deprecated_punchlists_directory(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _write(tmp_path / "docs" / "punchlists" / "old.md", "# Old Punchlist\n")

    assert s008_audit_guidance.main(["--root", str(tmp_path)]) == 1


def test_s008_returns_one_on_non_kebab_case_filename(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _write(tmp_path / "docs" / "standards" / "S001_Example.md", "# S001\n")

    assert s008_audit_guidance.main(["--root", str(tmp_path)]) == 1


def test_s008_returns_zero_for_declared_allowed_root_doc(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s008]\nallowed_root_docs = ["platform-guide.md"]\nexemptions = []\n',
    )
    _write(tmp_path / "docs" / "platform-guide.md", "# Platform Guide\n")

    assert s008_audit_guidance.main(["--root", str(tmp_path)]) == 0


def test_s008_returns_one_on_undeclared_root_doc(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _write(tmp_path / "docs" / "platform-guide.md", "# Platform Guide\n")

    assert s008_audit_guidance.main(["--root", str(tmp_path)]) == 1


def test_s008_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert s008_audit_guidance.main(["--root", str(tmp_path)]) == 2
