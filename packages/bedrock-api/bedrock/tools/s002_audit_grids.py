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

from bedrock.tools._config import DEFAULT_IGNORED_DIRS, load_bedrock_config
from bedrock.tools._reporter import AuditReporter

_TEST_SUFFIXES = (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")

_DATA_GRID_ID = re.compile(r"<DataGrid\b[^>]*\bgridId=[\"'{]+([\w-]+)[\"'}]*")
_USE_GRID_CONFIG_ID = re.compile(r"useGridConfig\(\s*[\"']([\w-]+)[\"']")
_RAW_TABLE = re.compile(r"<table\b")

_INSERT_GRID_SETTINGS = re.compile(
    r"INSERT\s+INTO\s+app_grid_settings\s*\(([^)]*)\)\s*VALUES\s*(.+?);",
    re.IGNORECASE | re.DOTALL,
)
_INSERT_GRID_COLUMN_SETTINGS = re.compile(
    r"INSERT\s+INTO\s+app_grid_column_settings\s*\(([^)]*)\)\s*VALUES\s*(.+?);",
    re.IGNORECASE | re.DOTALL,
)


@dataclass
class GridWiringViolation:
    file: str
    message: str
    line: int | None = None
    hint: str | None = None


def _split_balanced(text: str, sep: str = ",") -> list[str]:
    """Split `text` on top-level `sep`, respecting nested (), [], {} and
    quoted strings so a comma inside a value/object doesn't split early."""
    parts: list[str] = []
    current: list[str] = []
    depth = 0
    quote: str | None = None
    i = 0
    while i < len(text):
        ch = text[i]
        if quote:
            current.append(ch)
            if ch == quote and text[i - 1] != "\\":
                quote = None
        elif ch in ("'", '"', "`"):
            quote = ch
            current.append(ch)
        elif ch in "([{":
            depth += 1
            current.append(ch)
        elif ch in ")]}":
            depth -= 1
            current.append(ch)
        elif ch == sep and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(ch)
        i += 1
    if current:
        parts.append("".join(current))
    return [p.strip() for p in parts if p.strip()]


def _parse_sql_scalar(raw: str) -> str | None:
    raw = raw.strip()
    if raw.upper() == "NULL":
        return None
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in ("'", '"'):
        return raw[1:-1].replace(raw[0] * 2, raw[0])
    return raw


def _extract_insert_rows(text: str, pattern: re.Pattern) -> list[tuple[dict[str, str | None], int]]:
    """Return `(row_dict, line_number)` for every row inserted by a matching
    `INSERT INTO ... (cols) VALUES (...), (...);` statement in `text`."""
    rows: list[tuple[dict[str, str | None], int]] = []
    for match in pattern.finditer(text):
        columns = [c.strip().strip("`\"[]") for c in match.group(1).split(",")]
        line = text[: match.start()].count("\n") + 1
        for row_group in _split_balanced(match.group(2), ","):
            row_group = row_group.strip()
            if row_group.startswith("(") and row_group.endswith(")"):
                row_group = row_group[1:-1]
            values = [_parse_sql_scalar(v) for v in _split_balanced(row_group, ",")]
            rows.append((dict(zip(columns, values)), line))
    return rows


def _extract_call_args(text: str, call_name: str) -> list[str]:
    """Return the raw argument text for every `call_name(...)` invocation,
    matching parens/brackets/braces/strings so nested commas don't cut it short."""
    results: list[str] = []
    token = call_name + "("
    search_from = 0
    while True:
        idx = text.find(token, search_from)
        if idx == -1:
            break
        arg_start = idx + len(token)
        depth = 1
        i = arg_start
        quote: str | None = None
        while i < len(text) and depth > 0:
            ch = text[i]
            if quote:
                if ch == quote and text[i - 1] != "\\":
                    quote = None
            elif ch in ("'", '"', "`"):
                quote = ch
            elif ch in "([{":
                depth += 1
            elif ch in ")]}":
                depth -= 1
            i += 1
        results.append(text[arg_start : i - 1])
        search_from = i
    return results


def _top_level_array_keys(obj_text: str) -> dict[str, bool]:
    """Given the text of a `{ key: [...], key2: [...] }` object literal,
    return `{key: has_non_empty_array}` for each top-level key bound to an
    array literal."""
    text = obj_text.strip()
    if text.startswith("{") and text.endswith("}"):
        text = text[1:-1]
    entries: dict[str, bool] = {}
    for entry in _split_balanced(text, ","):
        match = re.match(r"^[\"']?([\w-]+)[\"']?\s*:\s*\[([\s\S]*)\]\s*$", entry.strip())
        if match:
            key, inner = match.group(1), match.group(2).strip()
            entries[key] = bool(inner)
    return entries


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    if any(part in DEFAULT_IGNORED_DIRS for part in Path(rel_path).parts):
        return True
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _source_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        path
        for path in root.rglob("*")
        if path.suffix in {".tsx"}
        and not path.name.endswith(_TEST_SUFFIXES)
        and not any(part in DEFAULT_IGNORED_DIRS for part in path.parts)
    )


