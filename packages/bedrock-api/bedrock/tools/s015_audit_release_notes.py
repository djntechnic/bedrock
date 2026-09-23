# packages/bedrock-api/bedrock/tools/s015_audit_release_notes.py
"""
Module:  s015_audit_release_notes.py
Layer:   bedrock/tools
Desc:    Enforcement for [S015-release-automation-and-changelog-contract]
         (../../../../docs/standards/s015-release-automation-and-changelog-contract.md).

         Validates one target version's CHANGELOG.md entry, at the
         committed `###` heading level (never the heading-promoted release
         body), against the mandatory section structure, ### Fixed
         metadata contract, and ### For consumers schema.

         Exit 0 clean, 1 on a structural violation, 2 on a configuration
         error (missing CHANGELOG.md, malformed bedrock.toml).

Usage:   python -m bedrock.tools.s015_audit_release_notes vX.Y.Z --root .
"""
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import load_bedrock_config
from bedrock.tools._reporter import AuditReporter

_VERSION_BLOCK = re.compile(
    r"^## (?P<version>v\d+\.\d+\.\d+) - \d{4}-\d{2}-\d{2}\n(?P<body>.*?)(?=\n## v\d+\.\d+\.\d+ - |\Z)",
    re.DOTALL | re.MULTILINE,
)
_SUBSECTION = re.compile(r"^### (?P<title>[^\n]+)\n(?P<body>.*?)(?=\n### |\Z)", re.DOTALL | re.MULTILINE)
_FIXED_BULLET = re.compile(
    r"^-\s+(?:\*\*)?\[#(?P<issue>\d+)\][^\n]*\n(?P<children>(?:  .*\n?)*)",
    re.MULTILINE,
)
_PIN_MIGRATION = re.compile(r"/bump-bedrock-pin\s+(v\d+\.\d+\.\d+)")

_REQUIRED_SECTION_ORDER = (
    "Breaking Changes",
    "Fixed",
    "Added / Changed",
    "Platform Maintenance",
    "For consumers",
)


@dataclass
class ReleaseNoteViolation:
    message: str


def _extract_version_block(changelog_text: str, target_version: str) -> str | None:
    for match in _VERSION_BLOCK.finditer(changelog_text):
        if match.group("version") == target_version:
            return match.group("body")
    return None


def _parse_subsections(block_text: str) -> dict[str, str]:
    return {m.group("title").strip(): m.group("body") for m in _SUBSECTION.finditer(block_text)}


def _section_order_violations(block_text: str) -> list[ReleaseNoteViolation]:
    found_order = [m.group("title").strip() for m in _SUBSECTION.finditer(block_text)]
    violations: list[ReleaseNoteViolation] = []
    for required in _REQUIRED_SECTION_ORDER:
        if required not in found_order:
            violations.append(ReleaseNoteViolation(f"missing required section: ### {required}"))

    rank = {title: idx for idx, title in enumerate(_REQUIRED_SECTION_ORDER)}
    present_ranked = [rank[title] for title in found_order if title in rank]
    if present_ranked != sorted(present_ranked):
        violations.append(
            ReleaseNoteViolation(
                "CHANGELOG.md sections are out of order: expected "
                f"{list(_REQUIRED_SECTION_ORDER)}, found {found_order}"
            )
        )
    return violations


def _fixed_entry_violations(fixed_body: str) -> list[ReleaseNoteViolation]:
    violations: list[ReleaseNoteViolation] = []
    bullets = list(_FIXED_BULLET.finditer(fixed_body))
    if not bullets:
        return violations
    for bullet in bullets:
        children = bullet.group("children")
        issue = bullet.group("issue")
        if "Origin / Root Cause" not in children:
            violations.append(ReleaseNoteViolation(f"[#{issue}] missing Origin / Root Cause child bullet"))
        if "Prevention / Test" not in children:
            violations.append(ReleaseNoteViolation(f"[#{issue}] missing Prevention / Test child bullet"))
    return violations


def _for_consumers_violations(section_body: str, target_version: str) -> list[ReleaseNoteViolation]:
    violations: list[ReleaseNoteViolation] = []
    for key in ("Resolves Upstream Issues", "Target Downstream Repositories", "Expected Pin Migration"):
        if f"**{key}:**" not in section_body:
            violations.append(ReleaseNoteViolation(f"### For consumers missing required key: {key}"))

    pin_match = _PIN_MIGRATION.search(section_body)
    if pin_match is None:
        violations.append(ReleaseNoteViolation("### For consumers Expected Pin Migration has no /bump-bedrock-pin tag"))
    elif pin_match.group(1) != target_version:
        violations.append(
            ReleaseNoteViolation(
                f"### For consumers Expected Pin Migration tag {pin_match.group(1)} "
                f"does not match target version {target_version}"
            )
        )
    return violations


def audit(root: Path, target_version: str, changelog_rel: str) -> list[ReleaseNoteViolation]:
    changelog_path = root / changelog_rel
    if not changelog_path.exists():
        raise FileNotFoundError(f"CHANGELOG.md not found at {changelog_path}")

    changelog_text = changelog_path.read_text(encoding="utf-8")
    block = _extract_version_block(changelog_text, target_version)
    if block is None:
        return [ReleaseNoteViolation(f"no CHANGELOG.md entry found for {target_version}")]

    violations = _section_order_violations(block)
    subsections = _parse_subsections(block)

    if "Fixed" in subsections:
        violations.extend(_fixed_entry_violations(subsections["Fixed"]))
    if "For consumers" in subsections:
        violations.extend(_for_consumers_violations(subsections["For consumers"], target_version))

    return violations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version", help="target release version, e.g. v0.11.0")
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S015", "Release Automation & Changelog Contract", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    reporter.start_check(f"Validating CHANGELOG.md entry for {args.version}")
    try:
        violations = audit(root, args.version, config.audit_s015.changelog_path)
    except FileNotFoundError as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()

    if violations:
        for violation in violations:
            reporter.fail_check(violation.message)
    else:
        reporter.pass_check(f"{args.version} entry satisfies the §S015 contract")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
