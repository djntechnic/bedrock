"""
Module:  run_all.py
Layer:   bedrock/tools
Desc:    Orchestrates the full platform audit suite - `s001` through
         `s014`, plus `s100` - as a single command, so CI (and a developer before
         opening a PR) gets one master summary instead of fifteen separate
         invocations to remember and interpret individually. `s015` is
         version-scoped (it validates one CHANGELOG.md entry, not the whole
         repo) and is invoked directly by the release orchestrator instead
         of through this sweep.

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

from bedrock.tools._config import clear_source_cache
from bedrock.tools import (
    s001_audit_duplicates,
    s002_audit_grids,
    s003_audit_logging,
    s004_audit_config,
    s005_audit_testing,
    s006_audit_pr_workflow,
    s007_audit_schema_catalog,
    s008_audit_guidance,
    s009_audit_design_tokens,
    s010_audit_security,
    s011_audit_navigation,
    s012_audit_pins,
    s013_audit_api_docs,
    s014_audit_ledger_freshness,
    s015_audit_release_notes,
    s100_audit_domain_registry,
)

class _AuditModule(Protocol):
    def main(self, argv: list[str] | None = None) -> int: ...


#: Ordered `(code, module)` pairs dispatched by `run_all`. Each module must
#: expose a `main(argv) -> int` entry point matching every other audit tool.
AUDIT_MODULES: list[tuple[str, _AuditModule]] = [
    ("s001", s001_audit_duplicates),
    ("s002", s002_audit_grids),
    ("s003", s003_audit_logging),
    ("s004", s004_audit_config),
    ("s005", s005_audit_testing),
    ("s006", s006_audit_pr_workflow),
    ("s007", s007_audit_schema_catalog),
    ("s008", s008_audit_guidance),
    ("s009", s009_audit_design_tokens),
    ("s010", s010_audit_security),
    ("s011", s011_audit_navigation),
    ("s012", s012_audit_pins),
    ("s013", s013_audit_api_docs),
    ("s014", s014_audit_ledger_freshness),
    ("s100", s100_audit_domain_registry),
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
    clear_source_cache()
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
    lines.append("[RUN-ALL] Platform Audit Suite (S001-S014, S100)")
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
