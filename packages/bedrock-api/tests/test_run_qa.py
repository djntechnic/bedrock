"""Tests for the shared QA orchestrator (`bedrock.tools.run_qa`) and its
`[tool.bedrock.qa]` manifest section.

Git-dependent cases build a throwaway repository under `tmp_path`; lane
concurrency is exercised with trivial `python -c` subprocesses so the suite
stays fast and deterministic.
"""
from __future__ import annotations

import io
import json
import subprocess
import sys
import time
from pathlib import Path

import pytest

from bedrock.tools import run_qa
from bedrock.tools._config import QaConfig, load_qa_config
from bedrock.tools.run_qa import QaPaths, Step, StepResult

PY = sys.executable


def _git(repo: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=repo, check=True, capture_output=True, text=True
    ).stdout.strip()


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    _git(tmp_path, "init", "-q", "-b", "master")
    _git(tmp_path, "config", "user.email", "qa@example.invalid")
    _git(tmp_path, "config", "user.name", "qa")
    _git(tmp_path, "config", "commit.gpgsign", "false")
    (tmp_path / "README.md").write_text("x\n", encoding="utf-8")
    _git(tmp_path, "add", ".")
    _git(tmp_path, "commit", "-q", "-m", "init")
    return tmp_path


def _commit(repo: Path, name: str) -> str:
    (repo / name).write_text(name, encoding="utf-8")
    _git(repo, "add", name)
    _git(repo, "commit", "-q", "-m", name)
    return _git(repo, "rev-parse", "HEAD")


def _ok(step: Step) -> StepResult:
    return StepResult(step.name, step.lane, "pass", 0, 1.0, summary="ok")


# --- [tool.bedrock.qa] -------------------------------------------------------


def test_load_qa_config_defaults_without_section(tmp_path: Path):
    (tmp_path / "bedrock.toml").write_text("[tool.bedrock]\n", encoding="utf-8")
    assert load_qa_config(tmp_path) == QaConfig()


def test_load_qa_config_defaults_without_manifest(tmp_path: Path):
    assert load_qa_config(tmp_path) == QaConfig()


def test_load_qa_config_reads_overrides(tmp_path: Path):
    (tmp_path / "bedrock.toml").write_text(
        "[tool.bedrock.qa]\n"
        'backend_dir = "packages/bedrock-api"\n'
        'frontend_dir = "."\n'
        'typecheck = ["tsc", "--noEmit", "-p", "x.json"]\n'
        "knip = false\n"
        "history_limit = 10\n",
        encoding="utf-8",
    )
    cfg = load_qa_config(tmp_path)
    assert cfg.backend_dir == "packages/bedrock-api"
    assert cfg.frontend_dir == "."
    assert cfg.typecheck == ("tsc", "--noEmit", "-p", "x.json")
    assert cfg.knip is False
    assert cfg.history_limit == 10


@pytest.mark.parametrize(
    "line",
    ['typecheck = "tsc"', 'knip = "yes"', "history_limit = 0", "backend_dir = 3"],
)
def test_load_qa_config_rejects_wrong_types(tmp_path: Path, line: str):
    (tmp_path / "bedrock.toml").write_text(f"[tool.bedrock.qa]\n{line}\n", encoding="utf-8")
    with pytest.raises(ValueError):
        load_qa_config(tmp_path)


# --- change detection ---------------------------------------------------------


def test_changed_files_lists_files_inside_new_untracked_directories(repo: Path):
    (repo / "frontend" / "src" / "new").mkdir(parents=True)
    (repo / "frontend" / "src" / "new" / "Widget.tsx").write_text("", encoding="utf-8")

    files, resolved = run_qa.changed_files(repo)

    assert resolved
    assert "frontend/src/new/Widget.tsx" in files


def test_changed_files_with_base_includes_committed_branch_diff(repo: Path):
    _git(repo, "checkout", "-q", "-b", "feat/x")
    _commit(repo, "api.py")

    files, resolved = run_qa.changed_files(repo, "master")

    assert resolved
    assert files == ["api.py"]


def test_changed_files_reports_unresolvable_base(repo: Path):
    files, resolved = run_qa.changed_files(repo, "no-such-branch")
    assert files == []
    assert resolved is False


# --- testmon cache -------------------------------------------------------------


