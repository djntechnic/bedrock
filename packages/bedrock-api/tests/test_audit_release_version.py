"""Tests for the release-version parity gate."""
import pathlib

from bedrock.tools import audit_release_version as gate


def _repo(tmp_path, npm_version: str | None, py_version: str | None,
          npm_present: bool = True, py_present: bool = True,
          npm_unparseable: bool = False, py_unparseable: bool = False):
    """Build a minimal repo tree with just the two manifests the gate reads."""
    if npm_present:
        if npm_unparseable:
            (tmp_path / "package.json").write_text(
                '{\n  "name": "@djntechnic/bedrock-ui"\n}\n', encoding="utf-8"
            )
        else:
            (tmp_path / "package.json").write_text(
                f'{{\n  "name": "@djntechnic/bedrock-ui",\n'
                f'  "version": "{npm_version}"\n}}\n',
                encoding="utf-8",
            )

    api_dir = tmp_path / "packages" / "bedrock-api"
    api_dir.mkdir(parents=True)
    if py_present:
        if py_unparseable:
            (api_dir / "pyproject.toml").write_text(
                '[project]\nname = "bedrock-api"\n', encoding="utf-8"
            )
        else:
            (api_dir / "pyproject.toml").write_text(
                f'[project]\nname = "bedrock-api"\nversion = "{py_version}"\n',
                encoding="utf-8",
            )

    return tmp_path


def test_both_manifests_matching_the_tag_passes(tmp_path):
    repo = _repo(tmp_path, "0.8.1", "0.8.1")
    assert gate.audit(repo, "v0.8.1") == []


def test_tag_without_leading_v_also_passes(tmp_path):
    repo = _repo(tmp_path, "0.8.1", "0.8.1")
    assert gate.audit(repo, "0.8.1") == []


def test_npm_manifest_drifted_fails_and_names_both_values(tmp_path):
    repo = _repo(tmp_path, "0.6.2", "0.8.1")
    failures = gate.audit(repo, "v0.8.1")
    assert len(failures) == 1
    assert "package.json" in failures[0]
    assert "0.8.1" in failures[0]  # expected
    assert "0.6.2" in failures[0]  # found


def test_python_manifest_drifted_fails_and_names_both_values(tmp_path):
    repo = _repo(tmp_path, "0.8.1", "0.6.2")
    failures = gate.audit(repo, "v0.8.1")
    assert len(failures) == 1
    assert "pyproject.toml" in failures[0]
    assert "0.8.1" in failures[0]  # expected
    assert "0.6.2" in failures[0]  # found


def test_both_manifests_drifted_reports_both_failures(tmp_path):
    repo = _repo(tmp_path, "0.6.2", "0.6.2")
    failures = gate.audit(repo, "v0.8.1")
    assert len(failures) == 2
    joined = "\n".join(failures)
    assert "package.json" in joined
    assert "pyproject.toml" in joined


def test_missing_npm_manifest_fails_not_passes(tmp_path):
    repo = _repo(tmp_path, "0.8.1", "0.8.1", npm_present=False)
    failures = gate.audit(repo, "v0.8.1")
    assert len(failures) == 1
    assert "does not exist" in failures[0]
    assert "package.json" in failures[0]


def test_missing_python_manifest_fails_not_passes(tmp_path):
    repo = _repo(tmp_path, "0.8.1", "0.8.1", py_present=False)
    failures = gate.audit(repo, "v0.8.1")
    assert len(failures) == 1
    assert "does not exist" in failures[0]
    assert "pyproject.toml" in failures[0]


def test_unparseable_npm_version_fails_not_passes(tmp_path):
    repo = _repo(tmp_path, "0.8.1", "0.8.1", npm_unparseable=True)
    failures = gate.audit(repo, "v0.8.1")
    assert len(failures) == 1
    assert "no parseable" in failures[0]
    assert "package.json" in failures[0]


def test_unparseable_python_version_fails_not_passes(tmp_path):
    repo = _repo(tmp_path, "0.8.1", "0.8.1", py_unparseable=True)
    failures = gate.audit(repo, "v0.8.1")
    assert len(failures) == 1
    assert "no parseable" in failures[0]
    assert "pyproject.toml" in failures[0]


def test_main_exits_zero_on_match(tmp_path, monkeypatch):
    repo = _repo(tmp_path, "0.8.1", "0.8.1")
    assert gate.main(["v0.8.1", "--repo-root", str(repo)]) == 0


def test_main_exits_nonzero_on_mismatch(tmp_path):
    repo = _repo(tmp_path, "0.6.2", "0.6.2")
    assert gate.main(["v0.8.1", "--repo-root", str(repo)]) == 1


def test_main_exits_nonzero_on_missing_manifest(tmp_path):
    repo = _repo(tmp_path, "0.8.1", "0.8.1", npm_present=False)
    assert gate.main(["v0.8.1", "--repo-root", str(repo)]) == 1
