"""
Module:  s001_audit_duplicates.py
Layer:   bedrock/tools
Desc:    Enforcement for [S001-no-duplicate-ui-code](../../../../docs/standards/s001-no-duplicate-ui-code.md).

         Invariants checked:
           1. No duplicate exported UI symbols across non-exempt files.
           2. Deliberate local forks are permitted only with an explicit
              `@shadows <Name>` marker in the file header.
           3. Form and layout primitives (Button, Input, etc.) must resolve
              through the `@djntechnic/bedrock-ui` barrel, not hand-rolled twins.
           4. No inline date/number formatting; must use shared formatters.
           5. No literal `queryKey: [...]` arrays; must use `queryKeys` factory.
           6. At most one `queryKeys` factory and one `API_ROUTES` map per app.
           7. No bare `axios` imports; must use platform `apiClient`.
           8. No unshadowed symbol collision with installed `@djntechnic/bedrock-ui`
              exports if package is present.

         Exit 0 clean, 1 on a violation, 2 on a configuration error (an
         unreadable/malformed `bedrock.toml`).

Usage:   python -m bedrock.tools.s001_audit_duplicates --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import DEFAULT_IGNORED_DIRS, iter_source_files, load_bedrock_config
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

_SHADOWS = re.compile(r"@shadows\s+([A-Za-z_$][\w$]*)")

_AXIOS_IMPORT = re.compile(
    r'^\s*import\s+(?!type\b)(?:axios\b|\*\s+as\s+\w+)[^;]*?from\s+["\']axios["\']',
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

_EXPORT_STAR = re.compile(r'^\s*export\s+\*\s+from\s+["\'](\.[^"\']+)["\']', re.M)
_EXPORT_NAMED_FROM = re.compile(
    r'^\s*export\s+\{([^}]*)\}\s+from\s+["\'](\.[^"\']+)["\']', re.M | re.S
)


@dataclass
class PrimitiveViolation:
    file: str
    line: int
    message: str


def _line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    if any(part in DEFAULT_IGNORED_DIRS for part in Path(rel_path).parts):
        return True
    if any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions):
        return True
    return any(part in exemptions for part in Path(rel_path).parts)


def _source_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        path
        for path in iter_source_files(root, (".ts", ".tsx"))
        if not path.name.endswith(_TEST_SUFFIXES)
        and not path.name.endswith(".d.ts")
    )


def _exports_of(path: Path) -> set[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    return {name for name in _EXPORT_DECL.findall(text) if name not in _IGNORED_NAMES}


def _shadows_of(path: Path) -> set[str]:
    text = path.read_text(encoding="utf-8", errors="replace")
    return set(_SHADOWS.findall(text))


def find_duplicate_exports(root: Path, exemptions: list[str]) -> dict[str, list[str]]:
    """Every exported symbol name declared in more than one non-exempt file,
    unless explicitly marked with `@shadows <Name>`."""
    owners: dict[str, list[str]] = {}

    for path in _source_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue
        shadowed = _shadows_of(path)
        for name in _exports_of(path):
            if name in shadowed:
                continue
            owners.setdefault(name, []).append(rel)

    return {name: files for name, files in owners.items() if len(files) > 1}


def find_primitive_violations(root: Path, exemptions: list[str]) -> list[PrimitiveViolation]:
    """Non-duplicate-export S001 invariants: barrel-only primitives, shared
    formatters, a single `queryKeys` factory instead of inline literals, and
    banning raw `axios` imports."""
    violations: list[PrimitiveViolation] = []

    for path in _source_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        text = path.read_text(encoding="utf-8", errors="replace")

        # Check for bare axios imports
        for match in _AXIOS_IMPORT.finditer(text):
            violations.append(
                PrimitiveViolation(
                    file=rel,
                    line=_line_of(text, match.start()),
                    message="direct axios import - use the platform's apiClient instead",
                )
            )

        # Check for primitive imports from non-barrel specifiers
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

        # Check inline formatters and query keys
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


def find_registry_violations(root: Path, exemptions: list[str]) -> list[str]:
    """Ensure at most one queryKeys factory and at most one API_ROUTES map."""
    violations: list[str] = []
    source_files = _source_files(root)

    for symbol, label in (("queryKeys", "query-key factory"), ("API_ROUTES", "route map")):
        pattern = re.compile(rf"^\s*export\s+const\s+{symbol}\b", re.M)
        owners = [
            path.relative_to(root).as_posix()
            for path in source_files
            if not _is_exempt(path.relative_to(root).as_posix(), exemptions)
            and pattern.search(path.read_text(encoding="utf-8", errors="replace"))
        ]
        if len(owners) > 1:
            violations.append(
                f"{len(owners)} files declare `export const {symbol}`: "
                f"{', '.join(owners)}. There must be at most one {label}."
            )
    return violations


def find_platform_package_collisions(
    root: Path, exemptions: list[str], package_name: str = _BARREL_SPECIFIER
) -> list[str]:
    """Detect unshadowed collisions with installed platform exports."""
    # Look for node_modules
    candidates = [
        root / "node_modules",
        root / "frontend" / "node_modules",
        root / "packages" / "bedrock-ui",
    ]
    package_dir: Path | None = None
    for candidate in candidates:
        pkg = candidate / package_name if not candidate.name == "bedrock-ui" else candidate
        if pkg.is_dir() and (pkg / "package.json").is_file():
            package_dir = pkg
            break

    if not package_dir:
        return []

    # Attempt to read barrel exports
    try:
        manifest = json.loads((package_dir / "package.json").read_text(encoding="utf-8"))
        entry = manifest.get("exports", {}).get(".", {}).get("import") or manifest.get("main", "src/index.ts")
        if isinstance(manifest.get("exports", {}).get("."), str):
            entry = manifest["exports"]["."]
        barrel_file = package_dir / entry
        if not barrel_file.is_file():
            return []
        barrel_text = barrel_file.read_text(encoding="utf-8", errors="replace")
        platform_exports = set(_EXPORT_DECL.findall(barrel_text)) - _IGNORED_NAMES
    except Exception:
        return []

    if not platform_exports:
        return []

    collision_dirs = ["components", "pages", "frontend/src/components", "frontend/src/pages"]
    violations: list[str] = []
    for cd in collision_dirs:
        dir_path = root / cd
        if not dir_path.is_dir():
            continue
        for path in _source_files(dir_path):
            rel = path.relative_to(root).as_posix()
            if _is_exempt(rel, exemptions):
                continue
            shadowed = _shadows_of(path)
            for name in sorted(_exports_of(path) & platform_exports):
                if name not in shadowed:
                    violations.append(
                        f"{rel} exports `{name}`, which {package_name} already exports. "
                        f"Compose around the platform component or declare `@shadows {name}`."
                    )
    return violations


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

    exemptions = config.audit_s001.exemptions

    duplicates = audit(root, exemptions)
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

    primitive_violations = find_primitive_violations(root, exemptions)
    if primitive_violations:
        for violation in primitive_violations:
            reporter.start_check(f"Checking platform primitive usage in {violation.file}:{violation.line}")
            reporter.fail_check(
                violation.message, file_path=violation.file, line=violation.line
            )
    else:
        reporter.start_check("Scanning for barrel-bypassing primitives, formatters, and query keys")
        reporter.pass_check("no local primitive twins found")

    registry_violations = find_registry_violations(root, exemptions)
    if registry_violations:
        for violation in registry_violations:
            reporter.start_check("Checking singleton factories (queryKeys, API_ROUTES)")
            reporter.fail_check(violation)
    else:
        reporter.start_check("Checking singleton factories (queryKeys, API_ROUTES)")
        reporter.pass_check("singleton factories verified")

    collision_violations = find_platform_package_collisions(root, exemptions)
    if collision_violations:
        for violation in collision_violations:
            reporter.start_check("Checking for collisions against installed platform package")
            reporter.fail_check(violation)
    else:
        reporter.start_check("Checking for collisions against installed platform package")
        reporter.pass_check("no platform collisions found")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
