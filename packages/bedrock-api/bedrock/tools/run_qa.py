"""
Module:  run_qa.py
Layer:   bedrock/tools
Desc:    Unified multi-tier QA orchestrator, shared by bedrock and every
         consumer. One entry point answers "which command do I run before I
         commit / before I open a PR / before I merge" with three tiers:

           fast    - delta only. testmon-scoped pytest + `vitest related` for
                     changed frontend files. Run before every commit.
           scoped  - every layer the branch touched since it diverged from
                     the base branch, run in full (no testmon narrowing),
                     plus every audit. A layer the branch never touched is
                     skipped. Run before opening a PR.
           full    - everything: all pytest, all vitest, the type check,
                     every platform and domain audit, vulture and knip.
                     Run pre-merge.

         Steps are grouped into lanes (backend, frontend, typecheck, audits)
         that run concurrently; the steps inside a lane run one after
         another, and every step runs to completion - an early failure never
         hides a later one. Subprocess output is buffered and only the tail
         of a failing step is printed, so a clean run costs a handful of
         summary lines.

         Repo layout comes from `[tool.bedrock.qa]` in `bedrock.toml` (see
         `bedrock.tools._config.QaConfig`). Every artifact the run produces
         lives under `<root>/.qa/`, never the repository root:

           .qa/testmon/.testmondata   pytest-testmon's dependency database
           .qa/testmon/head           HEAD the database was last built on
           .qa/reports/last-<mode>.json  full report of the latest run
           .qa/reports/history.jsonl  one compact line per run (rotated)
           .qa/reports/index.html     browsable viewer over both
                                      (`bedrock.tools.qa_report`)

         Exit code contract (mirrors `bedrock.tools.run_all`):
           0 - every executed step passed or was skipped.
           1 - at least one step failed.
           2 - at least one step could not run (missing executable,
               configuration error).

Usage:   python -m bedrock.tools.run_qa --mode fast --json
         python -m bedrock.tools.run_qa --mode scoped
         python -m bedrock.tools.run_qa --mode full
         python -m bedrock.tools.run_qa --mode fast --force-refresh
"""
from __future__ import annotations

import argparse
import fnmatch
import importlib.util
import io
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time
from collections.abc import Callable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from bedrock.tools import qa_report
from bedrock.tools._config import QaConfig, load_qa_config

MODES: tuple[str, ...] = ("fast", "scoped", "full")

QA_DIR_NAME = ".qa"
_FAILURE_TAIL_LINES = 60
_ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
_FRONTEND_SRC_SUFFIXES = (".ts", ".tsx")

# pytest exit code 5 means "no tests were collected" - expected and harmless
# for a testmon-scoped run where the delta touches no test-reachable code.
_PYTEST_NO_TESTS_COLLECTED = 5
# Conventional "command not found" code; reported as an error (exit 2), not a
# test failure, because nothing was actually checked.
_EXIT_NOT_FOUND = 127

LANE_ORDER: tuple[str, ...] = ("backend", "frontend", "typecheck", "audits")


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Step:
    """One command to run. `cmd=None` declares a step that is skipped, with
    `skip_reason` saying why - it still appears in the report."""

    name: str
    lane: str
    kind: str  # "pytest" | "vitest" | "tsc" | "audit" | "vulture" | "knip"
    cmd: tuple[str, ...] | None
    cwd: Path
    env: Mapping[str, str] | None = None
    skip_reason: str = ""


@dataclass
class StepResult:
    name: str
    lane: str
    status: str  # "pass" | "fail" | "skip" | "error"
    exit_code: int
    duration_ms: float
    summary: str = ""
    output_tail: str = field(default="", repr=False)


@dataclass(frozen=True)
class QaPaths:
    root: Path

    @property
    def qa_dir(self) -> Path:
        return self.root / QA_DIR_NAME

    @property
    def testmon_dir(self) -> Path:
        return self.qa_dir / "testmon"

    @property
    def testmon_datafile(self) -> Path:
        return self.testmon_dir / ".testmondata"

    @property
    def testmon_head(self) -> Path:
        return self.testmon_dir / "head"

    @property
    def reports_dir(self) -> Path:
        return self.qa_dir / "reports"


