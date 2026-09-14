"""Unit tests for the documentation taxonomy validator and NTFS remediator."""
import subprocess
from pathlib import Path

from bedrock.tools import audit_taxonomy_and_casing, remediate_taxonomy_and_casing


def _write(path: Path, content: str = "content\n") -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _write_toml(tmp_path: Path, section: str = "") -> None:
    _write(tmp_path / "bedrock.toml", f"[tool.bedrock]\n{section}")


def _git_init(tmp_path: Path) -> None:
    subprocess.run(["git", "init"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "config", "user.name", "Test"], cwd=tmp_path, capture_output=True, check=True)


# ---------------------------------------------------------------------------
# audit_taxonomy_and_casing
# ---------------------------------------------------------------------------


def test_audit_detects_non_kebab_case_filename(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _write(tmp_path / "docs" / "standards" / "S01_Standard.md")

    assert audit_taxonomy_and_casing.main(["--root", str(tmp_path)]) == 1


def test_audit_detects_filename_with_spaces(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _write(tmp_path / "docs" / "reference" / "My Notes.md")

    assert audit_taxonomy_and_casing.main(["--root", str(tmp_path)]) == 1


def test_audit_detects_deprecated_directory(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _write(tmp_path / "docs" / "punchlists" / "notes.md")

    assert audit_taxonomy_and_casing.main(["--root", str(tmp_path)]) == 1


def test_audit_detects_uppercase_templates_directory(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _write(tmp_path / "Templates" / "listing.html")

    assert audit_taxonomy_and_casing.main(["--root", str(tmp_path)]) == 1


def test_audit_passes_clean_kebab_case_and_exempt_names(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _write(tmp_path / "docs" / "standards" / "s001-no-duplicate-ui-code.md")
    _write(tmp_path / "README.md")
    _write(tmp_path / "CLAUDE.md")

    assert audit_taxonomy_and_casing.main(["--root", str(tmp_path)]) == 0


def test_audit_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert audit_taxonomy_and_casing.main(["--root", str(tmp_path)]) == 2


# ---------------------------------------------------------------------------
# remediate_taxonomy_and_casing - rename planning
# ---------------------------------------------------------------------------


def test_build_rename_plan_generates_two_stage_target(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _write(tmp_path / "docs" / "standards" / "S01_Standard.md")

    plan = remediate_taxonomy_and_casing.build_rename_plan(tmp_path, [])

    assert len(plan) == 1
    assert plan[0].rel_source == "docs/standards/S01_Standard.md"
    assert plan[0].rel_target == "docs/standards/s01-standard.md"


def test_build_rename_plan_skips_already_kebab_case_files(tmp_path: Path):
    _write(tmp_path / "docs" / "standards" / "s001-no-duplicate-ui-code.md")

    plan = remediate_taxonomy_and_casing.build_rename_plan(tmp_path, [])

    assert plan == []


def test_execute_two_stage_rename_uses_tmp_intermediate(tmp_path: Path):
    _git_init(tmp_path)
    src = tmp_path / "docs" / "standards" / "S01_Standard.md"
    _write(src)
    subprocess.run(["git", "add", "-A"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "commit", "-m", "seed"], cwd=tmp_path, capture_output=True, check=True)

    plan = remediate_taxonomy_and_casing.build_rename_plan(tmp_path, [])
    assert len(plan) == 1

    commands = remediate_taxonomy_and_casing.execute_two_stage_rename(tmp_path, plan[0])

    assert commands[0].endswith("S01_Standard.md__tmp")
    assert not src.exists()
    assert (tmp_path / "docs" / "standards" / "s01-standard.md").exists()


# ---------------------------------------------------------------------------
# remediate_taxonomy_and_casing - inbound link rewriting
# ---------------------------------------------------------------------------


def test_rewrite_inbound_links_updates_markdown_link_target(tmp_path: Path):
    _write(tmp_path / "docs" / "standards" / "S01_Standard.md")
    _write(
        tmp_path / "docs" / "guide" / "intro.md",
        "See [the standard](docs/standards/S01_Standard.md) for details.\n",
    )

    plan = remediate_taxonomy_and_casing.build_rename_plan(tmp_path, [])
    updates = remediate_taxonomy_and_casing.rewrite_inbound_links(tmp_path, plan, dry_run=False)

    assert updates == {"docs/guide/intro.md": 1}
    rewritten = (tmp_path / "docs" / "guide" / "intro.md").read_text(encoding="utf-8")
    assert "docs/standards/s01-standard.md" in rewritten
    assert "S01_Standard.md" not in rewritten


def test_rewrite_inbound_links_dry_run_makes_zero_disk_changes(tmp_path: Path):
    _write(tmp_path / "docs" / "standards" / "S01_Standard.md")
    inbound = tmp_path / "docs" / "guide" / "intro.md"
    _write(inbound, "See [the standard](docs/standards/S01_Standard.md) for details.\n")
    original = inbound.read_text(encoding="utf-8")

    plan = remediate_taxonomy_and_casing.build_rename_plan(tmp_path, [])
    updates = remediate_taxonomy_and_casing.rewrite_inbound_links(tmp_path, plan, dry_run=True)

    assert updates == {"docs/guide/intro.md": 1}
    assert inbound.read_text(encoding="utf-8") == original


# ---------------------------------------------------------------------------
# remediate_taxonomy_and_casing - CLI --dry-run / --write
# ---------------------------------------------------------------------------


def test_cli_dry_run_performs_zero_disk_modifications(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _write(tmp_path / "docs" / "standards" / "S01_Standard.md")

    before = sorted(p.relative_to(tmp_path).as_posix() for p in tmp_path.rglob("*") if p.is_file())

    assert remediate_taxonomy_and_casing.main(["--root", str(tmp_path), "--dry-run"]) == 0

    after = sorted(p.relative_to(tmp_path).as_posix() for p in tmp_path.rglob("*") if p.is_file())
    assert before == after


def test_cli_write_performs_two_stage_rename(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s008]\nexemptions = []\n")
    _git_init(tmp_path)
    _write(tmp_path / "docs" / "standards" / "S01_Standard.md")
    subprocess.run(["git", "add", "-A"], cwd=tmp_path, capture_output=True, check=True)
    subprocess.run(["git", "commit", "-m", "seed"], cwd=tmp_path, capture_output=True, check=True)

    assert remediate_taxonomy_and_casing.main(["--root", str(tmp_path), "--write"]) == 0

    assert not (tmp_path / "docs" / "standards" / "S01_Standard.md").exists()
    assert (tmp_path / "docs" / "standards" / "s01-standard.md").exists()


def test_cli_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert remediate_taxonomy_and_casing.main(["--root", str(tmp_path), "--dry-run"]) == 2