def _seed_testmon(paths: QaPaths) -> None:
    paths.testmon_dir.mkdir(parents=True, exist_ok=True)
    paths.testmon_datafile.write_text("db", encoding="utf-8")


def test_testmon_cache_survives_a_new_commit(repo: Path):
    paths = QaPaths(repo)
    _seed_testmon(paths)
    run_qa.testmon_cache_guard(paths, force_refresh=False)

    _commit(repo, "next.py")
    note = run_qa.testmon_cache_guard(paths, force_refresh=False)

    assert note == ""
    assert paths.testmon_datafile.exists()
    assert paths.testmon_head.read_text(encoding="utf-8") == _git(repo, "rev-parse", "HEAD")


def test_testmon_cache_dropped_when_head_leaves_cached_history(repo: Path):
    paths = QaPaths(repo)
    _git(repo, "checkout", "-q", "-b", "other")
    _commit(repo, "other.py")
    _seed_testmon(paths)
    run_qa.testmon_cache_guard(paths, force_refresh=False)

    _git(repo, "checkout", "-q", "master")
    note = run_qa.testmon_cache_guard(paths, force_refresh=False)

    assert "no longer descends" in note
    assert not paths.testmon_datafile.exists()


def test_testmon_force_refresh_drops_cache(repo: Path):
    paths = QaPaths(repo)
    _seed_testmon(paths)
    note = run_qa.testmon_cache_guard(paths, force_refresh=True)
    assert "forced" in note
    assert not paths.testmon_datafile.exists()


def test_legacy_root_testmondata_is_moved_under_qa(tmp_path: Path):
    for name in (".testmondata", ".testmondata-wal", ".testmondata.head"):
        (tmp_path / name).write_text(name, encoding="utf-8")
    paths = QaPaths(tmp_path)

    run_qa.migrate_legacy_testmon(paths, [tmp_path])

    assert paths.testmon_datafile.read_text(encoding="utf-8") == ".testmondata"
    assert (paths.testmon_dir / ".testmondata-wal").exists()
    assert not any((tmp_path / n).exists() for n in (".testmondata", ".testmondata-wal", ".testmondata.head"))


def test_legacy_testmondata_is_dropped_when_qa_cache_exists(tmp_path: Path):
    paths = QaPaths(tmp_path)
    _seed_testmon(paths)
    (tmp_path / ".testmondata").write_text("old", encoding="utf-8")

    run_qa.migrate_legacy_testmon(paths, [tmp_path])

    assert paths.testmon_datafile.read_text(encoding="utf-8") == "db"
    assert not (tmp_path / ".testmondata").exists()


# --- planning -----------------------------------------------------------------


def _names(steps: list[Step]) -> dict[str, Step]:
    return {s.name: s for s in steps}


def test_fast_plan_skips_vitest_without_frontend_source_changes(tmp_path: Path):
    steps = _names(run_qa.plan_steps(QaConfig(), QaPaths(tmp_path), "fast", changed=["api/x.py", "frontend/package.json"]))
    assert steps["vitest"].cmd is None
    assert steps["pytest"].cmd is not None