# ---------------------------------------------------------------------------
# Subprocess + git helpers
# ---------------------------------------------------------------------------


def _tail(text: str, n: int = _FAILURE_TAIL_LINES) -> str:
    return "\n".join(text.splitlines()[-n:])


def _run(cmd: Sequence[str], cwd: Path, env: Mapping[str, str] | None = None) -> tuple[int, str]:
    full_env = {**os.environ, **env} if env else None
    try:
        # vitest/knip emit UTF-8 box-drawing and color codes that the Windows
        # console's cp1252 default can't decode; `errors="replace"` keeps a
        # decoding hiccup from crashing the orchestrator itself.
        proc = subprocess.run(
            list(cmd),
            cwd=cwd,
            env=full_env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdin=subprocess.DEVNULL,
        )
    except FileNotFoundError as exc:
        return _EXIT_NOT_FOUND, f"executable not found: {exc}"
    except NotADirectoryError as exc:
        return _EXIT_NOT_FOUND, f"working directory not found: {exc}"
    return proc.returncode, (proc.stdout or "") + (proc.stderr or "")


def _git(root: Path, *args: str) -> tuple[int, str]:
    code, out = _run(["git", *args], cwd=root)
    return code, out.strip()


def _git_out(root: Path, *args: str) -> str:
    code, out = _git(root, *args)
    return out if code == 0 else ""


def _resolve_base(root: Path, base_branch: str) -> str:
    """The merge-base with `base_branch` (local, then `origin/`), or ""."""
    for ref in (base_branch, f"origin/{base_branch}"):
        base = _git_out(root, "merge-base", "HEAD", ref)
        if base:
            return base
    return ""


def changed_files(root: Path, base_branch: str | None = None) -> tuple[list[str], bool]:
    """Files touched in the working tree, plus - when `base_branch` is given -
    everything committed since the branch diverged from it.

    Returns `(files, base_resolved)`. `base_resolved` is False when a base was
    requested but no merge-base could be found, so the caller can fall back
    to running every layer instead of trusting an empty diff.
    """
    files: set[str] = set()
    files |= set(_git_out(root, "diff", "--name-only", "HEAD").splitlines())
    files |= set(_git_out(root, "diff", "--name-only", "--cached").splitlines())
    # `ls-files --others` lists every untracked file individually; porcelain
    # status collapses a new directory to one `dir/` entry, which would hide
    # every file inside it from the prefix filters below.
    files |= set(_git_out(root, "ls-files", "--others", "--exclude-standard").splitlines())

    base_resolved = True
    if base_branch is not None:
        base = _resolve_base(root, base_branch)
        if base:
            files |= set(_git_out(root, "diff", "--name-only", f"{base}...HEAD").splitlines())
        else:
            base_resolved = False
    return sorted(f for f in files if f), base_resolved


def matches_any(path: str, patterns: Sequence[str]) -> bool:
    return any(fnmatch.fnmatch(path, pattern) for pattern in patterns)


# ---------------------------------------------------------------------------
# Tool resolution
# ---------------------------------------------------------------------------


def node_tool(frontend_dir: Path, tool: str) -> list[str] | None:
    """Command prefix for a frontend CLI: the project's own
    `node_modules/.bin` shim when present (skips npx's resolution overhead,
    ~1s a call), else `npx <tool>`, else None."""
    local = shutil.which(tool, path=str(frontend_dir / "node_modules" / ".bin"))
    if local:
        return [local]
    npx = shutil.which("npx")
    if npx:
        return [npx, tool]
    return None


def _module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


# ---------------------------------------------------------------------------
# testmon cache
# ---------------------------------------------------------------------------

_LEGACY_TESTMON_NAMES = (".testmondata", ".testmondata-wal", ".testmondata-shm", ".testmondata.head")


