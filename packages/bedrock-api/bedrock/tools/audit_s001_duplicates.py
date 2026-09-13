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

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
