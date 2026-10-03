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
    import re
    text = CASCADE_YML.read_text(encoding="utf-8")
    job_start = text.index("close-upstream-issues:")
    after_header = job_start + len("close-upstream-issues:")
    m = re.search(r"\n  [a-z0-9_-]+:", text[after_header:])
    job_end = (after_header + m.start()) if m else len(text)
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


def test_sync_standards_to_ai_kit_job_exists():
    data = _load()
    assert "sync-standards-to-ai-kit" in data["jobs"]


def test_sync_standards_to_ai_kit_uses_cascade_token():
    import re
    text = CASCADE_YML.read_text(encoding="utf-8")
    job_start = text.index("sync-standards-to-ai-kit:")
    after_header = job_start + len("sync-standards-to-ai-kit:")
    m = re.search(r"\n  [a-z0-9_-]+:", text[after_header:])
    job_end = (after_header + m.start()) if m else len(text)
    job_text = text[job_start:job_end]
    assert "secrets.CASCADE_TOKEN" in job_text
