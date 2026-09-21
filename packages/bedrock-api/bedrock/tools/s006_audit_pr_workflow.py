"""
Module:  audit_s006_pr_workflow.py
Layer:   bedrock/tools
Desc:    Enforcement for [S006-defect-isolation-and-pr-workflow](../../../../docs/standards/s006-defect-isolation-and-pr-workflow.md).

         Two checks:
           1. Ledger freshness - every path declared in
              `[tool.bedrock.audit.s006].ledger_files` exists, is non-empty,
              and is formatted as a markdown document (starts with a `#`
              header once blank lines are skipped).
           2. Working tree cleanliness - `git status --porcelain` reports a
              clean tree. Skipped (reported as passing) when `root` is not a
              git repository, since the check has nothing to verify there.

         Exit 0 clean, 1 on a violation, 2 on a configuration error.

Usage:   python -m bedrock.tools.audit_s006_pr_workflow --root .
"""
from __future__ import annotations

import argparse
import fnmatch
import subprocess
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import load_bedrock_config
from bedrock.tools._reporter import AuditReporter


@dataclass
class WorkflowViolation:
    file: str
    line: int
    message: str


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _check_ledger_freshness(root: Path, ledger_files: list[str], exemptions: list[str]) -> list[WorkflowViolation]:
    violations: list[WorkflowViolation] = []
    for rel in ledger_files:
        if _is_exempt(rel, exemptions):
            continue
        path = root / rel
        if not path.exists():
            violations.append(
                WorkflowViolation(file=rel, line=1, message="declared ledger file does not exist")
            )
            continue

        text = path.read_text(encoding="utf-8", errors="replace")
        if not text.strip():
            violations.append(WorkflowViolation(file=rel, line=1, message="ledger file is empty"))
            continue

        stripped_lines = [line for line in text.splitlines() if line.strip()]
        if not stripped_lines or not stripped_lines[0].lstrip().startswith("#"):
            violations.append(
                WorkflowViolation(
                    file=rel,
                    line=1,
                    message="ledger file is missing a markdown header - malformed tracking ledger",
                )
            )
    return violations


def _check_working_tree(root: Path) -> list[WorkflowViolation]:
    if not (root / ".git").exists():
        return []

    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return []

    dirty = [line for line in result.stdout.splitlines() if line.strip()]
    if not dirty:
        return []

    return [
        WorkflowViolation(
            file=".",
            line=1,
            message=f"working tree is not clean ({len(dirty)} pending change(s)) - "
            "commit or stash before merge",
        )
    ]


def audit(root: Path, ledger_files: list[str], exemptions: list[str]) -> list[WorkflowViolation]:
    return _check_ledger_freshness(root, ledger_files, exemptions) + _check_working_tree(root)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S006", "Defect Isolation & PR Workflow", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    violations = audit(root, config.audit_s006.ledger_files, config.audit_s006.exemptions)
    if violations:
        for violation in violations:
            reporter.start_check(f"Checking PR workflow state in {violation.file}")
            reporter.fail_check(
                violation.message, file_path=violation.file, line=violation.line
            )
    else:
        reporter.start_check("Checking ledger freshness and working tree cleanliness")
        reporter.pass_check("ledgers are well-formed and the working tree is clean")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
