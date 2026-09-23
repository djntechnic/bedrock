from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
CASCADE_YML = REPO_ROOT / ".github" / "workflows" / "cascade.yml"


def _load():
    # PyYAML chokes on GitHub Actions' `on:` key colliding with the YAML 1.1
    # boolean `on` token in some loaders; safe_load handles it fine here
    # since actions YAML quotes nothing unusual in this file.
    return yaml.safe_load(CASCADE_YML.read_text(encoding="utf-8"))


def test_close_upstream_issues_job_exists():
    data = _load()
    assert "close-upstream-issues" in data["jobs"]


def test_close_upstream_issues_uses_default_github_token_not_cascade_token():
    text = CASCADE_YML.read_text(encoding="utf-8")
    job_start = text.index("close-upstream-issues:")
    next_job = text.find("\n  file-adoption-issues:", 0)
    # job ordering may place close-upstream-issues before or after
    # file-adoption-issues; slice to end of file if it comes last.
    job_end = len(text) if next_job == -1 or next_job < job_start else next_job
    job_text = text[job_start:job_end]
    assert "secrets.CASCADE_TOKEN" not in job_text
    assert "secrets.GITHUB_TOKEN" in job_text


def test_close_upstream_issues_triggers_on_release_published():
    data = _load()
    assert "release" in data[True]  # YAML parses bare `on:` key as boolean True
    assert "published" in data[True]["release"]["types"]


def test_close_upstream_issues_job_has_no_matrix_consumer():
    data = _load()
    job = data["jobs"]["close-upstream-issues"]
    assert "strategy" not in job or "matrix" not in job.get("strategy", {})
