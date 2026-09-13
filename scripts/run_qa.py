#!/usr/bin/env python
"""
Module:  run_qa.py
Layer:   scripts
Desc:    Unified multi-tier QA orchestrator for the bedrock monorepo. One
         entry point replaces the "which command do I run before I commit /
         before I open a PR / before I merge" question with three fixed
         answers:

           fast    - delta only. testmon-scoped pytest + `vitest related` for
                     changed files. Target: < 20s. Run before every commit.
           scoped  - everything touched since `master` diverged, run in full
                     (no testmon narrowing). Target: < 60s. Run before a PR.
           full     - the entire suite: all pytest, all vitest, every platform
                     audit (`bedrock.tools.run_all`), plus (with --dead-code)
                     `vulture` and `knip`. Target: 2-3m. Run pre-merge / CI.

         Output is buffered in memory and rendered once at the end - passing
         subprocess stdout is suppressed - so a clean run costs a handful of
         summary lines instead of a full pytest/vitest transcript. On
         failure, only the last 60 lines of the failing step's output are
         kept (`_FAILURE_TAIL_LINES`), so a stack trace does not itself blow
         the context budget it exists to protect.

         Exit code contract (mirrors `bedrock.tools.run_all`):
           0 - every executed step passed (or was skipped - no work to do is
               not a failure).
           1 - at least one step failed.

Usage:   python scripts/run_qa.py --mode fast --json
         python scripts/run_qa.py --mode scoped
         python scripts/run_qa.py --mode full --dead-code
         python scripts/run_qa.py --dead-code
         python scripts/run_qa.py --mode fast --force-refresh
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

_ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*m")

REPO_ROOT = Path(__file__).resolve().parent.parent
BEDROCK_API_DIR = REPO_ROOT / "packages" / "bedrock-api"
TESTMON_DATAFILE = BEDROCK_API_DIR / ".testmondata"
TESTMON_HEAD_MARKER = BEDROCK_API_DIR / ".testmondata.head"

_FAILURE_TAIL_LINES = 60
_FRONTEND_SRC_PREFIX = "packages/bedrock-ui/src/"
_FRONTEND_SRC_SUFFIXES = (".ts", ".tsx")

# pytest exit code 5 means "no tests were collected" - expected and harmless
# for a testmon-scoped run where the delta touches no test-reachable code.
_PYTEST_NO_TESTS_COLLECTED = 5


@dataclass
class StepResult:
    name: str
    status: str  # "pass" | "fail" | "skip"
    exit_code: int
    duration_ms: float
    summary: str = ""
    output_tail: str = field(default="", repr=False)


def _tail(text: str, n: int = _FAILURE_TAIL_LINES) -> str:
    lines = text.splitlines()
    return "\n".join(lines[-n:])


def _run(cmd: list[str], cwd: Path | None = None) -> tuple[int, str]:
    try:
        # vitest/knip emit UTF-8 box-drawing and color codes that the
        # Windows console's cp1252 default can't decode; `errors="replace"`
        # keeps a decoding hiccup in subprocess output from crashing the
        # orchestrator itself.
        proc = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    except FileNotFoundError as exc:
        return 127, f"executable not found: {exc}"
    return proc.returncode, proc.stdout + proc.stderr


def _resolve(executable: str) -> str | None:
    return shutil.which(executable)


def _git(*args: str) -> str:
    code, out = _run(["git", *args], cwd=REPO_ROOT)
    return out.strip() if code == 0 else ""


def _changed_files(mode: str) -> list[str]:
    """Files touched relative to the comparison point for `mode`.

    `fast` looks at the working tree (staged + unstaged + untracked) - the
    delta an agent commit loop is about to commit. `scoped` widens that to
    everything since the branch diverged from `master`, since a pre-PR check
    cares about the whole branch, not just the last edit.
    """
    tracked = _git("diff", "--name-only", "HEAD")
    staged = _git("diff", "--name-only", "--cached")
    status = _git("status", "--porcelain")
    untracked = [line[3:] for line in status.splitlines() if line.startswith("??")]
    files = set(tracked.splitlines()) | set(staged.splitlines()) | set(untracked)

    if mode == "scoped":
        base = _git("merge-base", "HEAD", "master")
        if base:
            branch_diff = _git("diff", "--name-only", f"{base}...HEAD")
            files |= set(branch_diff.splitlines())

    return sorted(f for f in files if f)


def _testmon_cache_guard(force_refresh: bool) -> None:
    """Discard `.testmondata` when it no longer describes this HEAD.

    testmon's own dependency graph is content-addressed, not HEAD-addressed,
    but a stale cache surviving a rebase/checkout can carry dependency edges
    for code that no longer exists on this branch. Rather than reason about
    that, a HEAD change (or an explicit `--force-refresh`) just rebuilds it.
    """
    head = _git("rev-parse", "HEAD")
    stale = force_refresh
    if not force_refresh and TESTMON_HEAD_MARKER.exists():
        stale = TESTMON_HEAD_MARKER.read_text().strip() != head

    if stale and TESTMON_DATAFILE.exists():
        TESTMON_DATAFILE.unlink()

    if head:
        TESTMON_HEAD_MARKER.write_text(head)


def _pytest_summary(output: str) -> str:
    if not output.strip():
        return "no tests selected (testmon: nothing changed)"
    for line in reversed(output.splitlines()):
        stripped = line.strip()
        if "no tests ran" in stripped:
            return stripped
        if stripped.startswith("=") and (" passed" in stripped or " failed" in stripped or " error" in stripped):
            return stripped.strip("= ")
    # pytest-testmon's `-q` progress dots reach [100%] without printing a
    # final "N passed" footer line - the run still has a definitive exit
    # code, just no matching text to surface here.
    if "100%]" in output:
        return "completed (see exit code; testmon suppresses the summary footer)"
    return "no summary line found"


def _pytest_result(name: str, code: int, output: str, start: float) -> StepResult:
    duration_ms = (time.monotonic() - start) * 1000
    if code in (0, _PYTEST_NO_TESTS_COLLECTED):
        status = "pass"
    else:
        status = "fail"
    return StepResult(
        name=name,
        status=status,
        exit_code=code,
        duration_ms=duration_ms,
        summary=_pytest_summary(output),
        output_tail=_tail(output) if status == "fail" else "",
    )


def run_backend_fast(force_refresh: bool) -> StepResult:
    _testmon_cache_guard(force_refresh)
    start = time.monotonic()
    # `--testmon` alone, deliberately not combined with `-m`: testmon's own
    # collection hook decides "changed since last green run", and a marker
    # expression layered on top makes pytest treat every run as a new
    # selection, defeating the cache and re-running the full suite (measured
    # ~100s here vs. ~3s for `--testmon` alone with a warm cache).
    cmd = [sys.executable, "-m", "pytest", "--testmon", "-q"]
    code, out = _run(cmd, cwd=BEDROCK_API_DIR)
    return _pytest_result("pytest", code, out, start)


def run_backend_scoped() -> StepResult:
    start = time.monotonic()
    cmd = [sys.executable, "-m", "pytest", "-m", "not integration", "-q"]
    code, out = _run(cmd, cwd=BEDROCK_API_DIR)
    return _pytest_result("pytest", code, out, start)


def run_backend_full() -> StepResult:
    start = time.monotonic()
    cmd = [sys.executable, "-m", "pytest", "-q"]
    code, out = _run(cmd, cwd=BEDROCK_API_DIR)
    return _pytest_result("pytest", code, out, start)


def _vitest_summary(output: str) -> str:
    for line in reversed(output.splitlines()):
        stripped = _ANSI_ESCAPE.sub("", line).strip()
        if stripped.lower().startswith("test files"):
            return stripped
        if "no test files found" in stripped.lower():
            return stripped
    return "no summary line found"


def run_frontend_fast(changed_files: list[str]) -> StepResult:
    frontend_files = [
        f for f in changed_files if f.startswith(_FRONTEND_SRC_PREFIX) and f.endswith(_FRONTEND_SRC_SUFFIXES)
    ]
    if not frontend_files:
        return StepResult("vitest", "skip", 0, 0.0, summary="no frontend changes")

    npx = _resolve("npx")
    if npx is None:
        return StepResult("vitest", "fail", 127, 0.0, summary="npx not found on PATH")

    start = time.monotonic()
    abs_files = [str(REPO_ROOT / f) for f in frontend_files]
    cmd = [npx, "vitest", "related", *abs_files, "--run", "--reporter=dot"]
    code, out = _run(cmd, cwd=REPO_ROOT)
    duration_ms = (time.monotonic() - start) * 1000
    status = "pass" if code == 0 else "fail"
    return StepResult(
        name="vitest",
        status=status,
        exit_code=code,
        duration_ms=duration_ms,
        summary=_vitest_summary(out),
        output_tail=_tail(out) if status == "fail" else "",
    )


def run_frontend_full() -> StepResult:
    npx = _resolve("npx")
    if npx is None:
        return StepResult("vitest", "fail", 127, 0.0, summary="npx not found on PATH")

    start = time.monotonic()
    cmd = [npx, "vitest", "run", "--reporter=dot"]
    code, out = _run(cmd, cwd=REPO_ROOT)
    duration_ms = (time.monotonic() - start) * 1000
    status = "pass" if code == 0 else "fail"
    return StepResult(
        name="vitest",
        status=status,
        exit_code=code,
        duration_ms=duration_ms,
        summary=_vitest_summary(out),
        output_tail=_tail(out) if status == "fail" else "",
    )


def run_audits() -> StepResult:
    start = time.monotonic()
    cmd = [sys.executable, "-m", "bedrock.tools.run_all", "--root", str(REPO_ROOT)]
    code, out = _run(cmd, cwd=BEDROCK_API_DIR)
    duration_ms = (time.monotonic() - start) * 1000
    status = "pass" if code == 0 else "fail"
    summary_line = next((line for line in out.splitlines() if line.startswith("Total:")), "no summary line found")
    return StepResult(
        name="audits",
        status=status,
        exit_code=code,
        duration_ms=duration_ms,
        summary=summary_line,
        output_tail=_tail(out) if status == "fail" else "",
    )


def run_typecheck() -> StepResult:
    npx = _resolve("npx")
    if npx is None:
        return StepResult("typecheck", "fail", 127, 0.0, summary="npx not found on PATH")

    start = time.monotonic()
    cmd = [npx, "tsc", "--noEmit", "-p", "packages/bedrock-ui/tsconfig.json"]
    code, out = _run(cmd, cwd=REPO_ROOT)
    duration_ms = (time.monotonic() - start) * 1000
    status = "pass" if code == 0 else "fail"
    return StepResult(
        name="typecheck",
        status=status,
        exit_code=code,
        duration_ms=duration_ms,
        summary="clean" if status == "pass" else "type errors found",
        output_tail=_tail(out) if status == "fail" else "",
    )


def run_vulture() -> StepResult:
    start = time.monotonic()
    cmd = [
        sys.executable,
        "-m",
        "vulture",
        str(BEDROCK_API_DIR / "bedrock"),
        str(REPO_ROOT / "scripts" / "maintenance" / "vulture_whitelist.py"),
        "--min-confidence",
        "80",
    ]
    code, out = _run(cmd, cwd=REPO_ROOT)
    duration_ms = (time.monotonic() - start) * 1000

    if code == 127 or "No module named vulture" in out:
        return StepResult("vulture", "skip", 0, duration_ms, summary="vulture not installed")

    status = "pass" if code == 0 else "fail"
    findings = len(out.splitlines())
    return StepResult(
        name="vulture",
        status=status,
        exit_code=code,
        duration_ms=duration_ms,
        summary="clean" if status == "pass" else f"{findings} finding(s)",
        output_tail=_tail(out) if status == "fail" else "",
    )


def run_knip() -> StepResult:
    npx = _resolve("npx")
    if npx is None:
        return StepResult("knip", "skip", 0, 0.0, summary="npx not found on PATH")

    start = time.monotonic()
    cmd = [npx, "knip", "--no-progress"]
    code, out = _run(cmd, cwd=REPO_ROOT)
    duration_ms = (time.monotonic() - start) * 1000
    status = "pass" if code == 0 else "fail"
    return StepResult(
        name="knip",
        status=status,
        exit_code=code,
        duration_ms=duration_ms,
        summary="clean" if status == "pass" else "unused code/dependencies found",
        output_tail=_tail(out) if status == "fail" else "",
    )


def run_dead_code() -> list[StepResult]:
    return [run_vulture(), run_knip()]


def run_qa(mode: str, dead_code: bool, force_refresh: bool) -> list[StepResult]:
    steps: list[StepResult] = []

    if mode == "fast":
        changed = _changed_files("fast")
        steps.append(run_backend_fast(force_refresh))
        steps.append(run_frontend_fast(changed))
    elif mode == "scoped":
        steps.append(run_backend_scoped())
        steps.append(run_frontend_full())
        steps.append(run_audits())
    elif mode == "full":
        steps.append(run_backend_full())
        steps.append(run_frontend_full())
        steps.append(run_audits())
        steps.append(run_typecheck())
        steps.extend(run_dead_code())

    if dead_code and mode != "full":
        steps.extend(run_dead_code())

    return steps


def _render_text(steps: list[StepResult], exit_code: int, duration_ms: float) -> str:
    lines: list[str] = []
    banner = "=" * 80
    lines.append(banner)
    lines.append("[RUN-QA] Unified QA Orchestrator")
    lines.append(banner)

    for step in steps:
        marker = {"pass": "PASS", "fail": "FAIL", "skip": "SKIP"}[step.status]
        lines.append(f"  [{marker}] {step.name}  ({step.duration_ms:.0f}ms)  {step.summary}")
        if step.status == "fail" and step.output_tail:
            lines.append(f"    --- last {_FAILURE_TAIL_LINES} lines ---")
            for tail_line in step.output_tail.splitlines():
                lines.append(f"    {tail_line}")

    passed = sum(1 for s in steps if s.status == "pass")
    failed = sum(1 for s in steps if s.status == "fail")
    skipped = sum(1 for s in steps if s.status == "skip")

    lines.append(banner)
    lines.append(
        f"Total: {len(steps)}  Passed: {passed}  Failed: {failed}  Skipped: {skipped}  "
        f"Elapsed: {duration_ms:.0f}ms  Exit: {exit_code}"
    )
    lines.append(banner)
    return "\n".join(lines)


def _render_json(steps: list[StepResult], exit_code: int, duration_ms: float, mode: str) -> str:
    status = "pass" if exit_code == 0 else "fail"
    payload: dict[str, object] = {
        "status": status,
        "exit": exit_code,
        "mode": mode,
        "duration_ms": round(duration_ms, 1),
    }
    for step in steps:
        payload[step.name] = step.summary if step.status != "skip" else f"skipped: {step.summary}"
    if exit_code != 0:
        payload["failures"] = [
            {"name": s.name, "summary": s.summary, "output_tail": s.output_tail}
            for s in steps
            if s.status == "fail"
        ]
    return json.dumps(payload)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mode", choices=["fast", "scoped", "full"], default="fast", help="test tier to execute")
    parser.add_argument("--dead-code", action="store_true", help="also run vulture (backend) and knip (frontend)")
    parser.add_argument("--json", action="store_true", help="emit single-line machine-readable JSON instead of text")
    parser.add_argument("--fix", action="store_true", help="reserved for future auto-fix integration; currently a no-op")
    parser.add_argument("--force-refresh", action="store_true", help="discard .testmondata before a fast-mode run")
    parser.add_argument("--verbose", action="store_true", help="print full step output, not just failure tails")
    args = parser.parse_args(argv)

    start = time.monotonic()
    steps = run_qa(args.mode, dead_code=args.dead_code, force_refresh=args.force_refresh)
    duration_ms = (time.monotonic() - start) * 1000

    exit_code = 1 if any(s.status == "fail" for s in steps) else 0

    if args.json:
        print(_render_json(steps, exit_code, duration_ms, args.mode))
    else:
        print(_render_text(steps, exit_code, duration_ms))

    return exit_code


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
