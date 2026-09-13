"""
Module:  audit_s001_duplicates.py
Layer:   bedrock/tools
Desc:    Enforcement for [S001-no-duplicate-ui-code](../../../../docs/standards/s001-no-duplicate-ui-code.md).

         Nothing under a consumer's UI source tree may re-implement the same
         exported symbol in more than one file. The failure this catches is
         not a bad component — it is a *second* one with the same name,
         written because nobody checked whether one already existed. The
         first copy costs nothing; the cost is that a fix lands in one of
         them six months later and the other keeps the bug.

         Exit 0 clean, 1 on a violation, 2 on a configuration error (an
         unreadable/malformed `bedrock.toml`).

Usage:   python -m bedrock.tools.audit_s001_duplicates --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import load_bedrock_config
from bedrock.tools._reporter import AuditReporter

#: Tests compose the very names they exercise; a fixture named `Button`
#: shadows nothing that ships.
_TEST_SUFFIXES = (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")

#: Names too generic to be evidence of anything.
_IGNORED_NAMES = frozenset({"default", "props", "Props"})

_EXPORT_DECL = re.compile(
    r"^\s*export\s+(?:default\s+)?(?:declare\s+)?"
    r"(?:const|let|var|function|class|interface|type|enum)\s+"
    r"([A-Za-z_$][\w$]*)",
    re.M,
)

#: Form/layout/grid primitives that must resolve through the barrel export.
_PRIMITIVE_NAMES = frozenset(
    {"Button", "Input", "Select", "Dialog", "Modal", "Tabs", "Popover", "Command", "DataGrid"}
)
_BARREL_SPECIFIER = "@djntechnic/bedrock-ui"

_IMPORT_STATEMENT = re.compile(
    r"import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+[\"']([^\"']+)[\"']"
)

#: Formatting called inline on a value rather than through a shared formatter.
_INLINE_FORMATTER = re.compile(
    r"\.(toLocaleDateString|toLocaleTimeString|toLocaleString|toFixed)\s*\("
)

#: A literal query-key array bypasses the app's single `queryKeys` factory.
_INLINE_QUERY_KEY = re.compile(r"queryKey:\s*\[")


@dataclass
class PrimitiveViolation:
    file: str
    line: int
    message: str


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def find_primitive_violations(root: Path, exemptions: list[str]) -> list[PrimitiveViolation]:
    """Non-duplicate-export S001 invariants: barrel-only primitives, shared
    formatters, and a single `queryKeys` factory instead of inline literals."""
    violations: list[PrimitiveViolation] = []

    for path in _source_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        text = path.read_text(encoding="utf-8", errors="replace")

        for match in _IMPORT_STATEMENT.finditer(text):
            names = {n.strip().split(" as ")[0].strip() for n in match.group(1).split(",")}
            specifier = match.group(2)
            if specifier == _BARREL_SPECIFIER:
                continue
            for name in names & _PRIMITIVE_NAMES:
                violations.append(
                    PrimitiveViolation(
                        file=rel,
                        line=_line_of(text, match.start()),
                        message=f"`{name}` imported from `{specifier}` instead of "
                        f"`{_BARREL_SPECIFIER}` - a local twin of a platform primitive",
                    )
                )

        for lineno, line in enumerate(text.splitlines(), start=1):
            if _INLINE_FORMATTER.search(line):
                violations.append(
                    PrimitiveViolation(
                        file=rel,
                        line=lineno,
                        message="inline date/number formatting - import a shared formatter "
                        "from lib/formatters or @djntechnic/bedrock-ui instead",
                    )
                )
            if _INLINE_QUERY_KEY.search(line):
                violations.append(
                    PrimitiveViolation(
                        file=rel,
                        line=lineno,
                        message="literal `queryKey` array - use the app's `queryKeys` "
                        "factory instead of a second inline key builder",
                    )
                )

    return violations


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _source_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        path
        for path in root.rglob("*")
        if path.suffix in {".ts", ".tsx"} and not path.name.endswith(_TEST_SUFFIXES)
    )


def _exports_of(path: Path) -> set[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    return {name for name in _EXPORT_DECL.findall(text) if name not in _IGNORED_NAMES}


def find_duplicate_exports(root: Path, exemptions: list[str]) -> dict[str, list[str]]:
    """Every exported symbol name declared in more than one non-exempt file."""
    owners: dict[str, list[str]] = {}

    for path in _source_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue
        for name in _exports_of(path):
            owners.setdefault(name, []).append(rel)

    return {name: files for name, files in owners.items() if len(files) > 1}


def audit(root: Path, exemptions: list[str]) -> dict[str, list[str]]:
    return find_duplicate_exports(root, exemptions)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter(
        "S001", "No Duplicate UI Code", root, root / "bedrock.toml"
    )

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    duplicates = audit(root, config.audit_s001.exemptions)
    if duplicates:
        for name, files in sorted(duplicates.items()):
            reporter.start_check(f"Checking for a single owner of `{name}`")
            reporter.fail_check(
                f"`{name}` is exported from {len(files)} files: {', '.join(files)}",
                hint="Compose around one shared export, or exempt the path in "
                "[tool.bedrock.audit.s001].exemptions if this is a deliberate fork.",
            )
    else:
        reporter.start_check("Scanning for duplicate exported UI symbols")
        reporter.pass_check("no duplicate exported symbols found")

    primitive_violations = find_primitive_violations(root, config.audit_s001.exemptions)
    if primitive_violations:
        for violation in primitive_violations:
            reporter.start_check(f"Checking platform primitive usage in {violation.file}:{violation.line}")
            reporter.fail_check(
                violation.message, file_path=violation.file, line=violation.line
            )
    else:
        reporter.start_check("Scanning for barrel-bypassing primitives, formatters, and query keys")
        reporter.pass_check("no local primitive twins found")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
