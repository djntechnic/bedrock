# packages/bedrock-api/tests/test_standard_s015_doc.py
import re
import sys
from pathlib import Path

if sys.version_info >= (3, 11):
    import tomllib
else:  # pragma: no cover
    import tomli as tomllib

REPO_ROOT = Path(__file__).resolve().parents[3]
STANDARD_DOC = REPO_ROOT / "docs" / "standards" / "s015-release-automation-and-changelog-contract.md"
README = REPO_ROOT / "docs" / "standards" / "README.md"
BEDROCK_TOML = REPO_ROOT / "bedrock.toml"
PR_TEMPLATE = REPO_ROOT / ".github" / "PULL_REQUEST_TEMPLATE.md"
CASCADE_YML = REPO_ROOT / ".github" / "workflows" / "cascade.yml"


def test_standard_doc_exists_with_frontmatter():
    text = STANDARD_DOC.read_text(encoding="utf-8")
    assert text.startswith("---\n")
    frontmatter = text.split("---", 2)[1]
    assert 'id: S015' in frontmatter
    assert 'status: active' in frontmatter
    assert 'tier: platform' in frontmatter
    assert 'enforced_by: bedrock.tools.s015_audit_release_notes' in frontmatter
    assert 'cli_command: "python scripts/audit/s015_audit_release_notes.py --root ."' in frontmatter


def test_standard_doc_has_five_mandatory_sections():
    text = STANDARD_DOC.read_text(encoding="utf-8")
    for heading in (
        "## Purpose & Objective",
        "## Non-Negotiable Invariants",
        "## Architecture & Code Contracts",
        "## Exceptions & Audit Exemptions",
        "## Verification & Enforcement Gate",
    ):
        assert heading in text, f"missing section: {heading}"


def test_readme_index_has_s015_row():
    text = README.read_text(encoding="utf-8")
    assert "S015" in text
    assert "bedrock.tools.s015_audit_release_notes" in text


def test_bedrock_toml_declares_s015_and_ecosystem_sections():
    data = tomllib.loads(BEDROCK_TOML.read_text(encoding="utf-8"))
    s015 = data["tool"]["bedrock"]["audit"]["s015"]
    assert s015["changelog_path"] == "CHANGELOG.md"
    assert s015["exemptions"] == []

    ecosystem = data["tool"]["bedrock"]["ecosystem"]
    assert ecosystem["consumers"] == ["CollectIt", "MLBTracker"]


def test_ecosystem_consumers_match_cascade_matrix():
    data = tomllib.loads(BEDROCK_TOML.read_text(encoding="utf-8"))
    consumers = set(data["tool"]["bedrock"]["ecosystem"]["consumers"])
    cascade_text = CASCADE_YML.read_text(encoding="utf-8")
    matrix_match = re.search(r"consumer:\s*\[([^\]]+)\]", cascade_text)
    assert matrix_match is not None
    matrix_repos = {r.strip().split("/")[-1] for r in matrix_match.group(1).split(",")}
    assert consumers == matrix_repos


def test_pr_template_has_changelog_entry_block():
    text = PR_TEMPLATE.read_text(encoding="utf-8")
    assert "### Changelog Entry" in text
    assert "Root Cause & Escape" in text
    assert "Prevention" in text