def migrate_legacy_testmon(paths: QaPaths, legacy_dirs: Sequence[Path]) -> None:
    """Move a pre-`.qa/` testmon database out of the repo root (or backend
    dir) into `.qa/testmon/`, or drop it when `.qa/` already has one."""
    for legacy_dir in legacy_dirs:
        legacy = legacy_dir / ".testmondata"
        if not legacy.exists():
            for name in _LEGACY_TESTMON_NAMES[1:]:
                (legacy_dir / name).unlink(missing_ok=True)
            continue
        paths.testmon_dir.mkdir(parents=True, exist_ok=True)
        adopt = not paths.testmon_datafile.exists()
        for name in _LEGACY_TESTMON_NAMES[:3]:
            source = legacy_dir / name
            if not source.exists():
                continue
            if adopt:
                source.replace(paths.testmon_dir / name)
            else:
                source.unlink()
        (legacy_dir / ".testmondata.head").unlink(missing_ok=True)


def testmon_cache_guard(paths: QaPaths, force_refresh: bool) -> str:
    """Discard the testmon database when it was built on history this HEAD
    does not descend from (a rebase, or a checkout of another branch).

    testmon's graph is content-addressed, so a database built on an ancestor
    of HEAD - the normal commit-then-test loop - stays valid and is kept.
    Returns a short note for the report ("" when the cache was kept).
    """
    head = _git_out(paths.root, "rev-parse", "HEAD")
    reason = "forced refresh" if force_refresh else ""
    if not force_refresh and head and paths.testmon_head.exists():
        marker = paths.testmon_head.read_text(encoding="utf-8").strip()
        if marker and marker != head:
            code, _ = _git(paths.root, "merge-base", "--is-ancestor", marker, head)
            if code != 0:
                reason = "HEAD no longer descends from the cached build"

    if reason:
        for name in _LEGACY_TESTMON_NAMES[:3]:
            (paths.testmon_dir / name).unlink(missing_ok=True)

    if head:
        paths.testmon_dir.mkdir(parents=True, exist_ok=True)
        paths.testmon_head.write_text(head, encoding="utf-8")
    return f"testmon cache rebuilt: {reason}" if reason else ""


# ---------------------------------------------------------------------------
# Step builders
# ---------------------------------------------------------------------------


def _python() -> str:
    return sys.executable


def pytest_step(cfg: QaConfig, paths: QaPaths, mode: str) -> Step:
    cwd = paths.root / cfg.backend_dir
    base = [_python(), "-m", "pytest", "-q"]
    if mode == "fast":
        if _module_available("testmon"):
            # `--testmon` alone, never combined with `-m`: a marker
            # expression layered on top makes testmon treat every run as a
            # new selection and re-run the whole suite.
            return Step(
                "pytest",
                "backend",
                "pytest",
                (*base, "--testmon"),
                cwd,
                env={"TESTMON_DATAFILE": str(paths.testmon_datafile)},
            )
        return Step("pytest", "backend", "pytest", (*base, "-m", "not integration"), cwd)
    if mode == "scoped":
        return Step("pytest", "backend", "pytest", (*base, "-m", "not integration"), cwd)
    return Step("pytest", "backend", "pytest", tuple(base), cwd)


def vitest_step(cfg: QaConfig, paths: QaPaths, related: Sequence[str] | None) -> Step:
    """`related=None` runs the whole suite; a list runs `vitest related`."""
    cwd = paths.root / cfg.frontend_dir
    prefix = node_tool(cwd, "vitest")
    if prefix is None:
        return Step("vitest", "frontend", "vitest", None, cwd, skip_reason="vitest/npx not found")
    if related is None:
        return Step("vitest", "frontend", "vitest", (*prefix, "run", "--reporter=dot", *cfg.vitest_args), cwd)
    abs_files = [str(paths.root / f) for f in related]
    return Step("vitest", "frontend", "vitest", (*prefix, "related", *abs_files, "--run", "--reporter=dot"), cwd)


