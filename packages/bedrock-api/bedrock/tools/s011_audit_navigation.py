"""
Module:  audit_s011_navigation.py
Layer:   bedrock/tools
Desc:    Enforcement for [S011-config-driven-navigation](../../../../docs/standards/s011-config-driven-navigation.md).

         Three checks:
           1. `navConfig` existence and schema - the declared `nav_config`
              file exists and every entry declares `id`, `label`, `path`,
              `icon`, and `permission`.
           2. Hardcoded nav trees - no `<a href=...>` / `<Link to=...>` list
              in a nav-bearing component (`AppSidebar`, `AppFooter`,
              `PageHeader`, `Breadcrumb`, `CommandPalette`) outside an
              exempted path.

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.audit_s011_navigation --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import (
    DEFAULT_IGNORED_DIRS,
    NAV_CONFIG_CANDIDATES,
    load_bedrock_config,
    resolve_candidate_path,
)
from bedrock.tools._reporter import AuditReporter

_REQUIRED_NAV_FIELDS = ("id", "label", "path", "icon", "permission")

_NAV_COMPONENT_NAMES = (
    "AppSidebar",
    "AppFooter",
    "PageHeader",
    "Breadcrumb",
    "CommandPalette",
)

_HARDCODED_LINK = re.compile(r"<a\s+[^>]*href=|<Link\s+[^>]*\bto=")
_NAV_REGISTRY_IMPORT = re.compile(r"\bnavRegistry\b")


@dataclass
class NavViolation:
    file: str
    line: int
    message: str


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    if any(part in DEFAULT_IGNORED_DIRS for part in Path(rel_path).parts):
        return True
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _check_nav_config_schema(
    root: Path, nav_config: str | None, exemptions: list[str]
) -> list[NavViolation]:
    if nav_config is None:
        searched = ", ".join(NAV_CONFIG_CANDIDATES)
        return [
            NavViolation(
                file=NAV_CONFIG_CANDIDATES[0],
                line=1,
                message=f"no navConfig found (looked in: {searched}) - navigation must be "
                "declared through a config-driven navConfig, not hardcoded per component; "
                "set `nav_config` in [tool.bedrock.audit.s011] to point at yours",
            )
        ]

    if _is_exempt(nav_config, exemptions):
        return []

    path = root / nav_config
    if not path.exists():
        return [
            NavViolation(
                file=nav_config,
                line=1,
                message=f"{nav_config} does not exist - navigation must be declared through "
                "a config-driven navConfig, not hardcoded per component",
            )
        ]

    text = path.read_text(encoding="utf-8", errors="replace")
    missing = [field for field in _REQUIRED_NAV_FIELDS if field not in text]
    if missing:
        return [
            NavViolation(
                file=nav_config,
                line=1,
                message=f"{nav_config} is missing required schema field(s): {', '.join(missing)}",
            )
        ]
    return []


def _check_hardcoded_nav_trees(root: Path, exemptions: list[str]) -> list[NavViolation]:
    violations: list[NavViolation] = []
    if not root.is_dir():
        return violations

    for path in sorted(root.rglob("*.tsx")):
        if any(part in DEFAULT_IGNORED_DIRS for part in path.parts):
            continue
        if path.stem not in _NAV_COMPONENT_NAMES:
            continue
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        if _NAV_REGISTRY_IMPORT.search(text):
            continue

        for match in _HARDCODED_LINK.finditer(text):
            violations.append(
                NavViolation(
                    file=rel,
                    line=_line_of(text, match.start()),
                    message=f"{path.stem} renders a hardcoded link instead of sourcing from "
                    "navRegistry",
                )
            )
    return violations


def audit(root: Path, nav_config: str | None, exemptions: list[str]) -> list[NavViolation]:
    resolved = resolve_candidate_path(root, nav_config, NAV_CONFIG_CANDIDATES)
    return _check_nav_config_schema(root, resolved, exemptions) + _check_hardcoded_nav_trees(
        root, exemptions
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S011", "Config-Driven Navigation", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    violations = audit(root, config.audit_s011.nav_config, config.audit_s011.exemptions)
    if violations:
        for violation in violations:
            reporter.start_check(f"Checking navigation config for {violation.file}:{violation.line}")
            reporter.fail_check(
                violation.message, file_path=violation.file, line=violation.line
            )
    else:
        reporter.start_check("Scanning navConfig schema and nav components for hardcoded links")
        reporter.pass_check("navigation is fully config-driven")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
