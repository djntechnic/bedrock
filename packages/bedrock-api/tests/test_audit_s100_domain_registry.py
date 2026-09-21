"""
Tests for Standard S100: Domain Standard Authoring & Registry Audit.
"""
from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from bedrock.tools import s100_audit_domain_registry


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(textwrap.dedent(content), encoding="utf-8")


def _write_toml(tmp_path: Path, content: str) -> None:
    _write(tmp_path / "bedrock.toml", content)


_VALID_PLATFORM_STANDARD = """\
---
id: S001
title: "No Duplicate UI Code"
status: active
tier: platform
enforced_by: bedrock.tools.s001_audit_duplicates
cli_command: "python scripts/audit/s001_audit_duplicates.py --root ."
---

# Standard S001: No Duplicate UI Code

## Purpose & Objective
Objective text.

## Non-Negotiable Invariants
Invariants text.

## Architecture & Code Contracts
Contracts text.

## Exceptions & Audit Exemptions
Exemptions text.

## Verification & Enforcement Gate
Gate text.
"""

_VALID_DOMAIN_STANDARD = """\
---
id: S101
title: "eBay Compliance"
status: active
tier: domain
enforced_by: scripts.audit.s101_audit_ebay_compliance
cli_command: "python scripts/audit/s101_audit_ebay_compliance.py --root ."
---

# Standard S101: eBay Compliance

## Purpose & Objective
Objective text.

## Non-Negotiable Invariants
Invariants text.

## Architecture & Code Contracts
Contracts text.

## Exceptions & Audit Exemptions
Exemptions text.

## Verification & Enforcement Gate
Gate text.
"""


def test_s100_returns_two_on_missing_bedrock_toml(tmp_path: Path):
    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 2


def test_s100_returns_zero_on_empty_standards_dir(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    _write(tmp_path / "docs" / "standards" / "README.md", "# Standards Registry\n")

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 0


def test_s100_passes_valid_platform_standard(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    _write(tmp_path / "docs" / "standards" / "s001-no-duplicate-ui-code.md", _VALID_PLATFORM_STANDARD)

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 0


def test_s100_passes_valid_s100_platform_standard(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    s100_content = _VALID_PLATFORM_STANDARD.replace("id: S001", "id: S100").replace("S001", "S100")
    _write(tmp_path / "docs" / "standards" / "s100-domain-standard-authoring.md", s100_content)

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 0


def test_s100_passes_valid_domain_standard(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    _write(tmp_path / "docs" / "standards" / "s101-ebay-compliance.md", _VALID_DOMAIN_STANDARD)

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 0


def test_s100_fails_platform_range_with_domain_tier(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    invalid = _VALID_PLATFORM_STANDARD.replace("tier: platform", "tier: domain")
    _write(tmp_path / "docs" / "standards" / "s001-no-duplicate-ui-code.md", invalid)

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 1


def test_s100_fails_domain_range_with_platform_tier(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    invalid = _VALID_DOMAIN_STANDARD.replace("tier: domain", "tier: platform")
    _write(tmp_path / "docs" / "standards" / "s101-ebay-compliance.md", invalid)

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 1


def test_s100_fails_out_of_range_standard_number(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    s200_content = _VALID_PLATFORM_STANDARD.replace("id: S001", "id: S200").replace("S001", "S200")
    _write(tmp_path / "docs" / "standards" / "s200-out-of-bounds.md", s200_content)

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 1


def test_s100_fails_mismatched_filename_and_id(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    # File is s002, but frontmatter id says S001
    _write(tmp_path / "docs" / "standards" / "s002-data-grids.md", _VALID_PLATFORM_STANDARD)

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 1


def test_s100_fails_missing_frontmatter_fields(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    missing_cli = _VALID_PLATFORM_STANDARD.replace(
        'cli_command: "python scripts/audit/s001_audit_duplicates.py --root ."\n', ""
    )
    _write(tmp_path / "docs" / "standards" / "s001-no-duplicate-ui-code.md", missing_cli)

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 1


def test_s100_fails_missing_mandatory_section(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    missing_section = _VALID_PLATFORM_STANDARD.replace("## Architecture & Code Contracts\nContracts text.\n\n", "")
    _write(tmp_path / "docs" / "standards" / "s001-no-duplicate-ui-code.md", missing_section)

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 1


def test_s100_fails_invalid_filename_format(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    _write(tmp_path / "docs" / "standards" / "invalid_standard_name.md", _VALID_PLATFORM_STANDARD)

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 1


def test_s100_allows_exempted_standard(tmp_path: Path):
    _write_toml(
        tmp_path,
        '[tool.bedrock.audit.s100]\nexemptions = ["docs/standards/s001-no-duplicate-ui-code.md"]\n',
    )
    # Deliberately broken standard (no frontmatter, no sections)
    _write(tmp_path / "docs" / "standards" / "s001-no-duplicate-ui-code.md", "# Bare standard\n")

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 0


def test_s100_passes_with_leading_html_comment(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s100]\nexemptions = []\n")
    content = f"<!-- AUTOGENERATED MIRROR -->\n\n{_VALID_PLATFORM_STANDARD}"
    _write(tmp_path / "docs" / "standards" / "s001-no-duplicate-ui-code.md", content)

    assert s100_audit_domain_registry.main(["--root", str(tmp_path)]) == 0
