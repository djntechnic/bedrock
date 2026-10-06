"""bedrock.tools.qa_report - the HTML viewer over .qa/reports/."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

import pytest

from bedrock.tools import qa_report

_DATA_ELEMENT = re.compile(r'<script type="application/json" id="qa-data">(.*?)</script>', re.S)


def _embedded(page: str) -> dict[str, object]:
    match = _DATA_ELEMENT.search(page)
    assert match, "data element missing or terminated early"
    return json.loads(match.group(1))


def _run(mode: str, exit_code: int, ms: float, **steps: str) -> dict[str, object]:
    return {
        "timestamp": "2026-10-06T12:00:00+00:00",
        "mode": mode,
        "head": "abc1234",
        "branch": "perf/qa-pipeline",
        "exit": exit_code,
        "duration_ms": ms,
        "steps": {name: {"status": status, "ms": 10.0, "summary": ""} for name, status in steps.items()},
    }


def test_template_ships_with_the_package() -> None:
    assert qa_report.TEMPLATE_PATH.is_file()


def test_render_embeds_history_and_latest_and_fills_every_placeholder() -> None:
    history = [_run("fast", 0, 3500.0, pytest="pass"), _run("full", 1, 240000.0, pytest="fail", knip="pass")]
    latest = {"full": {"mode": "full", "exit": 1, "steps": [], "failures": []}}
    page = qa_report.render_html(
        history, latest, repo_name="bedrock", generated=datetime(2026, 10, 6, tzinfo=timezone.utc)
    )

    assert "__REPO_NAME__" not in page and "__QA_DATA__" not in page
    assert "<title>QA Runs · bedrock</title>" in page
    data = _embedded(page)
    assert data["history"] == history
    assert data["latest"] == latest
    assert data["generated"] == "2026-10-06T00:00:00+00:00"


def test_captured_output_cannot_break_out_of_the_data_element() -> None:
    hostile = "</script><script>alert(1)</script><!-- __REPO_NAME__"
    latest = {"full": {"mode": "full", "exit": 1, "failures": [{"name": "vitest", "output_tail": hostile}]}}
    page = qa_report.render_html([], latest, repo_name="<b>repo</b>")

    assert "</script><script>alert(1)" not in page
    assert "<b>repo</b>" not in page and "&lt;b&gt;repo&lt;/b&gt;" in page
    # The placeholder spelled inside the data survives verbatim, not re-expanded.
    assert _embedded(page)["latest"] == latest


def test_empty_reports_dir_renders_an_empty_page(tmp_path: Path) -> None:
    out = qa_report.write_html(tmp_path / "reports", repo_name="empty")

    assert out == tmp_path / "reports" / "index.html"
    data = _embedded(out.read_text(encoding="utf-8"))
    assert data["history"] == [] and data["latest"] == {}


def test_unreadable_history_lines_and_reports_are_skipped(tmp_path: Path) -> None:
    good = _run("fast", 0, 1.0, pytest="pass")
    (tmp_path / "history.jsonl").write_text(
        json.dumps(good) + "\n{truncated\n\n[1, 2]\n", encoding="utf-8"
    )
    (tmp_path / "last-fast.json").write_text(json.dumps({"mode": "fast", "exit": 0}), encoding="utf-8")
    (tmp_path / "last-full.json").write_text("{not json", encoding="utf-8")

    assert qa_report.read_history(tmp_path) == [good]
    assert qa_report.read_latest(tmp_path) == {"fast": {"mode": "fast", "exit": 0}}


def test_cli_writes_index_under_dot_qa(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    reports = tmp_path / ".qa" / "reports"
    reports.mkdir(parents=True)
    (reports / "history.jsonl").write_text(json.dumps(_run("scoped", 0, 5.0)) + "\n", encoding="utf-8")

    assert qa_report.main(["--root", str(tmp_path)]) == 0
    assert (reports / "index.html").is_file()
    assert "index.html" in capsys.readouterr().out
