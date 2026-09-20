"""
Module:  s100_audit_domain_registry.py
Layer:   bedrock/tools
Desc:    Enforcement for [S100-domain-standard-authoring](../../../../docs/standards/s100-domain-standard-authoring.md).

         Four checks:
           1. Numbering range & tier agreement -
              Platform standards (S001-S099, S100) must declare `tier: platform`.
              Domain standards (S101-S199) must declare `tier: domain`.
              All IDs outside S001-S199 are prohibited.
           2. Filename naming convention -
              Standard filenames under `docs/standards/` must follow `s###-<kebab-name>.md`
              (with 3-digit zero padding), except `README.md`.
           3. Required frontmatter fields -
              Must have YAML frontmatter starting with `---` declaring:
              `id`, `title`, `status`, `tier`, `enforced_by`, `cli_command`.
              `id` must match `S###` in filename.
           4. Five mandatory sections -
              Every standard must contain the 5 canonical `##` headings:
              - `## Purpose & Objective`
              - `## Non-Negotiable Invariants`
              - `## Architecture & Code Contracts`
              - `## Exceptions & Audit Exemptions`
              - `## Verification & Enforcement Gate`

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.s100_audit_domain_registry --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from bedrock.tools._config import DEFAULT_IGNORED_DIRS, load_bedrock_config
from bedrock.tools._reporter import AuditReporter

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None


MANDATORY_HEADINGS: tuple[str, ...] = (
    "Purpose & Objective",
    "Non-Negotiable Invariants",
    "Architecture & Code Contracts",
    "Exceptions & Audit Exemptions",
    "Verification & Enforcement Gate",
)

REQUIRED_FRONTMATTER_FIELDS: tuple[str, ...] = (
    "id",
    "title",
    "status",
    "tier",
    "enforced_by",
    "cli_command",
)

_FILENAME_RE = re.compile(r"^s(\d{3})(?:-[a-z0-9-]+)?\.md$")


@dataclass
class RegistryViolation:
    file: str
    line: int
    message: str


def _parse_frontmatter(content: str) -> tuple[dict[str, Any] | None, str]:
    lines = content.splitlines(keepends=True)
    if not lines or lines[0].strip() != "---":
        return None, content

    closing_index = -1
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            closing_index = i
            break

    if closing_index == -1:
        return None, content

    fm_raw = "".join(lines[1:closing_index])
    body = "".join(lines[closing_index + 1:])

    if yaml is not None:
        try:
            data = yaml.safe_load(fm_raw)
            if isinstance(data, dict):
                return data, body
        except Exception:
            pass

    # Simple fallback key-value parser if yaml is absent or fails
    fallback_data: dict[str, Any] = {}
    for line in fm_raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            k, _, v = line.partition(":")
            v = v.strip().strip('"').strip("'")
            fallback_data[k.strip()] = v
    return fallback_data, body


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    posix_path = Path(rel_path).as_posix()
    if any(part in DEFAULT_IGNORED_DIRS for part in Path(rel_path).parts):
        return True
    return any(fnmatch.fnmatch(posix_path, pattern) for pattern in exemptions)


def audit(root: Path, exemptions: list[str]) -> list[RegistryViolation]:
    violations: list[RegistryViolation] = []
    standards_dir = root / "docs" / "standards"
    if not standards_dir.is_dir():
        return violations

    for path in sorted(standards_dir.glob("*.md")):
        if path.name == "README.md":
            continue

        rel_path = path.relative_to(root).as_posix()
        if _is_exempt(rel_path, exemptions):
            continue

        match = _FILENAME_RE.match(path.name)
        if not match:
            violations.append(
                RegistryViolation(
                    file=rel_path,
                    line=1,
                    message=f"{path.name} does not match naming convention 's###-<kebab-name>.md'",
                )
            )
            continue

        num_str = match.group(1)
        standard_num = int(num_str)
        expected_id = f"S{standard_num:03d}"

        if standard_num < 1 or standard_num > 199:
            violations.append(
                RegistryViolation(
                    file=rel_path,
                    line=1,
                    message=(
                        f"Standard number S{standard_num:03d} out of range "
                        "(S001-S099 platform, S100 platform authoring, S101-S199 domain)"
                    ),
                )
            )
            continue

        if 1 <= standard_num <= 100:
            expected_tier = "platform"
        else:
            expected_tier = "domain"

        try:
            content = path.read_text(encoding="utf-8")
        except Exception as exc:  # pragma: no cover
            violations.append(
                RegistryViolation(
                    file=rel_path,
                    line=1,
                    message=f"Could not read {rel_path}: {exc}",
                )
            )
            continue

        frontmatter, body = _parse_frontmatter(content)
        if frontmatter is None or not isinstance(frontmatter, dict):
            violations.append(
                RegistryViolation(
                    file=rel_path,
                    line=1,
                    message="Missing or invalid YAML frontmatter (must start and end with '---')",
                )
            )
            continue

        # Check required fields
        missing_fields = [f for f in REQUIRED_FRONTMATTER_FIELDS if not frontmatter.get(f)]
        if missing_fields:
            violations.append(
                RegistryViolation(
                    file=rel_path,
                    line=1,
                    message=f"Missing required frontmatter field(s): {', '.join(missing_fields)}",
                )
            )

        # Check ID match
        actual_id = str(frontmatter.get("id", "")).strip().upper()
        if actual_id and actual_id != expected_id:
            violations.append(
                RegistryViolation(
                    file=rel_path,
                    line=1,
                    message=f"Frontmatter id '{actual_id}' does not match expected id '{expected_id}'",
                )
            )

        # Check Tier match
        actual_tier = str(frontmatter.get("tier", "")).strip().lower()
        if actual_tier and actual_tier != expected_tier:
            violations.append(
                RegistryViolation(
                    file=rel_path,
                    line=1,
                    message=f"Standard S{standard_num:03d} has tier '{actual_tier}', expected '{expected_tier}'",
                )
            )

        # Check Mandatory Headings
        headings = [
            line.strip().lstrip("#").strip()
            for line in body.splitlines()
            if line.startswith("## ")
        ]
        missing_headings = [h for h in MANDATORY_HEADINGS if h not in headings]
        if missing_headings:
            violations.append(
                RegistryViolation(
                    file=rel_path,
                    line=1,
                    message=f"Missing mandatory section(s): {', '.join(missing_headings)}",
                )
            )

    return violations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S100", "Domain Standard Authoring & Registry", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    s100_cfg = getattr(config, "audit_s100", None)
    exemptions = s100_cfg.exemptions if s100_cfg else []

    violations = audit(root, exemptions)
    if violations:
        for violation in violations:
            reporter.start_check(f"Validating standard registry for {violation.file}")
            reporter.fail_check(violation.message, file_path=violation.file, line=violation.line)
    else:
        reporter.start_check("Validating standards directory numbering, frontmatter, and headings")
        reporter.pass_check("All standards conform to S100 domain standard authoring & registry")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
