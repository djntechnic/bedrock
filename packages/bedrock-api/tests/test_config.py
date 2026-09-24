"""Unit tests for the declarative manifest engine (bedrock.tools._config)."""
from pathlib import Path

import pytest

from bedrock.tools._config import (
    DEFAULT_IGNORED_DIRS,
    BedrockConfig,
    load_bedrock_config,
)


def _write_toml(tmp_path: Path, content: str) -> Path:
    toml_path = tmp_path / "bedrock.toml"
    toml_path.write_text(content, encoding="utf-8")
    return toml_path


def test_load_valid_config(tmp_path: Path):
    _write_toml(
        tmp_path,
        """
        [tool.bedrock]
        schema_catalog = "packages/bedrock-api/bedrock/core/schema_catalog.py"
        grids_dir = "packages/bedrock-ui/src/components/DataGrid"

        [tool.bedrock.audit.s001]
        exemptions = ["TwinComponent"]
        """,
    )
    cfg = load_bedrock_config(tmp_path)
    assert isinstance(cfg, BedrockConfig)
    assert cfg.schema_catalog == Path("packages/bedrock-api/bedrock/core/schema_catalog.py")
    assert cfg.grids_dir == Path("packages/bedrock-ui/src/components/DataGrid")
    assert "TwinComponent" in cfg.audit_s001.exemptions


def test_default_ignored_dirs_constant():
    expected = {
        ".venv",
        "node_modules",
        "dist",
        "build",
        "__pycache__",
        ".git",
        ".pytest_cache",
        ".agents",
        ".claude",
    }
    assert DEFAULT_IGNORED_DIRS == expected


def test_consumer_exemptions_merge_additively_with_platform_baseline(tmp_path: Path):
    _write_toml(
        tmp_path,
        """
        [tool.bedrock]

        [tool.bedrock.audit.s001]
        exemptions = ["TwinComponent"]
        """,
    )
    cfg = load_bedrock_config(tmp_path)
    # Platform baseline exemptions (e.g. vendored/generated paths) always apply,
    # regardless of what the consumer declares.
    assert "**/node_modules/**" in cfg.audit_s001.exemptions
    assert "**/.venv/**" in cfg.audit_s001.exemptions
    assert "TwinComponent" in cfg.audit_s001.exemptions


def test_merged_exemptions_contain_no_duplicates(tmp_path: Path):
    _write_toml(
        tmp_path,
        """
        [tool.bedrock]

        [tool.bedrock.audit.s001]
        exemptions = ["**/node_modules/**", "**/node_modules/**"]
        """,
    )
    cfg = load_bedrock_config(tmp_path)
    assert cfg.audit_s001.exemptions.count("**/node_modules/**") == 1


def test_missing_exemptions_key_on_declared_section_raises(tmp_path: Path):
    _write_toml(
        tmp_path,
        """
        [tool.bedrock]

        [tool.bedrock.audit.s001]
        allowlist_duplicates = []
        """,
    )
    with pytest.raises(ValueError):
        load_bedrock_config(tmp_path)


def test_omitted_optional_sections_default_cleanly(tmp_path: Path):
    _write_toml(
        tmp_path,
        """
        [tool.bedrock]
        """,
    )
    cfg = load_bedrock_config(tmp_path)
    # Every one of the 12 audit sections must be present with sane defaults
    # even when the consumer's bedrock.toml declares none of them.
    for i in range(1, 13):
        section = getattr(cfg, f"audit_s{i:03d}")
        assert isinstance(section.exemptions, list)


def test_s004_config_module_defaults_when_section_omitted(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock]\n")
    cfg = load_bedrock_config(tmp_path)
    assert cfg.audit_s004.config_module == "bedrock.core.config"


def test_s004_config_module_overridable(tmp_path: Path):
    _write_toml(
        tmp_path,
        """
        [tool.bedrock]
        [tool.bedrock.audit.s004]
        config_module = "app.core.config"
        exemptions = []
        """,
    )
    cfg = load_bedrock_config(tmp_path)
    assert cfg.audit_s004.config_module == "app.core.config"


def test_s008_guidance_docs_and_max_lines_defaults(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock]\n")
    cfg = load_bedrock_config(tmp_path)
    assert cfg.audit_s008.guidance_docs == ["CLAUDE.md", "GEMINI.md"]
    assert cfg.audit_s008.max_lines == 200


def test_s002_presentational_tables_default_to_empty_list(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock]\n")
    cfg = load_bedrock_config(tmp_path)
    assert cfg.audit_s002.presentational_tables == []


def test_s012_requirements_and_package_json_default_to_candidate_resolution(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock]\n")
    cfg = load_bedrock_config(tmp_path)
    assert cfg.audit_s012.requirements is None
    assert cfg.audit_s012.package_json is None


def test_missing_bedrock_toml_raises(tmp_path: Path):
    with pytest.raises(FileNotFoundError):
        load_bedrock_config(tmp_path)


def test_auto_detects_repo_root_when_none_given():
    # This repo's own bedrock.toml lives at the git repo root; auto-detection
    # must walk up from the current working directory to find it.
    cfg = load_bedrock_config(None)
    assert isinstance(cfg, BedrockConfig)
    assert cfg.audit_s001 is not None


def test_explicit_repo_root_overrides_auto_detection(tmp_path: Path):
    _write_toml(
        tmp_path,
        """
        [tool.bedrock]
        schema_catalog = "custom/path.py"

        [tool.bedrock.audit.s001]
        exemptions = []
        """,
    )
    cfg = load_bedrock_config(tmp_path)
    assert cfg.schema_catalog == Path("custom/path.py")


def test_dotenv_preserves_injected_db(monkeypatch, tmp_path):
    """Bedrock #74: load_dotenv must not overwrite an explicitly injected SQLITE_DB_PATH."""
    import importlib
    import os
    env_file = tmp_path / ".env"
    env_file.write_text("SQLITE_DB_PATH=data/production.db\n", encoding="utf-8")

    monkeypatch.setenv("BEDROCK_APP_ROOT", str(tmp_path))
    monkeypatch.setenv("SQLITE_DB_PATH", "data/scratch.db")

    import bedrock.core.paths as paths
    import bedrock.core.config as config
    paths = importlib.reload(paths)
    config = importlib.reload(config)

    expected = os.path.normpath(os.path.join(str(tmp_path), "data", "scratch.db"))
    assert config.config.SQLITE_DB_PATH == expected


def test_sqlite_pragmas_env_parsing(monkeypatch):
    """BEDROCK_SQLITE_PRAGMAS parses into a dict; SQLITE_PRAGMAS is read live, no reload needed."""
    import bedrock.core.config as config_module

    monkeypatch.delenv("BEDROCK_SQLITE_PRAGMAS", raising=False)
    assert config_module.config.SQLITE_PRAGMAS == {}

    monkeypatch.setenv("BEDROCK_SQLITE_PRAGMAS", "journal_mode=WAL,synchronous=NORMAL")
    assert config_module.config.SQLITE_PRAGMAS == {
        "journal_mode": "WAL",
        "synchronous": "NORMAL",
    }

