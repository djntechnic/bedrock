"""Unit tests for the unified AuditReporter engine (bedrock.tools._reporter)."""
from pathlib import Path

import pytest

from bedrock.tools._reporter import AuditReporter


def _reporter(tmp_path: Path) -> AuditReporter:
    return AuditReporter("S001", "No Duplicate UI Code", tmp_path, tmp_path / "bedrock.toml")


def test_audit_reporter_pass(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check("Found 0 duplicates")
    assert reporter.finish() == 0


def test_audit_reporter_fail(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.fail_check("Twin component found", file_path="Button.tsx", line=10, hint="Use bedrock-ui")
    assert reporter.finish() == 1


def test_audit_reporter_error(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Loading configuration")
    reporter.error("bedrock.toml is missing a required [tool.bedrock] section")
    assert reporter.finish() == 2


def test_error_takes_precedence_over_pass(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check("Found 0 duplicates")
    reporter.error("unexpected runtime fault")
    assert reporter.finish() == 2


def test_error_takes_precedence_over_fail(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.fail_check("Twin component found")
    reporter.error("unexpected runtime fault")
    assert reporter.finish() == 2


def test_fail_check_defaults_are_optional(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.fail_check("Twin component found")
    assert reporter.finish() == 1


def test_pass_check_details_default_to_empty_string(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check()
    assert reporter.finish() == 0


def test_multiple_checks_all_passing_returns_zero(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check("clean")
    reporter.start_check("Scanning pages")
    reporter.pass_check("clean")
    assert reporter.finish() == 0


def test_one_failure_among_many_passes_returns_one(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check("clean")
    reporter.start_check("Scanning pages")
    reporter.fail_check("Twin component found")
    assert reporter.finish() == 1


def test_finish_with_no_checks_at_all_returns_zero(tmp_path: Path):
    reporter = _reporter(tmp_path)
    assert reporter.finish() == 0


def test_finish_is_idempotent(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check("clean")
    assert reporter.finish() == 0
    assert reporter.finish() == 0


def test_records_elapsed_time_in_milliseconds(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check("clean")
    reporter.finish()
    assert reporter.elapsed_ms >= 0
    assert isinstance(reporter.elapsed_ms, float)


def test_start_check_records_description(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check("clean")
    assert reporter.checks[-1].description == "Scanning components"


def test_pass_check_records_status_and_details(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check("Found 0 duplicates")
    check = reporter.checks[-1]
    assert check.status == "PASS"
    assert check.details == "Found 0 duplicates"


def test_fail_check_records_message_file_line_and_hint(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.fail_check("Twin component found", file_path="Button.tsx", line=10, hint="Use bedrock-ui")
    check = reporter.checks[-1]
    assert check.status == "FAIL"
    assert check.message == "Twin component found"
    assert check.file_path == "Button.tsx"
    assert check.line == 10
    assert check.hint == "Use bedrock-ui"


def test_fail_check_accepts_path_object_for_file_path(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.fail_check("Twin component found", file_path=Path("Button.tsx"), line=10)
    check = reporter.checks[-1]
    assert check.file_path == Path("Button.tsx")


def test_render_produces_80_column_header_banner(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check("clean")
    reporter.finish()
    output = reporter.render()
    lines = output.splitlines()
    banner_lines = [line for line in lines if line.strip("=") == ""]
    assert any(len(line) == 80 for line in banner_lines)
    assert any("[AUDIT-S001]" in line and "No Duplicate UI Code" in line for line in lines)


def test_render_includes_pass_line_with_description_and_details(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check("Found 0 duplicates")
    reporter.finish()
    output = reporter.render()
    assert "[PASS]" in output
    assert "Scanning components" in output
    assert "Found 0 duplicates" in output


def test_render_includes_fail_line_with_message_file_line_and_hint(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.fail_check("Twin component found", file_path="Button.tsx", line=10, hint="Use bedrock-ui")
    reporter.finish()
    output = reporter.render()
    assert "[FAIL]" in output
    assert "Twin component found" in output
    assert "Button.tsx" in output
    assert "10" in output
    assert "Use bedrock-ui" in output

    # The failing line pointer (file:line) should appear as one coherent token.
    assert "Button.tsx:10" in output


def test_render_includes_summary_footer_with_counts_and_elapsed_time(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Scanning components")
    reporter.pass_check("clean")
    reporter.start_check("Scanning pages")
    reporter.fail_check("Twin component found")
    reporter.finish()
    output = reporter.render()
    assert "2" in output  # total checks
    assert "1" in output  # passed / failed counts appear somewhere
    assert "ms" in output


def test_render_includes_error_message(tmp_path: Path):
    reporter = _reporter(tmp_path)
    reporter.start_check("Loading configuration")
    reporter.error("bedrock.toml is missing a required [tool.bedrock] section")
    reporter.finish()
    output = reporter.render()
    assert "bedrock.toml is missing a required [tool.bedrock] section" in output


@pytest.mark.parametrize("bad_value", [None, ""])
def test_start_check_requires_a_description(tmp_path: Path, bad_value):
    reporter = _reporter(tmp_path)
    with pytest.raises(ValueError):
        reporter.start_check(bad_value)
