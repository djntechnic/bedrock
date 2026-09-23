# packages/bedrock-api/tests/test_audit_s015_release_notes.py
from pathlib import Path

from bedrock.tools import s015_audit_release_notes


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _write_toml(root: Path, extra: str = "") -> None:
    _write(
        root / "bedrock.toml",
        f"""
[tool.bedrock]
[tool.bedrock.audit.s015]
changelog_path = "CHANGELOG.md"
exemptions = []
{extra}
""",
    )


_COMPLIANT_ENTRY = """## v0.11.0 - 2026-09-22

### Breaking Changes
None

### Fixed
- **[#101] Fix route collision on wildcard admin paths**
  - **Origin / Root Cause:** the wildcard route registered before the
    literal route, shadowing it.
  - **Prevention / Test:** test_admin_routes.py::test_literal_route_wins

### Added / Changed
- **[#104] Add bulk CSV export to the Grid Editor**

### Platform Maintenance
None

### For consumers
- **Resolves Upstream Issues:** #101, #104
- **Target Downstream Repositories:** `djntechnic/CollectIt`, `djntechnic/MLBTracker`
- **Expected Pin Migration:** `/bump-bedrock-pin v0.11.0`
"""


def test_compliant_entry_passes(tmp_path):
    _write_toml(tmp_path)
    _write(tmp_path / "CHANGELOG.md", _COMPLIANT_ENTRY)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 0


def test_missing_target_version_fails(tmp_path):
    _write_toml(tmp_path)
    _write(tmp_path / "CHANGELOG.md", _COMPLIANT_ENTRY)
    assert s015_audit_release_notes.main(["v9.9.9", "--root", str(tmp_path)]) == 1


def test_missing_for_consumers_section_fails(tmp_path):
    _write_toml(tmp_path)
    broken = _COMPLIANT_ENTRY.split("### For consumers")[0]
    _write(tmp_path / "CHANGELOG.md", broken)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 1


def test_missing_breaking_changes_header_fails(tmp_path):
    _write_toml(tmp_path)
    broken = _COMPLIANT_ENTRY.replace("### Breaking Changes\nNone\n\n", "")
    _write(tmp_path / "CHANGELOG.md", broken)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 1


def test_fixed_bullet_missing_origin_root_cause_fails(tmp_path):
    _write_toml(tmp_path)
    broken = _COMPLIANT_ENTRY.replace(
        "  - **Origin / Root Cause:** the wildcard route registered before the\n"
        "    literal route, shadowing it.\n",
        "",
    )
    _write(tmp_path / "CHANGELOG.md", broken)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 1


def test_fixed_bullet_missing_prevention_test_fails(tmp_path):
    _write_toml(tmp_path)
    broken = _COMPLIANT_ENTRY.replace(
        "  - **Prevention / Test:** test_admin_routes.py::test_literal_route_wins\n",
        "",
    )
    _write(tmp_path / "CHANGELOG.md", broken)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 1


def test_mismatched_pin_migration_tag_fails(tmp_path):
    _write_toml(tmp_path)
    broken = _COMPLIANT_ENTRY.replace(
        "**Expected Pin Migration:** `/bump-bedrock-pin v0.11.0`",
        "**Expected Pin Migration:** `/bump-bedrock-pin v0.9.0`",
    )
    _write(tmp_path / "CHANGELOG.md", broken)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 1


def test_unbolded_fixed_bullet_form_also_passes(tmp_path):
    _write_toml(tmp_path)
    unbolded = _COMPLIANT_ENTRY.replace(
        "- **[#101] Fix route collision on wildcard admin paths**",
        "- [#101] Fix route collision on wildcard admin paths",
    )
    _write(tmp_path / "CHANGELOG.md", unbolded)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 0


def test_missing_changelog_file_errors(tmp_path):
    _write_toml(tmp_path)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 2


def test_malformed_bedrock_toml_errors(tmp_path):
    _write(tmp_path / "bedrock.toml", "not [ valid toml")
    _write(tmp_path / "CHANGELOG.md", _COMPLIANT_ENTRY)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 2