def _ts_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        path
        for path in root.rglob("*")
        if path.suffix in {".ts", ".tsx"}
        and not path.name.endswith(_TEST_SUFFIXES)
        and not any(part in DEFAULT_IGNORED_DIRS for part in path.parts)
    )


def _sql_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        path
        for path in root.rglob("*.sql")
        if not any(part in DEFAULT_IGNORED_DIRS for part in path.parts)
    )


def _collect_wired_preview_grid_ids(root: Path, exemptions: list[str]) -> dict[str, bool]:
    """Scan every non-exempt `.ts`/`.tsx` file for `registerApiPreviewEndpoints(...)`
    calls and return `{grid_id: has_non_empty_binding_array}`."""
    wired: dict[str, bool] = {}
    for path in _ts_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for call_args in _extract_call_args(text, "registerApiPreviewEndpoints"):
            for grid_id, has_bindings in _top_level_array_keys(call_args).items():
                wired[grid_id] = wired.get(grid_id, False) or has_bindings
    return wired


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
                    hint=f'Add const config = useGridConfig("{grid_id}") in {rel}.',
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

    wired_grid_ids = _collect_wired_preview_grid_ids(root, exemptions)

    for path in _sql_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        text = path.read_text(encoding="utf-8", errors="replace")

        known_columns: set[str] = {
            column_id
            for row, _line in _extract_insert_rows(text, _INSERT_GRID_COLUMN_SETTINGS)
            if (column_id := row.get("column_id"))
        }

        for row, line in _extract_insert_rows(text, _INSERT_GRID_SETTINGS):
            grid_id = row.get("grid_id")
            if not grid_id:
                continue
            if grid_id in presentational_tables or rel in presentational_tables:
                continue

            page = row.get("page")
            if "page" not in row or not (page or "").strip():
                violations.append(
                    GridWiringViolation(
                        file=rel,
                        line=line,
                        message=(
                            f"grid '{grid_id}' in app_grid_settings has no non-empty "
                            "`page` attribute for admin grouping."
                        ),
                        hint=(
                            "Set page = '<Screen Name>' on this app_grid_settings row "
                            "so the admin Grid Editor can group it under a screen."
                        ),
                    )
                )

            row_key_column = row.get("row_key_column")
            if "row_key_column" not in row or not (row_key_column or "").strip():
                violations.append(
                    GridWiringViolation(
                        file=rel,
                        line=line,
                        message=(
                            f"grid '{grid_id}' in app_grid_settings has a null/empty "
                            "`row_key_column`."
                        ),
                        hint=(
                            "Set row_key_column to the column_id that uniquely "
                            "identifies each row (e.g. 'player_id')."
                        ),
                    )
                )
            elif known_columns and row_key_column not in known_columns:
                violations.append(
                    GridWiringViolation(
                        file=rel,
                        line=line,
                        message=(
                            f"grid '{grid_id}' declares row_key_column="
                            f"'{row_key_column}', which is not among its "
                            f"app_grid_column_settings column_id values "
                            f"({', '.join(sorted(known_columns))})."
                        ),
                        hint="Point row_key_column at a column_id inserted for this grid.",
                    )
                )

            if not wired_grid_ids.get(grid_id, False):
                reason = "is not registered" if grid_id not in wired_grid_ids else "has no bindings"
                violations.append(
                    GridWiringViolation(
                        file=rel,
                        line=line,
                        message=(
                            f"grid '{grid_id}' {reason} in registerApiPreviewEndpoints; "
                            "the Admin Grid Preview pane has no API endpoint to render."
                        ),
                        hint=(
                            f"Call registerApiPreviewEndpoints({{ {grid_id}: [...] }}) "
                            "with at least one ApiEndpointBinding."
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
            reporter.fail_check(
                violation.message,
                file_path=violation.file,
                line=violation.line,
                hint=violation.hint,
            )
    else:
        reporter.start_check("Scanning DataGrid usage and raw table elements")
        reporter.pass_check("every grid is wired to useGridConfig; no unexempted raw tables")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
