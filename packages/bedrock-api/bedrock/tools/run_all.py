"""
Module:  run_all.py
Layer:   bedrock/tools
Desc:    Orchestrates the full platform audit suite - `audit_s001` through
         `audit_s014` - as a single command, so CI (and a developer before
         opening a PR) gets one master summary instead of fourteen separate
         invocations to remember and interpret individually.

         Exit code contract mirrors `AuditReporter`'s per-audit contract,
         escalated across the whole suite:
           0 - every audit passed.
           1 - at least one audit failed (and none errored).
           2 - at least one audit could not run to completion (a
               configuration/runtime error). This takes priority over 1: a
               suite that couldn't fully run never reports a plain failure,
               because it does not actually know whether the rest passed.

         `--fail-fast` stops dispatch at the first non-zero audit. `--json`
         emits a machine-readable report instead of the text summary table,
         for CI/QA ingestion.

Usage:   python -m bedrock.tools.run_all --root .
         python -m bedrock.tools.run_all --root . --fail-fast
         python -m bedrock.tools.run_all --root . --json
"""
from __future__ import annotations

import argparse
import io
import json
import time
from contextlib import redirect_stdout
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Protocol

from bedrock.tools import (
    audit_s001_duplicates,
    audit_s002_grids,
    audit_s003_logging,
    audit_s004_config,
    audit_s005_testing,
    audit_s006_pr_workflow,
    audit_s007_schema_catalog,
    audit_s008_guidance,
    audit_s009_design_tokens,
    audit_s010_security,
    audit_s011_navigation,
    audit_s012_pins,
    audit_s013_api_docs,
    audit_s014_ledger_freshness,
)

class _AuditModule(Protocol):
    def main(self, argv: list[str] | None = None) -> int: ...


#: Ordered `(code, module)` pairs dispatched by `run_all`. Each module must
#: expose a `main(argv) -> int` entry point matching every other audit tool.
AUDIT_MODULES: list[tuple[str, _AuditModule]] = [
    ("s001", audit_s001_duplicates),
    ("s002", audit_s002_grids),
    ("s003", audit_s003_logging),
    ("s004", audit_s004_config),
    ("s005", audit_s005_testing),
    ("s006", audit_s006_pr_workflow),
    ("s007", audit_s007_schema_catalog),
    ("s008", audit_s008_guidance),
    ("s009", audit_s009_design_tokens),
    ("s010", audit_s010_security),
    ("s011", audit_s011_navigation),
    ("s012", audit_s012_pins),
    ("s013", audit_s013_api_docs),
    ("s014", audit_s014_ledger_freshness),
]

_STATUS_BY_EXIT_CODE = {0: "PASS", 1: "FAIL"}


@dataclass
class AuditRunResult:
    code: str
    status: str
    exit_code: int
    elapsed_ms: float
    output: str


def _run_one(code: str, module: _AuditModule, root: Path) -> AuditRunResult:
    buffer = io.StringIO()
    start = time.monotonic()
    try:
        with redirect_stdout(buffer):
            exit_code = module.main(["--root", str(root)])
    except SystemExit as exc:
        exit_code = exc.code if isinstance(exc.code, int) else 1
    elapsed_ms = (time.monotonic() - start) * 1000
    status = _STATUS_BY_EXIT_CODE.get(exit_code, "ERROR")
    return AuditRunResult(code=code, status=status, exit_code=exit_code, elapsed_ms=elapsed_ms, output=buffer.getvalue())


def run_all(root: Path, fail_fast: bool = False) -> tuple[list[AuditRunResult], int]:
    results: list[AuditRunResult] = []
    suite_exit_code = 0

    for code, module in AUDIT_MODULES:
        result = _run_one(code, module, root)
        results.append(result)

        if result.exit_code == 2:
            suite_exit_code = 2
        elif result.exit_code != 0 and suite_exit_code != 2:
            suite_exit_code = 1

        if fail_fast and result.exit_code != 0:
            break

    return results, suite_exit_code


def _render_summary(results: list[AuditRunResult], suite_exit_code: int) -> str:
    lines: list[str] = []
    banner = "=" * 80
    lines.append(banner)
    lines.append("[RUN-ALL] Platform Audit Suite (S001-S014)")
    lines.append(banner)

    for result in results:
        lines.append(f"  [{result.status}] {result.code}  ({result.elapsed_ms:.2f}ms)")

    passed = sum(1 for r in results if r.status == "PASS")
    failed = sum(1 for r in results if r.status == "FAIL")
    errored = sum(1 for r in results if r.status == "ERROR")
    total_elapsed = sum(r.elapsed_ms for r in results)

    lines.append(banner)
    lines.append(
        f"Total: {len(results)}  Passed: {passed}  Failed: {failed}  Errored: {errored}  "
        f"Elapsed: {total_elapsed:.2f}ms  Exit: {suite_exit_code}"
    )
    lines.append(banner)

    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository root to audit")
    parser.add_argument("--fail-fast", action="store_true", help="stop at the first failing/erroring audit")
    parser.add_argument("--json", action="store_true", help="emit a machine-readable JSON report")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    results, suite_exit_code = run_all(root, fail_fast=args.fail_fast)

    if args.json:
        payload = {"exit_code": suite_exit_code, "results": [asdict(result) for result in results]}
        print(json.dumps(payload, indent=2))
    else:
        for result in results:
            if result.output:
                print(result.output)
        print(_render_summary(results, suite_exit_code))

    return suite_exit_code


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
