"""Dispatch isolation for the `run_audit.ps1` consumer template (#88).

The template is executed for real under `pwsh` with a stub `python` first on
PATH that records its argv, so the assertions are about what the runner
*dispatched*, not about what its source text happens to contain.
"""
import os
import shutil
import stat
import subprocess
import sys
from pathlib import Path

TEMPLATE = (
    Path(__file__).resolve().parents[1]
    / "bedrock"
    / "templates"
    / "scripts"
    / "run_audit.ps1"
)


def _run(tmp_path: Path, *args: str, with_domain_audit: bool) -> tuple[int, list[str]]:
    pwsh = shutil.which("pwsh")
    assert pwsh, "PowerShell 7 (pwsh) is required to exercise the runner template"
    assert TEMPLATE.exists(), f"template missing: {TEMPLATE}"

    scripts = tmp_path / "scripts"
    scripts.mkdir()
    shutil.copy(TEMPLATE, scripts / "run_audit.ps1")
    if with_domain_audit:
        audit_dir = scripts / "audit"
        audit_dir.mkdir()
        (audit_dir / "s101_audit_example.py").write_text("", encoding="utf-8")

    log = tmp_path / "python-calls.log"
    shim_dir = tmp_path / "shim"
    shim_dir.mkdir()
    if sys.platform == "win32":
        (shim_dir / "python.cmd").write_text(
            f'@echo %*>> "{log}"\r\n@exit /b 0\r\n', encoding="utf-8"
        )
    else:
        shim = shim_dir / "python"
        shim.write_text(f'#!/bin/sh\necho "$@" >> "{log}"\nexit 0\n', encoding="utf-8")
        shim.chmod(shim.stat().st_mode | stat.S_IEXEC)

    env = {**os.environ, "PATH": f"{shim_dir}{os.pathsep}{os.environ['PATH']}"}
    proc = subprocess.run(
        [pwsh, "-NoProfile", "-File", str(scripts / "run_audit.ps1"), *args],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
    )
    calls = log.read_text(encoding="utf-8").splitlines() if log.exists() else []
    return proc.returncode, calls


def test_domain_switch_runs_only_domain_audits(tmp_path: Path):
    code, calls = _run(tmp_path, "-Domain", with_domain_audit=True)

    assert code == 0
    assert any("s101_audit_example.py" in c for c in calls)
    assert not any("bedrock.tools.run_all" in c for c in calls)


def test_domain_switch_with_no_domain_audits_exits_zero_without_platform_run(tmp_path: Path):
    code, calls = _run(tmp_path, "-Domain", with_domain_audit=False)

    assert code == 0
    assert calls == []


def test_platform_switch_runs_only_platform_audits(tmp_path: Path):
    code, calls = _run(tmp_path, "-Platform", with_domain_audit=True)

    assert code == 0
    assert any("bedrock.tools.run_all" in c for c in calls)
    assert not any("s101_audit_example.py" in c for c in calls)


def test_no_switch_runs_platform_and_domain(tmp_path: Path):
    code, calls = _run(tmp_path, with_domain_audit=True)

    assert code == 0
    assert any("bedrock.tools.run_all" in c for c in calls)
    assert any("s101_audit_example.py" in c for c in calls)