def typecheck_step(cfg: QaConfig, paths: QaPaths) -> Step:
    cwd = paths.root / cfg.frontend_dir
    if not cfg.typecheck:
        return Step("typecheck", "typecheck", "tsc", None, cwd, skip_reason="no typecheck command configured")
    prefix = node_tool(cwd, cfg.typecheck[0])
    if prefix is None:
        return Step("typecheck", "typecheck", "tsc", None, cwd, skip_reason=f"{cfg.typecheck[0]}/npx not found")
    return Step("typecheck", "typecheck", "tsc", (*prefix, *cfg.typecheck[1:]), cwd)


def knip_step(cfg: QaConfig, paths: QaPaths) -> Step:
    cwd = paths.root / cfg.frontend_dir
    if not cfg.knip:
        return Step("knip", "typecheck", "knip", None, cwd, skip_reason="disabled in bedrock.toml")
    prefix = node_tool(cwd, "knip")
    if prefix is None:
        return Step("knip", "typecheck", "knip", None, cwd, skip_reason="knip/npx not found")
    return Step("knip", "typecheck", "knip", (*prefix, "--no-progress"), cwd)


def audit_steps(cfg: QaConfig, paths: QaPaths) -> list[Step]:
    root = paths.root
    steps = [
        Step(
            "platform-audits",
            "audits",
            "audit",
            (_python(), "-m", "bedrock.tools.run_all", "--root", str(root)),
            root,
        )
    ]
    if cfg.domain_audits:
        for script in sorted(root.glob(cfg.domain_audits)):
            steps.append(
                Step(script.stem, "audits", "audit", (_python(), str(script), "--root", str(root)), root)
            )
    return steps


def vulture_step(cfg: QaConfig, paths: QaPaths) -> Step:
    root = paths.root
    if not cfg.vulture_paths:
        return Step("vulture", "audits", "vulture", None, root, skip_reason="no vulture_paths configured")
    if not _module_available("vulture"):
        return Step("vulture", "audits", "vulture", None, root, skip_reason="vulture not installed")
    targets = [str(root / p) for p in cfg.vulture_paths]
    cmd = (_python(), "-m", "vulture", *targets, "--min-confidence", str(cfg.vulture_min_confidence))
    return Step("vulture", "audits", "vulture", cmd, root)


def plan_steps(
    cfg: QaConfig,
    paths: QaPaths,
    mode: str,
    *,
    dead_code: bool = False,
    changed: Sequence[str] = (),
    base_resolved: bool = True,
) -> list[Step]:
    """Every step `mode` runs (or reports as skipped), in lane order."""
    if mode not in MODES:
        raise ValueError(f"unknown mode: {mode}")

    steps: list[Step] = []
    frontend_cwd = paths.root / cfg.frontend_dir

    if mode == "fast":
        steps.append(pytest_step(cfg, paths, mode))
        frontend_changed = [
            f for f in changed if f.startswith(cfg.frontend_src.rstrip("/") + "/") and f.endswith(_FRONTEND_SRC_SUFFIXES)
        ]
        if frontend_changed:
            steps.append(vitest_step(cfg, paths, frontend_changed))
        else:
            steps.append(Step("vitest", "frontend", "vitest", None, frontend_cwd, skip_reason="no frontend changes"))
    elif mode == "scoped":
        # No baseline, or nothing changed at all (sitting on the base
        # branch): verify everything rather than trust an empty diff.
        run_all_layers = not base_resolved or not changed
        backend_touched = run_all_layers or any(matches_any(f, cfg.backend_paths) for f in changed)
        frontend_touched = run_all_layers or any(matches_any(f, cfg.frontend_paths) for f in changed)
        if backend_touched:
            steps.append(pytest_step(cfg, paths, mode))
        else:
            steps.append(Step("pytest", "backend", "pytest", None, paths.root, skip_reason="no backend changes"))
        if frontend_touched:
            steps.append(vitest_step(cfg, paths, None))
            steps.append(typecheck_step(cfg, paths))
        else:
            steps.append(Step("vitest", "frontend", "vitest", None, frontend_cwd, skip_reason="no frontend changes"))
            steps.append(Step("typecheck", "typecheck", "tsc", None, frontend_cwd, skip_reason="no frontend changes"))
        steps.extend(audit_steps(cfg, paths))
    else:
        steps.append(pytest_step(cfg, paths, mode))
        steps.append(vitest_step(cfg, paths, None))
        steps.append(typecheck_step(cfg, paths))
        steps.extend(audit_steps(cfg, paths))
        dead_code = True

    if dead_code:
        steps.append(knip_step(cfg, paths))
        steps.append(vulture_step(cfg, paths))

    lane_rank = {lane: i for i, lane in enumerate(LANE_ORDER)}
    return sorted(steps, key=lambda s: lane_rank.get(s.lane, len(LANE_ORDER)))


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------


