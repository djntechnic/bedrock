"""
Module:  audit_s004_config.py
Layer:   bedrock/tools
Desc:    Enforcement for [S004-no-hardcoded-config-settings](../../../../docs/standards/s004-no-hardcoded-config-settings.md).

         Configuration scattered across `os.environ` reads and hardcoded
         literals cannot be audited or changed without a deploy. This scans
         backend Python source for two shapes of that failure: a raw
         `os.environ` read bypassing `db.get_config`/`db.set_config`, and a
         module-level literal assigned to a name that reads like a secret or
         setting (`API_KEY = "..."`, `DB_PASSWORD = "..."`).

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.audit_s004_config --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import DEFAULT_IGNORED_DIRS, iter_source_files, load_bedrock_config
from bedrock.tools._reporter import AuditReporter

_RAW_ENVIRON = re.compile(r"\bos\.(?:environ\b|getenv\s*\()")
_HARDCODED_SETTING = re.compile(
    r"^\s*[A-Z][A-Z0-9_]*(?:_KEY|_SECRET|_PASSWORD|_TOKEN)\s*=\s*[\"'][^\"']+[\"']",
    re.M,
)
_GET_CONFIG_CALL = re.compile(r"\bget_config\(([^)]*)\)")
_HARDCODED_TOOLTIP_DELAY = re.compile(r"\bdelayDuration=\{\s*\d+\s*\}")

_TEST_SUFFIXES = (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")


@dataclass
class ConfigViolation:
    file: str
    line: int
    message: str


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    if any(part in DEFAULT_IGNORED_DIRS for part in Path(rel_path).parts):
        return True
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _backend_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(iter_source_files(root, (".py",)))


def _frontend_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        path
        for path in iter_source_files(root, (".ts", ".tsx"))
        if not path.name.endswith(_TEST_SUFFIXES)
    )


def audit(root: Path, exemptions: list[str]) -> list[ConfigViolation]:
    violations: list[ConfigViolation] = []

    for path in _backend_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if _RAW_ENVIRON.search(line):
                violations.append(
                    ConfigViolation(
                        file=rel,
                        line=lineno,
                        message="raw os.environ read - use db.get_config(key, default) instead",
                    )
                )
            if _HARDCODED_SETTING.match(line):
                violations.append(
                    ConfigViolation(
                        file=rel,
                        line=lineno,
                        message="hardcoded secret/setting literal - use the typed config surface",
                    )
                )
            match = _GET_CONFIG_CALL.search(line)
            if match and "," not in match.group(1):
                violations.append(
                    ConfigViolation(
                        file=rel,
                        line=lineno,
                        message="get_config(...) call missing a default argument - "
                        "every call site must supply db.get_config(key, default)",
                    )
                )

    for path in _frontend_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if _HARDCODED_TOOLTIP_DELAY.search(line):
                violations.append(
                    ConfigViolation(
                        file=rel,
                        line=lineno,
                        message="TooltipProvider delayDuration is a hardcoded literal - "
                        "bind it to the resolved app settings value instead",
                    )
                )

    return violations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter(
        "S004", "No Hardcoded Config Settings", root, root / "bedrock.toml"
    )

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    violations = audit(root, config.audit_s004.exemptions)
    if violations:
        for violation in violations:
            reporter.start_check(f"Checking config access in {violation.file}:{violation.line}")
            reporter.fail_check(
                violation.message, file_path=violation.file, line=violation.line
            )
    else:
        reporter.start_check("Scanning for raw os.environ reads and hardcoded settings")
        reporter.pass_check("no raw os.environ reads or hardcoded settings found")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
