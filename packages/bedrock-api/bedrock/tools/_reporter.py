"""
Module:  _reporter.py
Layer:   bedrock/tools
Desc:    Shared terminal-reporting substrate for every `bedrock.tools.audit_*`
         module. Each audit tool owns its own detection logic; this owns the
         one thing they'd otherwise all reimplement slightly differently -
         how a check gets announced, how a pass or failure gets rendered, how
         elapsed time gets measured, and which exit code a given outcome maps
         to.

         Exit code contract, matched across every audit tool that adopts this:
           0 - every check passed, no configuration/runtime error was raised.
           1 - at least one check failed via `fail_check()`.
           2 - `error()` was called (configuration or unhandled runtime
               fault). This takes priority over 0 and 1: an audit that could
               not run to completion never reports a clean or a simple
               failure, because it does not actually know the answer.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path


@dataclass
class _CheckResult:
    description: str
    status: str = "PENDING"
    details: str = ""
    message: str = ""
    file_path: Path | str | None = None
    line: int | None = None
    hint: str | None = None


class AuditReporter:
    """Accumulates check results for one audit run and renders them.

    Usage:
        reporter = AuditReporter("S001", "No Duplicate UI Code", repo_root, config_file)
        reporter.start_check("Scanning components")
        reporter.pass_check("Found 0 duplicates")
        raise SystemExit(reporter.finish())
    """

    def __init__(self, audit_code: str, audit_name: str, repo_root: Path, config_file: Path) -> None:
        self.audit_code = audit_code
        self.audit_name = audit_name
        self.repo_root = repo_root
        self.config_file = config_file

        self.checks: list[_CheckResult] = []
        self.errors: list[str] = []
        self.elapsed_ms: float = 0.0

        self._start_time = time.monotonic()
        self._finished = False

    def start_check(self, description: str) -> None:
        if not description:
            raise ValueError("start_check() requires a non-empty description")
        self.checks.append(_CheckResult(description=description))

    def pass_check(self, details: str = "") -> None:
        check = self.checks[-1]
        check.status = "PASS"
        check.details = details

    def fail_check(
        self,
        message: str,
        file_path: Path | str | None = None,
        line: int | None = None,
        hint: str | None = None,
    ) -> None:
        check = self.checks[-1]
        check.status = "FAIL"
        check.message = message
        check.file_path = file_path
        check.line = line
        check.hint = hint

    def error(self, message: str) -> None:
        self.errors.append(message)

    def finish(self) -> int:
        if not self._finished:
            self.elapsed_ms = (time.monotonic() - self._start_time) * 1000
            self._finished = True

        if self.errors:
            return 2
        if any(check.status == "FAIL" for check in self.checks):
            return 1
        return 0

    def render(self) -> str:
        lines: list[str] = []
        banner = "=" * 80
        lines.append(banner)
        lines.append(f"[AUDIT-{self.audit_code}] {self.audit_name}")
        lines.append(banner)

        for check in self.checks:
            if check.status == "PASS":
                line = f"  [PASS] {check.description}"
                if check.details:
                    line += f" {check.details}"
                lines.append(line)
            elif check.status == "FAIL":
                lines.append(f"  [FAIL] {check.description} -> {check.message}")
                if check.file_path is not None:
                    pointer = str(check.file_path)
                    if check.line is not None:
                        pointer += f":{check.line}"
                    lines.append(f"         at {pointer}")
                if check.hint:
                    lines.append(f"         hint: {check.hint}")
            else:
                lines.append(f"  [PENDING] {check.description}")

        for message in self.errors:
            lines.append(f"  [ERROR] {message}")

        passed = sum(1 for check in self.checks if check.status == "PASS")
        failed = sum(1 for check in self.checks if check.status == "FAIL")
        total = len(self.checks)

        lines.append(banner)
        lines.append(
            f"Total: {total}  Passed: {passed}  Failed: {failed}  "
            f"Elapsed: {self.elapsed_ms:.2f}ms"
        )
        lines.append(banner)

        return "\n".join(lines)