def _pytest_summary(output: str) -> str:
    if not output.strip():
        return "no tests selected (testmon: nothing changed)"
    for line in reversed(output.splitlines()):
        stripped = _ANSI_ESCAPE.sub("", line).strip().strip("= ")
        if "no tests ran" in stripped:
            return stripped
        if re.search(r"\d+ (passed|failed|error|errors|deselected|skipped)\b", stripped) and " in " in stripped:
            return stripped
    counted = _pytest_progress_counts(output)
    if counted:
        return counted
    if "100%]" in output:
        return "completed (no summary footer)"
    return "no summary line found"


_PROGRESS_LINE = re.compile(r"^([.FEsxX]+)\s*\[\s*\d+%\]$")
_PROGRESS_OUTCOMES = (("F", "failed"), (".", "passed"), ("s", "skipped"), ("x", "xfailed"), ("X", "xpassed"), ("E", "error"))


def _pytest_progress_counts(output: str) -> str:
    """Outcome counts from the progress lines, for output without the counts
    footer - an `addopts = -q` stacked on the runner's own `-q` is `-qq`."""
    marks = "".join(
        m.group(1)
        for line in output.splitlines()
        if (m := _PROGRESS_LINE.match(_ANSI_ESCAPE.sub("", line).strip()))
    )
    parts = [f"{marks.count(ch)} {label}" for ch, label in _PROGRESS_OUTCOMES if marks.count(ch)]
    return f"{', '.join(parts)} (from progress)" if parts else ""


def _vitest_summary(output: str) -> str:
    lines = [_ANSI_ESCAPE.sub("", line).strip() for line in output.splitlines()]
    files = next((line for line in reversed(lines) if line.lower().startswith("test files")), "")
    tests = next((line for line in reversed(lines) if line.lower().startswith("tests ")), "")
    if files:
        return f"{files}; {tests}" if tests else files
    if any("no test files found" in line.lower() for line in lines):
        return "no test files found"
    return "no summary line found"


def _audit_summary(output: str) -> str:
    for line in reversed(output.splitlines()):
        if line.startswith("Total:"):
            return line.strip()
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    return lines[-1][:200] if lines else ""


def summarize(kind: str, code: int, output: str) -> str:
    if kind == "pytest":
        return _pytest_summary(output)
    if kind == "vitest":
        return _vitest_summary(output)
    if kind == "audit":
        return _audit_summary(output)
    if kind == "vulture":
        return "clean" if code == 0 else f"{len(output.splitlines())} finding(s)"
    if kind == "knip":
        return "clean" if code == 0 else "unused code/dependencies found"
    return "clean" if code == 0 else "errors found"


def classify(kind: str, code: int, output: str) -> str:
    if code == _EXIT_NOT_FOUND and output.startswith(("executable not found", "working directory not found")):
        return "error"
    if code == 0:
        return "pass"
    if kind == "pytest" and code == _PYTEST_NO_TESTS_COLLECTED:
        return "pass"
    # Audits use 2 for "could not run" (configuration error).
    if kind == "audit" and code == 2:
        return "error"
    return "fail"


def run_step(step: Step) -> StepResult:
    if step.cmd is None:
        return StepResult(step.name, step.lane, "skip", 0, 0.0, summary=step.skip_reason)
    start = time.monotonic()
    code, output = _run(step.cmd, step.cwd, step.env)
    duration_ms = (time.monotonic() - start) * 1000
    status = classify(step.kind, code, output)
    return StepResult(
        name=step.name,
        lane=step.lane,
        status=status,
        exit_code=code,
        duration_ms=duration_ms,
        summary=summarize(step.kind, code, output),
        output_tail=_tail(output) if status in ("fail", "error") else "",
    )


