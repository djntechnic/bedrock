# packages/bedrock-api/tests/test_release_yml_schema.py
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[3]
RELEASE_YML = REPO_ROOT / ".github" / "release.yml"


def test_release_yml_exists():
    assert RELEASE_YML.exists(), f"expected {RELEASE_YML} to exist"


def test_release_yml_declares_three_categories_matching_s015():
    data = yaml.safe_load(RELEASE_YML.read_text(encoding="utf-8"))
    categories = data["changelog"]["categories"]
    titles = [c["title"] for c in categories]
    assert titles == ["### Fixed", "### Added / Changed", "### Platform Maintenance"]


def test_release_yml_fixed_category_labels():
    data = yaml.safe_load(RELEASE_YML.read_text(encoding="utf-8"))
    categories = {c["title"]: c["labels"] for c in data["changelog"]["categories"]}
    assert categories["### Fixed"] == ["type:defect", "bug"]
    assert categories["### Added / Changed"] == ["type:feature", "type:task", "enhancement"]
    assert categories["### Platform Maintenance"] == ["type:refactor", "chore", "documentation"]


def test_release_yml_excludes_noise_labels():
    data = yaml.safe_load(RELEASE_YML.read_text(encoding="utf-8"))
    assert data["changelog"]["exclude"]["labels"] == ["duplicate", "invalid", "wontfix"]
