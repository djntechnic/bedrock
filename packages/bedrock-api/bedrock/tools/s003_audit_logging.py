"""
Module:  audit_s003_logging.py
Layer:   bedrock/tools
Desc:    Enforcement for [S003-logging-protocol](../../../../docs/standards/s003-logging-protocol.md).

         `console.*` and bare `print()` cannot be filtered, correlated, or
         shipped to a log aggregator without a second pass over the codebase.
         This is a regex scan, not a full parser, because the failure mode is
         syntactic: a bare call site, wherever it appears.

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.audit_s003_logging --root .
"""
from __future__ import annotations

import argparse
import fnmatch
from dataclasses import dataclass
from pathlib import Path

import re

from bedrock.tools._config import DEFAULT_IGNORED_DIRS, iter_source_files, load_bedrock_config
from bedrock.tools._reporter import AuditReporter

_TEST_SUFFIXES = (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")

_CONSOLE_CALL = re.compile(r"\bconsole\.(log|warn|error|debug|info)\s*\(")
_PRINT_CALL = re.compile(r"(?<![\w.])print\s*\(")


def _is_python_test_file(rel_path: str) -> bool:
    path = Path(rel_path)
    return "tests" in path.parts or path.name.startswith("test_")


@dataclass
class LoggingViolation:
    file: str
    line: int
    message: str


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    if any(part in DEFAULT_IGNORED_DIRS for part in Path(rel_path).parts):
        return True
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _frontend_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        path
        for path in iter_source_files(root, (".ts", ".tsx"))
        if not path.name.endswith(_TEST_SUFFIXES)
    )


def _backend_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(iter_source_files(root, (".py",)))


def audit(root: Path, exemptions: list[str]) -> list[LoggingViolation]:
    violations: list[LoggingViolation] = []

    for path in _frontend_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), start=1):
            match = _CONSOLE_CALL.search(line)
            if match:
                violations.append(
                    LoggingViolation(
                        file=rel,
                        line=lineno,
                        message=f"bare console.{match.group(1)}(...) call - use "
                        "the `log` export from @djntechnic/bedrock-ui",
                    )
                )

    for path in _backend_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions) or _is_python_test_file(rel):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if _PRINT_CALL.search(line):
                violations.append(
                    LoggingViolation(
                        file=rel,
                        line=lineno,
                        message="bare print(...) call - use `from loguru import logger`",
                    )
                )

    return violations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S003", "Logging Protocol", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    violations = audit(root, config.audit_s003.exemptions)
    if violations:
        for violation in violations:
            reporter.start_check(f"Checking logging calls in {violation.file}:{violation.line}")
            reporter.fail_check(
                violation.message, file_path=violation.file, line=violation.line
            )
    else:
        reporter.start_check("Scanning for bare console.* and print() calls")
        reporter.pass_check("no bare console.* or print() calls found")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