def _run_lane(steps: Sequence[Step], runner: Callable[[Step], StepResult]) -> list[StepResult]:
    # Independent checks: every step runs even after an earlier one failed.
    return [runner(step) for step in steps]


def run_lanes(
    steps: Sequence[Step],
    *,
    runner: Callable[[Step], StepResult] | None = None,
) -> list[StepResult]:
    """Run each lane on its own thread; steps within a lane run in order.
    Results come back in the order `steps` declared them."""
    if runner is None:
        runner = run_step
    lanes: dict[str, list[Step]] = {}
    for step in steps:
        lanes.setdefault(step.lane, []).append(step)
    if not lanes:
        return []
    with ThreadPoolExecutor(max_workers=len(lanes)) as pool:
        futures = {lane: pool.submit(_run_lane, lane_steps, runner) for lane, lane_steps in lanes.items()}
        by_step: dict[int, StepResult] = {}
        for lane, future in futures.items():
            for step, result in zip(lanes[lane], future.result()):
                by_step[id(step)] = result
    return [by_step[id(step)] for step in steps]


def aggregate_exit(results: Sequence[StepResult]) -> int:
    """2 if any step errored, else 1 if any failed, else 0."""
    if any(r.status == "error" for r in results):
        return 2
    if any(r.status == "fail" for r in results):
        return 1
    return 0


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def build_report(
    mode: str,
    results: Sequence[StepResult],
    exit_code: int,
    duration_ms: float,
    *,
    root: Path,
    notes: Sequence[str] = (),
) -> dict[str, object]:
    return {
        "status": "pass" if exit_code == 0 else "fail",
        "exit": exit_code,
        "mode": mode,
        "duration_ms": round(duration_ms, 1),
        "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "head": _git_out(root, "rev-parse", "--short", "HEAD"),
        "branch": _git_out(root, "rev-parse", "--abbrev-ref", "HEAD"),
        "host": {"python": platform.python_version(), "platform": sys.platform, "cpus": os.cpu_count()},
        "notes": list(notes),
        "steps": [
            {k: (round(v, 1) if k == "duration_ms" else v) for k, v in asdict(r).items() if k != "output_tail"}
            for r in results
        ],
        "failures": [
            {"name": r.name, "status": r.status, "summary": r.summary, "output_tail": r.output_tail}
            for r in results
            if r.status in ("fail", "error")
        ],
    }


def write_report(
    paths: QaPaths,
    report: Mapping[str, object],
    results: Sequence[StepResult],
    history_limit: int,
) -> Path:
    """Write `last-<mode>.json`, append a compact line to `history.jsonl`
    (keeping only the newest `history_limit` lines), and regenerate the
    `index.html` viewer over both."""
    paths.reports_dir.mkdir(parents=True, exist_ok=True)
    last = paths.reports_dir / f"last-{report['mode']}.json"
    last.write_text(json.dumps(report, indent=2), encoding="utf-8")

    compact = {
        "timestamp": report["timestamp"],
        "mode": report["mode"],
        "head": report["head"],
        "branch": report["branch"],
        "exit": report["exit"],
        "duration_ms": report["duration_ms"],
        "steps": {
            r.name: {"status": r.status, "ms": round(r.duration_ms, 1), "summary": r.summary} for r in results
        },
    }
    history = paths.reports_dir / qa_report.HISTORY_NAME
    lines = history.read_text(encoding="utf-8").splitlines() if history.exists() else []
    lines.append(json.dumps(compact))
    history.write_text("\n".join(lines[-history_limit:]) + "\n", encoding="utf-8")
    qa_report.write_html(paths.reports_dir, repo_name=paths.root.name)
    return last


