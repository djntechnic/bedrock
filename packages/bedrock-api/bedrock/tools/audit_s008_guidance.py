"""
Module:  audit_s008_guidance.py
Layer:   bedrock/tools
Desc:    Enforcement for [S008-documentation-layout-and-naming](../../../../docs/standards/s008-documentation-layout-and-naming.md).

         Three checks:
           1. Guidance document size - every file in `guidance_docs` (e.g.
              `CLAUDE.md`, `GEMINI.md`) is at or under `max_lines`.
           2. Documentation layout taxonomy - `docs/` contains only the four
              canonical folders (`standards`, `specs`, `plans`, `archive`),
              declared `allowed_root_docs`, and `README.md`. Deprecated
              folders (`docs/punchlists`) are always flagged.
           3. Filename convention - markdown files under `docs/` are
              lowercase kebab-case, except `README.md`.

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.audit_s008_guidance --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import load_bedrock_config
from bedrock.tools._reporter import AuditReporter

_ALLOWED_DOC_FOLDERS = {"standards", "specs", "plans", "archive"}
_DEPRECATED_DOC_FOLDERS = {"punchlists"}
_KEBAB_CASE_EXEMPT_NAMES = {"README.md"}
_KEBAB_CASE_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*\.md$")


@dataclass
class GuidanceViolation:
    file: str
    line: int
    message: str


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _check_guidance_doc_size(
    root: Path, guidance_docs: list[str], max_lines: int, exemptions: list[str]
) -> list[GuidanceViolation]:
    violations: list[GuidanceViolation] = []
    for name in guidance_docs:
        if _is_exempt(name, exemptions):
            continue
        path = root / name
        if not path.exists():
            continue
        line_count = len(path.read_text(encoding="utf-8", errors="replace").splitlines())
        if line_count > max_lines:
            violations.append(
                GuidanceViolation(
                    file=name,
                    line=line_count,
                    message=f"{name} is {line_count} lines, exceeding the {max_lines}-line cap",
                )
            )
    return violations


def _check_layout_taxonomy(
    root: Path, allowed_root_docs: list[str], exemptions: list[str]
) -> list[GuidanceViolation]:
    violations: list[GuidanceViolation] = []
    docs_root = root / "docs"
    if not docs_root.is_dir():
        return violations

    for entry in sorted(docs_root.iterdir()):
        rel = entry.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        if entry.is_dir():
            if entry.name in _DEPRECATED_DOC_FOLDERS:
                violations.append(
                    GuidanceViolation(
                        file=rel,
                        line=1,
                        message=f"docs/{entry.name}/ is a deprecated directory - "
                        "move its contents to docs/archive/",
                    )
                )
            elif entry.name not in _ALLOWED_DOC_FOLDERS:
                violations.append(
                    GuidanceViolation(
                        file=rel,
                        line=1,
                        message=f"docs/{entry.name}/ is not part of the canonical taxonomy "
                        "(standards, specs, plans, archive)",
                    )
                )
        elif entry.suffix == ".md":
            if entry.name == "README.md":
                continue
            if entry.name not in allowed_root_docs:
                violations.append(
                    GuidanceViolation(
                        file=rel,
                        line=1,
                        message=f"docs/{entry.name} is not a declared allowed_root_docs entry",
                    )
                )
    return violations


def _check_filename_convention(root: Path, exemptions: list[str]) -> list[GuidanceViolation]:
    violations: list[GuidanceViolation] = []
    docs_root = root / "docs"
    if not docs_root.is_dir():
        return violations

    for path in sorted(docs_root.rglob("*.md")):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue
        if path.name in _KEBAB_CASE_EXEMPT_NAMES:
            continue
        if not _KEBAB_CASE_RE.match(path.name):
            violations.append(
                GuidanceViolation(
                    file=rel,
                    line=1,
                    message=f"{path.name} is not lowercase kebab-case",
                )
            )
    return violations


def audit(
    root: Path,
    guidance_docs: list[str],
    max_lines: int,
    allowed_root_docs: list[str],
    exemptions: list[str],
) -> list[GuidanceViolation]:
    return (
        _check_guidance_doc_size(root, guidance_docs, max_lines, exemptions)
        + _check_layout_taxonomy(root, allowed_root_docs, exemptions)
        + _check_filename_convention(root, exemptions)
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S008", "Documentation Layout & Naming", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    violations = audit(
        root,
        config.audit_s008.guidance_docs,
        config.audit_s008.max_lines,
        config.audit_s008.allowed_root_docs,
        config.audit_s008.exemptions,
    )
    if violations:
        for violation in violations:
            reporter.start_check(f"Checking documentation layout for {violation.file}")
            reporter.fail_check(
                violation.message, file_path=violation.file, line=violation.line
            )
    else:
        reporter.start_check("Scanning guidance doc size, layout taxonomy, and filename convention")
        reporter.pass_check("guidance docs and documentation layout are compliant")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
