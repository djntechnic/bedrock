"""Unit tests for the pruned-walk source inventory (`bedrock.tools._config.
iter_source_files`) and its memoization contract."""
from __future__ import annotations

import os
from pathlib import Path

from bedrock.tools._config import clear_source_cache, iter_source_files, load_bedrock_config


def _write(path: Path, content: str = "") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def test_iter_source_files_prunes_ignored_directories(tmp_path: Path, monkeypatch):
    _write(tmp_path / ".venv" / "a.py")
    _write(tmp_path / "node_modules" / "b.js")
    _write(tmp_path / ".git" / "c.py")
    _write(tmp_path / "src" / "app.py")

    visited_dirs: list[str] = []
    real_walk = os.walk

    def _spy_walk(top, *args, **kwargs):
        for dirpath, dirnames, filenames in real_walk(top, *args, **kwargs):
            visited_dirs.append(dirpath)
            yield dirpath, dirnames, filenames

    monkeypatch.setattr("bedrock.tools._config.os.walk", _spy_walk)

    result = iter_source_files(tmp_path, (".py",))

    assert result == (tmp_path.resolve() / "src" / "app.py",)
    assert not any(part in {".venv", "node_modules", ".git"} for d in visited_dirs for part in Path(d).parts)


def test_iter_source_files_preserves_nested_sources(tmp_path: Path):
    _write(tmp_path / "packages" / "bedrock-api" / "bedrock" / "x.py")

    result = iter_source_files(tmp_path, (".py",))

    assert tmp_path.resolve() / "packages" / "bedrock-api" / "bedrock" / "x.py" in result


def test_iter_source_files_prunes_by_dirname_not_substring(tmp_path: Path):
    _write(tmp_path / "build.py")
    _write(tmp_path / "rebuild" / "x.py")
    _write(tmp_path / "my_dist" / "y.py")
    _write(tmp_path / "build" / "ignored.py")

    result = iter_source_files(tmp_path, (".py",))
    rel = {p.relative_to(tmp_path.resolve()).as_posix() for p in result}

    assert "build.py" in rel
    assert "rebuild/x.py" in rel
    assert "my_dist/y.py" in rel
    assert "build/ignored.py" not in rel


def test_iter_source_files_handles_data_assets(tmp_path: Path):
    _write(tmp_path / "data" / "a.py")
    _write(tmp_path / "imports" / "b.py")
    _write(tmp_path / "exports" / "c.py")
    _write(tmp_path / "src" / "d.py")

    with_assets = {p.name for p in iter_source_files(tmp_path, (".py",), include_assets=True)}
    without_assets = {
        p.name for p in iter_source_files(tmp_path, (".py",), include_assets=False)
    }

    assert with_assets == {"a.py", "b.py", "c.py", "d.py"}
    assert without_assets == {"d.py"}


def test_iter_source_files_filters_suffixes(tmp_path: Path):
    _write(tmp_path / "a.py")
    _write(tmp_path / "b.py")

    result = iter_source_files(tmp_path, (".ts", ".tsx"))

    assert result == ()


def test_source_cache_keyed_by_root(tmp_path: Path):
    root_a = tmp_path / "repo-a"
    root_b = tmp_path / "repo-b"
    _write(root_a / "a.py")
    _write(root_b / "b.py")

    result_a = iter_source_files(root_a, (".py",))
    result_b = iter_source_files(root_b, (".py",))

    assert result_a == (root_a.resolve() / "a.py",)
    assert result_b == (root_b.resolve() / "b.py",)
    assert result_a != result_b


def test_clear_source_cache_invalidates_iter_source_files(tmp_path: Path):
    _write(tmp_path / "a.py")

    first = iter_source_files(tmp_path, (".py",))
    assert first == (tmp_path.resolve() / "a.py",)

    _write(tmp_path / "b.py")
    stale = iter_source_files(tmp_path, (".py",))
    assert stale == first  # still cached, unaware of the new file

    clear_source_cache()
    fresh = iter_source_files(tmp_path, (".py",))
    assert fresh == (tmp_path.resolve() / "a.py", tmp_path.resolve() / "b.py")


def test_clear_source_cache_invalidates_load_bedrock_config(tmp_path: Path):
    toml_path = tmp_path / "bedrock.toml"
    toml_path.write_text(
        """
        [tool.bedrock.audit.s001]
        exemptions = ["First"]
        """,
        encoding="utf-8",
    )

    first = load_bedrock_config(tmp_path)
    assert "First" in first.audit_s001.exemptions

    toml_path.write_text(
        """
        [tool.bedrock.audit.s001]
        exemptions = ["Second"]
        """,
        encoding="utf-8",
    )
    stale = load_bedrock_config(tmp_path)
    assert stale is first  # still cached

    clear_source_cache()
    fresh = load_bedrock_config(tmp_path)
    assert "Second" in fresh.audit_s001.exemptions
