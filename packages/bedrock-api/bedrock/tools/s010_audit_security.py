"""
Module:  audit_s010_security.py
Layer:   bedrock/tools
Desc:    Enforcement for [S010-granular-security-model](../../../../docs/standards/s010-granular-security-model.md).

         Scans FastAPI route files for state-mutating endpoints (POST, PUT,
         PATCH, DELETE) and verifies each declares an explicit authorization
         dependency - `Depends(require_permission(...))` or
         `Depends(get_current_user)` - somewhere in its decorator chain or
         function signature. A mutating endpoint with neither is flagged as
         unauthenticated.

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.audit_s010_security --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import DEFAULT_IGNORED_DIRS, iter_source_files, load_bedrock_config
from bedrock.tools._reporter import AuditReporter

_ROUTE_BLOCK = re.compile(
    r"@router\.(?P<method>post|put|patch|delete)\(\s*[\"'](?P<path>[^\"']+)[\"'][^)]*\)\s*\n"
    r"(?P<extra_decorators>(?:@[^\n]*\n)*)"
    r"def\s+(?P<func>\w+)\((?P<signature>[^)]*)\)\s*(?:->[^:]+)?:",
    re.M,
)

_AUTH_MARKERS = ("require_permission", "get_current_user")
_PUBLIC_MARKER = "is_public=True"


@dataclass
class SecurityViolation:
    file: str
    line: int
    method: str
    path: str
    message: str


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    if any(part in DEFAULT_IGNORED_DIRS for part in Path(rel_path).parts):
        return True
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _route_files(root: Path) -> list[Path]:
    return sorted(
        p for p in iter_source_files(root, (".py",)) if p.parent.name in ("routes", "api")
    )


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def find_unauthenticated_mutations(root: Path, exemptions: list[str]) -> list[SecurityViolation]:
    violations: list[SecurityViolation] = []
    for path in _route_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        for match in _ROUTE_BLOCK.finditer(text):
            block = match.group(0)
            if _PUBLIC_MARKER in block:
                continue
            if any(marker in block for marker in _AUTH_MARKERS):
                continue
            violations.append(
                SecurityViolation(
                    file=rel,
                    line=_line_of(text, match.start()),
                    method=match.group("method").upper(),
                    path=match.group("path"),
                    message=f"{match.group('method').upper()} {match.group('path')} has no "
                    "declared authorization dependency "
                    "(Depends(require_permission(...)) or Depends(get_current_user))",
                )
            )
    return violations


def audit(root: Path, exemptions: list[str]) -> list[SecurityViolation]:
    return find_unauthenticated_mutations(root, exemptions)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S010", "Granular Security Model", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    violations = audit(root, config.audit_s010.exemptions)
    if violations:
        for violation in violations:
            reporter.start_check(f"Checking route guard for {violation.method} {violation.path}")
            reporter.fail_check(
                violation.message, file_path=violation.file, line=violation.line
            )
    else:
        reporter.start_check("Scanning mutating routes for declared authorization dependencies")
        reporter.pass_check("every mutating route declares an authorization dependency")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