def render_text(results: Sequence[StepResult], exit_code: int, duration_ms: float, notes: Sequence[str]) -> str:
    banner = "=" * 80
    lines = [banner, "[RUN-QA] Unified QA Orchestrator", banner]
    for note in notes:
        lines.append(f"  note: {note}")
    for r in results:
        marker = r.status.upper()
        lines.append(f"  [{marker}] {r.lane}/{r.name}  ({r.duration_ms:.0f}ms)  {r.summary}")
        if r.output_tail:
            lines.append(f"    --- last {_FAILURE_TAIL_LINES} lines ---")
            lines.extend(f"    {tail_line}" for tail_line in r.output_tail.splitlines())
    counts = {s: sum(1 for r in results if r.status == s) for s in ("pass", "fail", "error", "skip")}
    lines.append(banner)
    lines.append(
        f"Total: {len(results)}  Passed: {counts['pass']}  Failed: {counts['fail']}  "
        f"Errors: {counts['error']}  Skipped: {counts['skip']}  Elapsed: {duration_ms:.0f}ms  Exit: {exit_code}"
    )
    lines.append(banner)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def run_qa(
    root: Path,
    mode: str,
    *,
    dead_code: bool = False,
    force_refresh: bool = False,
    cfg: QaConfig | None = None,
) -> tuple[list[StepResult], list[str]]:
    if cfg is None:
        cfg = load_qa_config(root)
    paths = QaPaths(root)
    notes: list[str] = []

    if mode == "fast":
        migrate_legacy_testmon(paths, [root, root / cfg.backend_dir])
        note = testmon_cache_guard(paths, force_refresh)
        if note:
            notes.append(note)
        if not _module_available("testmon"):
            notes.append("pytest-testmon not installed: fast tier runs the full non-integration suite")
        changed, base_resolved = changed_files(root)
    elif mode == "scoped":
        changed, base_resolved = changed_files(root, cfg.base_branch)
        if not base_resolved:
            notes.append(f"no merge-base with {cfg.base_branch}: running every layer")
        elif not changed:
            notes.append("no changes against the base branch: running every layer")
    else:
        changed, base_resolved = [], True

    steps = plan_steps(cfg, paths, mode, dead_code=dead_code, changed=changed, base_resolved=base_resolved)
    return run_lanes(steps), notes


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", default=".", help="repository root (the directory holding bedrock.toml)")
    parser.add_argument("--mode", choices=MODES, default="fast", help="test tier to execute")
    parser.add_argument("--dead-code", action="store_true", help="also run vulture and knip (always on in full)")
    parser.add_argument("--json", action="store_true", help="emit one line of machine-readable JSON instead of text")
    parser.add_argument("--force-refresh", action="store_true", help="discard the testmon cache before a fast run")
    parser.add_argument("--no-report", action="store_true", help="do not write .qa/reports/")
    args = parser.parse_args(argv)

    # Failure tails carry vitest's check marks and box drawing. Redirected to a
    # file on Windows, stdout is cp1252, and printing one would crash the
    # orchestrator after every step had already run.
    if isinstance(sys.stdout, io.TextIOWrapper):
        sys.stdout.reconfigure(errors="replace")

    root = Path(args.root).resolve()
    try:
        cfg = load_qa_config(root)
    except (OSError, ValueError) as exc:
        print(f"run_qa: configuration error: {exc}", file=sys.stderr)
        return 2

    start = time.monotonic()
    results, notes = run_qa(root, args.mode, dead_code=args.dead_code, force_refresh=args.force_refresh, cfg=cfg)
    duration_ms = (time.monotonic() - start) * 1000
    exit_code = aggregate_exit(results)

    report = build_report(args.mode, results, exit_code, duration_ms, root=root, notes=notes)
    if not args.no_report:
        last = write_report(QaPaths(root), report, results, cfg.history_limit)
        report["report"] = str(last.relative_to(root)).replace("\\", "/")

    if args.json:
        print(json.dumps(report))
    else:
        print(render_text(results, exit_code, duration_ms, notes))
        if "report" in report:
            print(f"Report: {report['report']}")
            print(f"Viewer: {QA_DIR_NAME}/reports/{qa_report.INDEX_NAME}")
    return exit_code


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
