"""
Module:  audit_s007_schema_catalog.py
Layer:   bedrock/tools
Desc:    Enforcement for [S007-schema-catalog](../../../../docs/standards/s007-schema-catalog.md).

         Three checks:
           1. Single-source catalog - application Python code (outside
              `schema_catalog.py`, migrations, and exempted paths) does not
              reference a bare table/view string literal that should instead
              go through `Tables.<SYMBOL>` / `Views.<SYMBOL>`.
           2. Object naming - every `CREATE TABLE` in `schema/baseline.sql` or
              `schema/migrations/*.sql` uses `<domain>_<entity>` snake_case
              with an approved platform prefix (`auth_`, `app_`, `sys_`,
              `log_`, `diag_`) or a declared consumer domain prefix.
           3. Mandatory audit columns - every such table defines `created_at`,
              `created_by`, `modified_at`, `modified_by`, and `is_active`.

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.audit_s007_schema_catalog --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import DEFAULT_IGNORED_DIRS, iter_source_files, load_bedrock_config
from bedrock.tools._reporter import AuditReporter

_PLATFORM_PREFIXES = ("auth_", "app_", "sys_", "log_", "diag_")
_REQUIRED_AUDIT_COLUMNS = ("created_at", "created_by", "modified_at", "modified_by", "is_active")

_CREATE_TABLE_RE = re.compile(
    r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\"'`]?(?P<name>\w+)[\"'`]?\s*\((?P<body>.*?)\)\s*;",
    re.IGNORECASE | re.DOTALL,
)
_TABLE_NAME_RE = re.compile(r"^[a-z][a-z0-9_]*[a-z0-9]$")

# Only the clauses that actually name a table/view are load-bearing here
# (FROM/INTO/UPDATE/JOIN) — matching straight after SELECT instead grabs the
# first column of the select-list, and matching any quoted word grabs English
# prose in docstrings ("""Update whitelisted fields..."""). Keywords are
# matched case-sensitively: every real query in this codebase spells them
# uppercase, while prose that happens to contain "from"/"update" (docstrings,
# `from x import y`) does not, so casing alone tells SQL from English. A
# literal is only a *table* literal if it also carries one of the platform's
# approved prefixes; SQLite catalog tables (sqlite_master, sqlite_schema) and
# column names/aliases never do, so anchoring on the prefix set keeps both
# classes of noise out without an exemption list.
_BARE_LITERAL_RE = re.compile(
    r"[\"'][^\"']*\b(?:FROM|INTO|UPDATE|JOIN)\s+([a-z][a-z0-9_]*)\b"
)


@dataclass
class SchemaViolation:
    file: str
    line: int
    message: str


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    if any(part in DEFAULT_IGNORED_DIRS for part in Path(rel_path).parts):
        return True
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _allowed_prefixes(domain_prefixes: list[str]) -> tuple[str, ...]:
    return _PLATFORM_PREFIXES + tuple(
        p if p.endswith("_") else f"{p}_" for p in domain_prefixes
    )


_ALIAS_IMPORT_RE = re.compile(
    r"from\s+bedrock\.core\.schema_catalog\s+import\s+(.+)"
)


def _catalog_aliases(text: str) -> set[str]:
    """Names this file binds Tables/Views to (default names plus any `as` alias)."""
    aliases = {"Tables", "Views"}
    for match in _ALIAS_IMPORT_RE.finditer(text):
        for part in match.group(1).split(","):
            part = part.strip()
            name, _, alias = part.partition(" as ")
            name = name.strip()
            if name in ("Tables", "Views") and alias.strip():
                aliases.add(alias.strip())
    return aliases


def _check_bare_literals(
    root: Path, domain_prefixes: list[str], exemptions: list[str]
) -> list[SchemaViolation]:
    violations: list[SchemaViolation] = []
    if not root.is_dir():
        return violations

    allowed_prefixes = _allowed_prefixes(domain_prefixes)

    for path in iter_source_files(root, (".py",)):
        rel = path.relative_to(root).as_posix()
        if path.name == "schema_catalog.py" or _is_exempt(rel, exemptions):
            continue
        if "schema/migrations" in rel or "schema\\migrations" in rel:
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        aliases = _catalog_aliases(text)
        for lineno, line in enumerate(text.splitlines(), start=1):
            match = _BARE_LITERAL_RE.search(line)
            if not match:
                continue
            name = match.group(1)
            if not name.startswith(allowed_prefixes):
                continue
            if any(f"{alias}." in line for alias in aliases):
                continue
            violations.append(
                SchemaViolation(
                    file=rel,
                    line=lineno,
                    message=f"bare table/view literal '{name}' - "
                    "reference it through Tables.<SYMBOL> / Views.<SYMBOL> instead",
                )
            )
    return violations


def _iter_create_tables(root: Path) -> list[tuple[str, str, str]]:
    """Returns (rel_file, table_name, column_body) for every CREATE TABLE found."""
    results: list[tuple[str, str, str]] = []
    for pattern in ("schema/baseline.sql", "schema/migrations/*.sql"):
        for path in sorted(root.glob(pattern)):
            rel = path.relative_to(root).as_posix()
            text = path.read_text(encoding="utf-8", errors="replace")
            for match in _CREATE_TABLE_RE.finditer(text):
                results.append((rel, match.group("name"), match.group("body")))
    return results


def _check_naming_and_audit_columns(
    root: Path, domain_prefixes: list[str], grandfathered: list[str], exemptions: list[str]
) -> list[SchemaViolation]:
    violations: list[SchemaViolation] = []
    allowed_prefixes = _allowed_prefixes(domain_prefixes)

    for rel, table_name, body in _iter_create_tables(root):
        if _is_exempt(rel, exemptions) or table_name in grandfathered:
            continue

        if not _TABLE_NAME_RE.match(table_name) or not table_name.startswith(allowed_prefixes):
            violations.append(
                SchemaViolation(
                    file=rel,
                    line=1,
                    message=f"table '{table_name}' does not use a snake_case "
                    "<domain>_<entity> name with an approved prefix",
                )
            )
            continue

        body_lower = body.lower()
        missing = [col for col in _REQUIRED_AUDIT_COLUMNS if col not in body_lower]
        if missing:
            violations.append(
                SchemaViolation(
                    file=rel,
                    line=1,
                    message=f"table '{table_name}' is missing mandatory audit column(s): "
                    + ", ".join(missing),
                )
            )
    return violations


def audit(
    root: Path, domain_prefixes: list[str], grandfathered: list[str], exemptions: list[str]
) -> list[SchemaViolation]:
    return _check_bare_literals(root, domain_prefixes, exemptions) + _check_naming_and_audit_columns(
        root, domain_prefixes, grandfathered, exemptions
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S007", "Schema Catalog & Database Object Standards", root, root / "bedrock.toml")

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
        config.audit_s007.domain_prefixes,
        config.audit_s007.grandfathered_tables,
        config.audit_s007.exemptions,
    )
    if violations:
        for violation in violations:
            reporter.start_check(f"Checking schema catalog compliance in {violation.file}")
            reporter.fail_check(
                violation.message, file_path=violation.file, line=violation.line
            )
    else:
        reporter.start_check("Scanning for bare literals, naming, and audit-column violations")
        reporter.pass_check("schema catalog is single-sourced and every table is compliant")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
