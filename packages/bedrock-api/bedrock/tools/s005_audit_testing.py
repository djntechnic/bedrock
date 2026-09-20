"""
Module:  audit_s005_testing.py
Layer:   bedrock/tools
Desc:    Enforcement for [S005-test-coverage-mandatory](../../../../docs/standards/s005-test-coverage-mandatory.md).

         Three checks:
           1. Structural test pairing - every route/service module has a
              corresponding `test_<stem>*.py` module somewhere under the repo.
           2. Unexempted skip decorators - `@pytest.mark.skip`,
              `@pytest.mark.skipif`, `it.skip`, `test.skip`, `describe.skip`.
           3. Live-database isolation - a test file that references a live
              database filename (`app.db`, `bedrock.db`) directly, instead of
              going through an isolated fixture, is flagged unless a
              `conftest.py` sits alongside it.

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.audit_s005_testing --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import DEFAULT_IGNORED_DIRS, load_bedrock_config
from bedrock.tools._reporter import AuditReporter

_SKIP_PATTERNS = re.compile(
    r"@pytest\.mark\.skip(?:if)?\s*\(|\b(?:it|test|describe)\.skip\s*\("
)
_LIVE_DB_NAMES = ("app.db", "bedrock.db")

_ROUTE_SERVICE_DIRS = ("routes", "services")


@dataclass
class TestingViolation:
    file: str
    line: int
    message: str


def _is_ignored(path: Path | str) -> bool:
    parts = Path(path).parts
    return any(part in DEFAULT_IGNORED_DIRS or part == "site-packages" for part in parts)


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    if _is_ignored(rel_path):
        return True
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _iter_python_files(root: Path) -> list[Path]:
    if not root.is_dir():
        return []
    return sorted(
        path
        for path in root.rglob("*.py")
        if not _is_ignored(path)
    )


def _check_test_pairing(root: Path, exemptions: list[str]) -> list[TestingViolation]:
    violations: list[TestingViolation] = []
    all_test_stems = {
        p.stem
        for p in root.rglob("test_*.py")
        if not _is_ignored(p)
    } | {
        p.stem.replace(".test", "")
        for p in root.rglob("*.test.ts*")
        if not _is_ignored(p)
    }

    for path in _iter_python_files(root):
        if path.name == "__init__.py":
            continue
        if path.parent.name not in _ROUTE_SERVICE_DIRS:
            continue
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        expected = f"test_{path.stem}"
        if not any(stem.startswith(expected) for stem in all_test_stems):
            violations.append(
                TestingViolation(
                    file=rel,
                    line=1,
                    message=f"no paired test module found (expected test_{path.stem}*.py)",
                )
            )
    return violations


def _check_skip_decorators(root: Path, exemptions: list[str]) -> list[TestingViolation]:
    violations: list[TestingViolation] = []
    test_files = [
        path
        for path in (
            list(root.rglob("test_*.py"))
            + list(root.rglob("*.test.ts*"))
            + list(root.rglob("*.spec.ts*"))
        )
        if not _is_ignored(path)
    ]
    for path in test_files:
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if _SKIP_PATTERNS.search(line):
                violations.append(
                    TestingViolation(
                        file=rel,
                        line=lineno,
                        message="unexempted test skip decorator - remove or declare an exemption",
                    )
                )
    return violations


def _check_live_db_isolation(root: Path, exemptions: list[str]) -> list[TestingViolation]:
    violations: list[TestingViolation] = []
    for path in root.rglob("test_*.py"):
        if _is_ignored(path):
            continue
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue
        if (path.parent / "conftest.py").exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if any(db_name in line for db_name in _LIVE_DB_NAMES):
                violations.append(
                    TestingViolation(
                        file=rel,
                        line=lineno,
                        message="test references a live database file directly - "
                        "add a conftest.py fixture providing an isolated test database",
                    )
                )
    return violations


def audit(root: Path, exemptions: list[str]) -> list[TestingViolation]:
    return (
        _check_test_pairing(root, exemptions)
        + _check_skip_decorators(root, exemptions)
        + _check_live_db_isolation(root, exemptions)
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S005", "Test Coverage Mandatory", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    violations = audit(root, config.audit_s005.exemptions)
    if violations:
        for violation in violations:
            reporter.start_check(f"Checking test coverage in {violation.file}:{violation.line}")
            reporter.fail_check(
                violation.message, file_path=violation.file, line=violation.line
            )
    else:
        reporter.start_check(
            "Scanning for missing test pairing, unexempted skips, and live-db access"
        )
        reporter.pass_check("no test coverage violations found")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