def test_fast_plan_runs_vitest_related_on_changed_sources(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(run_qa, "node_tool", lambda _cwd, tool: ["npx", tool])
    steps = _names(run_qa.plan_steps(QaConfig(), QaPaths(tmp_path), "fast", changed=["frontend/src/A.tsx"]))
    vitest = steps["vitest"]
    assert vitest.cmd == ("npx", "vitest", "related", str(tmp_path / "frontend/src/A.tsx"), "--run", "--reporter=dot")


def test_plan_skips_frontend_steps_when_no_node_tool_resolves(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(run_qa, "node_tool", lambda _cwd, _tool: None)
    steps = _names(run_qa.plan_steps(QaConfig(), QaPaths(tmp_path), "fast", changed=["frontend/src/A.tsx"]))
    assert steps["vitest"].cmd is None
    assert steps["vitest"].skip_reason == "vitest/npx not found"


def test_fast_plan_points_testmon_at_qa_dir(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(run_qa, "_module_available", lambda _name: True)
    step = _names(run_qa.plan_steps(QaConfig(), QaPaths(tmp_path), "fast"))["pytest"]
    assert step.cmd is not None and "--testmon" in step.cmd
    # A marker filter beside --testmon makes testmon discard its cache.
    assert "not integration" not in step.cmd
    assert step.env == {"TESTMON_DATAFILE": str(tmp_path / ".qa" / "testmon" / ".testmondata")}


def test_scoped_plan_skips_untouched_layers(tmp_path: Path):
    steps = _names(run_qa.plan_steps(QaConfig(), QaPaths(tmp_path), "scoped", changed=["docs/x.md"]))
    assert steps["pytest"].cmd is None
    assert steps["vitest"].cmd is None
    assert steps["typecheck"].cmd is None
    assert steps["platform-audits"].cmd is not None


def test_scoped_plan_runs_backend_when_backend_touched(tmp_path: Path):
    steps = _names(run_qa.plan_steps(QaConfig(), QaPaths(tmp_path), "scoped", changed=["api/routes/x.py"]))
    assert steps["pytest"].cmd is not None
    assert steps["vitest"].cmd is None


@pytest.mark.parametrize("changed,resolved", [([], True), (["docs/x.md"], False)])
def test_scoped_plan_runs_every_layer_without_a_usable_diff(tmp_path: Path, changed, resolved):
    steps = _names(
        run_qa.plan_steps(QaConfig(), QaPaths(tmp_path), "scoped", changed=changed, base_resolved=resolved)
    )
    assert steps["pytest"].cmd is not None
    assert steps["typecheck"].skip_reason != "no frontend changes"


def test_full_plan_includes_domain_audits_and_dead_code(tmp_path: Path):
    audit_dir = tmp_path / "scripts" / "audit"
    audit_dir.mkdir(parents=True)
    (audit_dir / "s101_audit_example.py").write_text("", encoding="utf-8")

    steps = run_qa.plan_steps(QaConfig(), QaPaths(tmp_path), "full")
    names = [s.name for s in steps]

    assert {"pytest", "vitest", "typecheck", "platform-audits", "s101_audit_example", "knip", "vulture"} <= set(names)
    lanes = [s.lane for s in steps]
    assert lanes == sorted(lanes, key=run_qa.LANE_ORDER.index)


def test_unknown_mode_rejected(tmp_path: Path):
    with pytest.raises(ValueError):
        run_qa.plan_steps(QaConfig(), QaPaths(tmp_path), "nope")


# --- execution ----------------------------------------------------------------


def _py_step(name: str, lane: str, code: str, tmp_path: Path, kind: str = "audit") -> Step:
    return Step(name, lane, kind, (PY, "-c", code), tmp_path)


def test_lanes_run_concurrently_and_keep_declared_order(tmp_path: Path):
    steps = [
        _py_step("a", "backend", "import time; time.sleep(1.0)", tmp_path),
        _py_step("b", "frontend", "import time; time.sleep(1.0)", tmp_path),
    ]
    start = time.monotonic()
    results = run_qa.run_lanes(steps)
    elapsed = time.monotonic() - start

    assert [r.name for r in results] == ["a", "b"]
    assert elapsed < 1.8


def test_lane_keeps_running_after_a_failed_step(tmp_path: Path):
    steps = [
        _py_step("first", "audits", "import sys; sys.exit(1)", tmp_path),
        _py_step("second", "audits", "pass", tmp_path),
    ]
    results = run_qa.run_lanes(steps)
    assert [(r.name, r.status) for r in results] == [("first", "fail"), ("second", "pass")]
    assert run_qa.aggregate_exit(results) == 1


def test_missing_executable_is_an_error_not_a_failure(tmp_path: Path):
    step = Step("ghost", "audits", "audit", ("definitely-not-a-real-binary-xyz",), tmp_path)
    result = run_qa.run_step(step)
    assert result.status == "error"
    assert run_qa.aggregate_exit([result]) == 2


def test_skipped_step_does_not_fail_the_run(tmp_path: Path):
    result = run_qa.run_step(Step("vitest", "frontend", "vitest", None, tmp_path, skip_reason="none"))
    assert result.status == "skip"
    assert run_qa.aggregate_exit([result]) == 0


def test_pytest_no_tests_collected_passes():
    assert run_qa.classify("pytest", 5, "no tests ran") == "pass"
    assert run_qa.classify("audit", 5, "") == "fail"


@pytest.mark.parametrize(
    "output,expected",
    [
        ("....\n12 passed, 3 deselected in 4.10s\n", "12 passed, 3 deselected in 4.10s"),
        ("=== 1 failed, 2 passed in 0.5s ===", "1 failed, 2 passed in 0.5s"),
        ("", "no tests selected (testmon: nothing changed)"),
        # A pytest.ini `addopts = -q` on top of the runner's own -q is -qq,
        # which drops the counts footer; the progress lines still carry them.
        (
            "....F.s. [ 80%]\n.E   [100%]\n=== FAILURES ===\nFAILED tests/x.py::t\n",
            "1 failed, 7 passed, 1 skipped, 1 error (from progress)",
        ),
    ],
)
def test_pytest_summary(output: str, expected: str):
    assert run_qa.summarize("pytest", 0, output) == expected


def test_vitest_summary_strips_ansi():
    out = "\x1b[2m Test Files \x1b[22m 3 passed (3)\n\x1b[2m      Tests \x1b[22m 9 passed (9)\n"
    assert run_qa.summarize("vitest", 0, out) == "Test Files  3 passed (3); Tests  9 passed (9)"


# --- reporting ----------------------------------------------------------------


def test_write_report_rotates_history(tmp_path: Path):
    paths = QaPaths(tmp_path)
    results = [StepResult("pytest", "backend", "pass", 0, 12.34)]
    report = run_qa.build_report("fast", results, 0, 20.0, root=tmp_path)
    last = run_qa.write_report(paths, report, results, history_limit=3)
    for _ in range(4):
        run_qa.write_report(paths, report, results, history_limit=3)

    history = (paths.reports_dir / "history.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(history) == 3
    assert json.loads(history[-1])["steps"] == {"pytest": {"status": "pass", "ms": 12.3, "summary": ""}}
    assert last == paths.reports_dir / "last-fast.json"
    assert (paths.reports_dir / "index.html").is_file()
    assert json.loads(last.read_text(encoding="utf-8"))["mode"] == "fast"


def test_main_json_writes_report_under_qa(repo: Path, monkeypatch, capsys):
    (repo / "bedrock.toml").write_text('[tool.bedrock.qa]\ndomain_audits = ""\n', encoding="utf-8")
    monkeypatch.setattr(run_qa, "run_step", _ok)

    code = run_qa.main(["--root", str(repo), "--mode", "full", "--json"])

    payload = json.loads(capsys.readouterr().out)
    assert code == 0
    assert payload["status"] == "pass"
    assert payload["report"] == ".qa/reports/last-full.json"
    assert (repo / ".qa" / "reports" / "history.jsonl").exists()
    assert (repo / ".qa" / "reports" / "index.html").exists()
    assert not any(p.name.startswith(".testmondata") for p in repo.iterdir())


def test_main_no_report_leaves_no_artifacts(repo: Path, monkeypatch, capsys):
    monkeypatch.setattr(run_qa, "run_step", _ok)
    run_qa.main(["--root", str(repo), "--mode", "scoped", "--no-report"])
    assert "Total:" in capsys.readouterr().out
    assert not (repo / ".qa" / "reports").exists()


def test_main_rejects_bad_config(repo: Path):
    (repo / "bedrock.toml").write_text('[tool.bedrock.qa]\nknip = "no"\n', encoding="utf-8")
    assert run_qa.main(["--root", str(repo), "--mode", "full"]) == 2


def test_main_survives_a_failure_tail_a_cp1252_stdout_cannot_encode(repo: Path, monkeypatch):
    # Regression: a vitest failure tail carries U+2713; printing it to a
    # redirected Windows stdout (cp1252) raised UnicodeEncodeError after
    # every step had already run, and the run reported nothing.
    def failing(step: Step) -> StepResult:
        return StepResult(step.name, step.lane, "fail", 1, 1.0, summary="1 failed", output_tail="✓ ok\n× broke")

    raw = io.BytesIO()
    monkeypatch.setattr(sys, "stdout", io.TextIOWrapper(raw, encoding="cp1252"))
    monkeypatch.setattr(run_qa, "run_step", failing)

    code = run_qa.main(["--root", str(repo), "--mode", "full", "--no-report"])

    sys.stdout.flush()
    assert code == 1
    assert b"Total:" in raw.getvalue()
