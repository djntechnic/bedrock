"""
Module:  audit_s002_grids.py
Layer:   bedrock/tools
Desc:    Enforcement for [S002-all-grids-wired-to-admin-config](../../../../docs/standards/s002-all-grids-wired-to-admin-config.md).

         Every `<DataGrid gridId="…">` must be backed by a matching
         `useGridConfig("…")` call in the same file — a grid that renders
         without reading its own config looks wired until an admin edits the
         Grid Editor and nothing happens. A raw `<table>` element outside the
         `presentational_tables` allowlist is the same failure in a cruder
         shape: a tabular surface that bypassed the engine entirely.

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.audit_s002_grids --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import load_bedrock_config
from bedrock.tools._reporter import AuditReporter

_TEST_SUFFIXES = (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")

_DATA_GRID_ID = re.compile(r"<DataGrid\b[^>]*\bgridId=[\"'{]+([\w-]+)[\"'}]*")
_USE_GRID_CONFIG_ID = re.compile(r"useGridConfig\(\s*[\"']([\w-]+)[\"']")
_RAW_TABLE = re.compile(r"<table\b")


@dataclass
class GridWiringViolation:
    file: str
    message: str


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _source_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        path
        for path in root.rglob("*")
        if path.suffix in {".tsx"} and not path.name.endswith(_TEST_SUFFIXES)
    )


def audit(
    root: Path, presentational_tables: list[str], exemptions: list[str]
) -> list[GridWiringViolation]:
    violations: list[GridWiringViolation] = []

    for path in _source_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        text = path.read_text(encoding="utf-8", errors="replace")

        grid_ids = set(_DATA_GRID_ID.findall(text))
        configured_ids = set(_USE_GRID_CONFIG_ID.findall(text))
        for grid_id in sorted(grid_ids - configured_ids):
            violations.append(
                GridWiringViolation(
                    file=rel,
                    message=(
                        f"<DataGrid gridId=\"{grid_id}\"> has no matching "
                        f"useGridConfig(\"{grid_id}\") call in {rel}."
                    ),
                )
            )

        if _RAW_TABLE.search(text) and rel not in presentational_tables:
            violations.append(
                GridWiringViolation(
                    file=rel,
                    message=(
                        f"{rel} renders a raw <table> element. Use <DataGrid> or "
                        "add this file to [tool.bedrock.audit.s002]."
                        "presentational_tables if it is a deliberate read-only surface."
                    ),
                )
            )

    return violations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    parser.add_argument("--diff", action="store_true", help="unused; reserved for parity with the standard's documented CLI")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter(
        "S002", "All Grids Wired to Admin Config", root, root / "bedrock.toml"
    )

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    violations = audit(
        root, config.audit_s002.presentational_tables, config.audit_s002.exemptions
    )
    if violations:
        for violation in violations:
            reporter.start_check(f"Checking grid wiring in {violation.file}")
            reporter.fail_check(violation.message, file_path=violation.file)
    else:
        reporter.start_check("Scanning DataGrid usage and raw table elements")
        reporter.pass_check("every grid is wired to useGridConfig; no unexempted raw tables")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
