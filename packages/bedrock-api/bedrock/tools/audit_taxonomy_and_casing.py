"""
Module:  audit_taxonomy_and_casing.py
Layer:   bedrock/tools
Desc:    Documentation taxonomy and filename-casing validator, shared across
         bedrock and its consumers.

         Two checks:
           1. Documentation taxonomy - every entry directly under `docs/`
              (and `Templates/` / `Exports/` at the repo root) resolves to
              one of the approved folders (`standards`, `specs`, `plans`,
              `archive`, `reference`). Deprecated or forbidden directories
              (`docs/punchlists`, `docs/project/punchlists`, `docs/artifacts`,
              `docs/working files`, uppercase `Templates/`, uppercase
              `Exports/`) are always flagged.
           2. Lowercase kebab-case filenames - files under `docs/` and
              `templates/` must match
              `^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.(md|html|json|csv)$`, except the
              canonical uppercase exemptions (`README.md`, `CLAUDE.md`,
              `GEMINI.md`, `CHANGELOG.md`, `LICENSE.md`).

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.audit_taxonomy_and_casing --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import load_bedrock_config
from bedrock.tools._reporter import AuditReporter

APPROVED_DOC_FOLDERS = {"standards", "specs", "plans", "archive", "reference"}
DEPRECATED_DOC_DIRS = {"docs/punchlists", "docs/project/punchlists", "docs/artifacts", "docs/working files"}
DEPRECATED_ROOT_DIRS = {"Templates", "Exports"}
CASING_EXEMPT_NAMES = {"README.md", "CLAUDE.md", "GEMINI.md", "CHANGELOG.md", "LICENSE.md"}
KEBAB_CASE_RE = re.compile(r"^[a-z0-9-]+(\.[a-z0-9-]+)*\.(md|html|json|csv)$")


@dataclass
class TaxonomyViolation:
    file: str
    message: str


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _check_taxonomy(root: Path, exemptions: list[str]) -> list[TaxonomyViolation]:
    violations: list[TaxonomyViolation] = []
    docs_root = root / "docs"

    if docs_root.is_dir():
        for entry in sorted(docs_root.iterdir()):
            if not entry.is_dir():
                continue
            rel = entry.relative_to(root).as_posix()
            if _is_exempt(rel, exemptions):
                continue
            if rel in DEPRECATED_DOC_DIRS or entry.name == "punchlists":
                violations.append(
                    TaxonomyViolation(rel, f"{rel}/ is a deprecated directory")
                )
            elif entry.name not in APPROVED_DOC_FOLDERS:
                violations.append(
                    TaxonomyViolation(
                        rel,
                        f"{rel}/ is not part of the canonical taxonomy "
                        "(standards, specs, plans, archive, reference)",
                    )
                )

        project_punchlists = docs_root / "project" / "punchlists"
        rel = project_punchlists.relative_to(root).as_posix()
        if project_punchlists.is_dir() and not _is_exempt(rel, exemptions):
            violations.append(TaxonomyViolation(rel, f"{rel}/ is a deprecated directory"))

    for name in DEPRECATED_ROOT_DIRS:
        candidate = root / name
        rel = candidate.relative_to(root).as_posix()
        if candidate.is_dir() and not _is_exempt(rel, exemptions):
            violations.append(TaxonomyViolation(rel, f"{rel}/ is a forbidden uppercase directory"))

    return violations


def _check_casing(root: Path, exemptions: list[str]) -> list[TaxonomyViolation]:
    violations: list[TaxonomyViolation] = []
    for base_dir in ("docs", "templates"):
        base = root / base_dir
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if path.is_dir():
                continue
            rel = path.relative_to(root).as_posix()
            if _is_exempt(rel, exemptions):
                continue
            if path.name in CASING_EXEMPT_NAMES:
                continue
            if not KEBAB_CASE_RE.match(path.name):
                violations.append(TaxonomyViolation(rel, f"{path.name} is not lowercase kebab-case"))
    return violations


def audit(root: Path, exemptions: list[str]) -> list[TaxonomyViolation]:
    return _check_taxonomy(root, exemptions) + _check_casing(root, exemptions)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("TAXONOMY", "Documentation Taxonomy & Casing", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    violations = audit(root, config.audit_s008.exemptions)
    if violations:
        for violation in violations:
            reporter.start_check(f"Checking taxonomy/casing for {violation.file}")
            reporter.fail_check(violation.message, file_path=violation.file)
    else:
        reporter.start_check("Scanning documentation taxonomy and kebab-case filenames")
        reporter.pass_check("taxonomy and casing are compliant")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
