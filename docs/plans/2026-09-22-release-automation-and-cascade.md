# Release Automation & Downstream Cascade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the release-automation pipeline the design spec describes: a
new `§S015` changelog contract with an enforcing audit, a GitHub Release
categorization manifest, a `Cut-BedrockRelease.ps1` local orchestrator that
assembles the changelog entry and cuts an immutable-SHA release, a
server-side upstream-issue-closure job layered onto `cascade.yml`, and the
`bedrock-ai-kit` `/cut-release` skill realigned to delegate to the new
script.

**Architecture:** Six tasks build bottom-up: the label-mapping manifest and
the standard/audit-module scaffolding land first (Tasks 1-3) because the
orchestrator (Task 4) depends on `s015_audit_release_notes` existing as a
pre-tag gate, and the server-side closure job (Task 5) depends on the release
body's `Resolves Upstream Issues` key that Task 4 produces. Task 6 (skill
realignment) depends on Task 4's script existing and being invocable.

**Tech Stack:** Python 3.11+ (bedrock-api tooling, pytest), PowerShell 7
(`pwsh`), GitHub Actions YAML, `gh` CLI (GraphQL via `gh api graphql`),
TOML (`bedrock.toml`).

**Spec:** `docs/specs/2026-09-22-release-automation-and-cascade-design.md`

## Global Constraints

- §S006 / §S006 SDLC — every fix ships with a reproduction test; a branch
  addresses exactly one concern; CI must be green before merge; never
  `--no-verify`, never force-push without explicit authorization every time.
- §S012 Dual-Pin Platform Governance — this plan never edits a consumer's
  `requirements.txt`/`package.json` pins; `bedrock.toml`'s own
  self-repo-mode version pair (`packages/bedrock-api/pyproject.toml`
  `version` and root `package.json` `version`) is untouched by this plan
  since no release is cut by it (§S012 unaffected).
- §S014 Issue Logging & Ecosystem Governance — the new §S015 standard does
  not fold into §S014; it is registered as its own number per the spec's
  §2 rationale.
- §S015 (new, authored by Task 2) — every `CHANGELOG.md` version entry
  follows the mandatory section order `### Breaking Changes` → `### Fixed`
  → `### Added / Changed` → `### Platform Maintenance` → `### For
  consumers`; the audit validates the **committed** `###`-level entry, never
  the heading-promoted release body.
- **Canonical CHANGELOG section order used throughout this plan:**
  `### Breaking Changes`, `### Fixed`, `### Added / Changed`,
  `### Platform Maintenance`, `### For consumers`, exactly as spec §2.1's
  prose states (`### Breaking Changes` immediately precedes
  `### For consumers`) — real repository precedent (`CHANGELOG.md`'s
  v0.10.3 entry: `### Fixed`, `### Added`, `### Breaking changes`,
  `### For consumers`) confirms this adjacency rule; the plan does not
  reproduce spec §2.1's illustrative code block's section ordering, which
  places `### Breaking Changes` first and disagrees with the spec's own
  prose and the cited precedent. Every task below uses the prose-consistent
  order.
- The `### Fixed` top-level bullet regex accepts optional markdown bold
  around the issue reference, `^-\s+(?:\*\*)?\[#(\d+)\]`, to match both
  spec §2.2's literal stated regex (`^-\s+\[#\d+\]`) and its own worked
  example (`- **[#101] ...**`), which the literal regex alone would not
  match.
- No placeholder code, "TBD", or deferred logic anywhere in this plan's
  steps — every code block is complete and runnable as written.
- `AuditReporter` exit-code contract (0 clean / 1 violation / 2 config
  error) is followed exactly by the new `s015_audit_release_notes` module,
  matching every existing `s0##_audit_*` module.
- Dual-location convention: core audit logic lives in
  `packages/bedrock-api/bedrock/tools/s015_audit_release_notes.py`; the CLI
  shim lives in `scripts/audit/s015_audit_release_notes.py` and only
  delegates.

## Review Focus

- A merged PR labeled `type:defect` with no `### Changelog Entry` block in
  its body — the spec (§2.2) says this must halt the release script for
  interactive confirmation, not silently emit a `### Fixed` entry missing
  `Origin / Root Cause` / `Prevention / Test`. Covered by Task 4's
  `Build-ChangelogEntry` test for a PR body with no `### Changelog Entry`
  heading.
- An explicit `-TargetVersion` that under-bumps relative to what merged-PR
  labels imply (e.g. a `breaking`-labeled PR in the delta but `-TargetVersion`
  requests only a patch bump) — spec §4.3 requires the script halt for
  confirmation unless `-Force` is passed, not silently accept the
  under-bump. Covered by Task 4's `Resolve-TargetVersion` tests.
- A `### Fixed` entry whose top-level bullet uses the bolded example form
  (`- **[#101] ...**`) rather than the spec's literal unbolded regex
  (`- [#101] ...`) — both must pass the audit, since the spec's own worked
  example uses the bolded form. Covered by Task 3's regex test matching
  both forms.
- A `CHANGELOG.md` with `### For consumers` present but `Expected Pin
  Migration` naming a *different* tag than the version block under audit
  (e.g. a copy-pasted entry) — the audit must reject this as a mismatch,
  not just check the key exists. Covered by Task 3's mismatched-tag
  fixture.
- Re-running `Cut-BedrockRelease.ps1 -Resume` against a release that is
  fully tagged, published, and already cascaded — the script must take no
  further local action and report success rather than erroring or
  attempting to re-tag. Covered by Task 4's three-fact resume-state test
  for the "both tag and release exist" branch.

---

### Task 1: GitHub Release categorization configuration

**Files:**
- Create: `.github/release.yml`
- Test: `packages/bedrock-api/tests/test_release_yml_schema.py`

**Interfaces:**
- Produces: `.github/release.yml` — a static YAML manifest, read by GitHub's
  native release-notes generator and referenced by Task 4's
  `Build-ChangelogEntry` (as documentation of the three category titles it
  must reproduce) and Task 2's §S015 standard doc (as the single source for
  the `### Fixed` / `### Added / Changed` / `### Platform Maintenance`
  category titles). No other task imports this file programmatically; it is
  read by GitHub's platform, not by bedrock's own Python.

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/bedrock-api && python -m pytest tests/test_release_yml_schema.py -v`
Expected: FAIL — `.github/release.yml` does not exist (first test fails with
`AssertionError`, remaining tests fail with `FileNotFoundError` inside
`yaml.safe_load`).

- [ ] **Step 3: Write `.github/release.yml`**

```yaml
changelog:
  categories:
    - title: "### Fixed"
      labels: ["type:defect", "bug"]
    - title: "### Added / Changed"
      labels: ["type:feature", "type:task", "enhancement"]
    - title: "### Platform Maintenance"
      labels: ["type:refactor", "chore", "documentation"]
  exclude:
    labels: ["duplicate", "invalid", "wontfix"]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/bedrock-api && python -m pytest tests/test_release_yml_schema.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add .github/release.yml packages/bedrock-api/tests/test_release_yml_schema.py
git commit -m "$(cat <<'EOF'
feat(release): add GitHub Release categorization manifest

Declares the three changelog categories (### Fixed, ### Added / Changed,
### Platform Maintenance) that back both GitHub's native release-notes
generator and the CHANGELOG.md entry §S015 will mandate, so the two never
diverge in shape.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: §S015 standard documentation, catalog registration, and PR template

**Files:**
- Create: `docs/standards/s015-release-automation-and-changelog-contract.md`
- Modify: `docs/standards/README.md:29-45` (index table), `:65-71` ("Adding a
  New Platform Standard" step list is unchanged, but the index row is added)
- Modify: `bedrock.toml` (append `[tool.bedrock.audit.s015]` and
  `[tool.bedrock.ecosystem]` sections at end of file)
- Modify: `.github/PULL_REQUEST_TEMPLATE.md:33` (add the `### Changelog
  Entry` block requirement)
- Test: `packages/bedrock-api/tests/test_standard_s015_doc.py`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `bedrock.toml`'s `[tool.bedrock.audit.s015]` section (keys:
  `changelog_path: str`, `exemptions: list[str]`) — read by Task 3's
  `AuditS015Config` dataclass in `_config.py`. `[tool.bedrock.ecosystem]`
  section (`consumers: list[str]`) — read by Task 4's
  `Build-ChangelogEntry` (via a small Python/TOML read step or hardcoded
  mirror, see Task 4) and by a parity test asserting it matches
  `cascade.yml`'s `matrix.consumer` list.

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/bedrock-api && python -m pytest tests/test_standard_s015_doc.py -v`
Expected: FAIL — `s015-release-automation-and-changelog-contract.md` does
not exist; `bedrock.toml` has no `[tool.bedrock.audit.s015]` or
`[tool.bedrock.ecosystem]` section; PR template has no `### Changelog
Entry` block.

- [ ] **Step 3: Author the standard document**

```markdown
---
id: S015
title: "Release Automation & Changelog Contract"
status: active
tier: platform
enforced_by: bedrock.tools.s015_audit_release_notes
cli_command: "python scripts/audit/s015_audit_release_notes.py --root ."
---

# Standard S015: Release Automation & Changelog Contract

## Purpose & Objective

A release whose notes are reconstructed by hand from a diff loses the one
piece of information a diff cannot recover: *why the existing test suite
didn't already catch this*. Bedrock's release pipeline (`Cut-BedrockRelease
.ps1`, `.github/workflows/cascade.yml`) compiles `CHANGELOG.md` entries and
downstream adoption issues automatically from merged-PR metadata — but
automation only works if every PR that needs a changelog entry supplies one
in a fixed, machine-parseable shape at merge time. This standard is that
shape: the section structure every `CHANGELOG.md` version block follows,
the `Origin / Root Cause` / `Prevention / Test` metadata every defect entry
carries, and the `### For consumers` schema that drives downstream cascade.

## Non-Negotiable Invariants

- Every `CHANGELOG.md` version entry contains, in this order:
  `### Breaking Changes`, `### Fixed`, `### Added / Changed`,
  `### Platform Maintenance`, `### For consumers`. `### Breaking Changes`
  is never omitted — a release with no breaking change still emits the
  header with the literal body `None` — and it immediately precedes
  `### For consumers` in document order.
- `### Added / Changed` and `### Platform Maintenance` map directly to
  `.github/release.yml`'s label categories and are never dropped from the
  template, even when empty (header present, body `None`).
- Every `### Fixed` top-level bullet matches `^-\s+(?:\*\*)?\[#\d+\]`
  (optional markdown bold around the issue reference) and has two indented
  child bullets: `Origin / Root Cause` and `Prevention / Test`.
- The `Origin / Root Cause` / `Prevention / Test` narrative is authored
  once, at merge time, by the PR's own author, via a required `###
  Changelog Entry` block in the PR template — never reconstructed by
  release tooling after the fact from a diff.
- `### For consumers` is a fixed three-key schema: `Resolves Upstream
  Issues`, `Target Downstream Repositories`, `Expected Pin Migration`.
  `Expected Pin Migration` contains a `/bump-bedrock-pin vX.Y.Z` string
  whose tag matches the version entry it lives in.
- `Target Downstream Repositories` is never a second hardcoded literal —
  its single source of truth is `bedrock.toml`'s `[tool.bedrock.ecosystem]`
  `consumers` list.
- The audit (`s015_audit_release_notes`) validates the committed
  `CHANGELOG.md` entry at the `###` heading level, during pre-tag quality
  gates — never the composed, heading-promoted release body. The
  `### For consumers` → `## For consumers` promotion is a release-time
  string transform downstream of the audit, not a second schema.

## Architecture & Code Contracts

**Markdown — correct `CHANGELOG.md` version entry:**

```markdown
## v0.11.0 - 2026-09-22

### Breaking Changes
None

### Fixed
- **[#101] Fix route collision on wildcard admin paths**
  - **Origin / Root Cause:** the wildcard route was registered before the
    literal `/admin/users` route, so FastAPI's first-match resolution order
    shadowed it.
  - **Prevention / Test:** `test_admin_routes.py::test_literal_route_wins_over_wildcard`

### Added / Changed
- **[#104] Add bulk CSV export to the Grid Editor**

### Platform Maintenance
None

### For consumers
- **Resolves Upstream Issues:** #101, #104
- **Target Downstream Repositories:** `djntechnic/CollectIt`, `djntechnic/MLBTracker`
- **Expected Pin Migration:** `/bump-bedrock-pin v0.11.0`
```

**Violation — missing `Origin / Root Cause` child, wrong section order:**

```markdown
## v0.11.0 - 2026-09-22

### Fixed
- [#101] Fix route collision on wildcard admin paths

### Breaking Changes
None
```

Both the missing metadata children and `### Breaking Changes` appearing
after `### Fixed` instead of immediately before `### For consumers` are
audit failures.

**Python — audit check shape:**

```python
def audit_fixed_entry_metadata(entry_text: str) -> list[str]:
    violations = []
    for bullet, children in parse_fixed_bullets(entry_text):
        if "Origin / Root Cause" not in children:
            violations.append(f"{bullet}: missing Origin / Root Cause")
        if "Prevention / Test" not in children:
            violations.append(f"{bullet}: missing Prevention / Test")
    return violations
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s015]
changelog_path = "CHANGELOG.md"
exemptions = []
```

Historical `CHANGELOG.md` entries predating this standard are never
retroactively audited — the audit only validates the *target* version
under release, resolved by tag argument, not the whole file.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.s015_audit_release_notes vX.Y.Z --root .
```

- **Exit 0** — the target version's `##` block exists with all five
  mandatory sections in order, every `### Fixed` bullet has both metadata
  children, and `### For consumers` has all three keys with a matching
  `/bump-bedrock-pin` tag.
- **Exit 1** — a structural or missing-contract violation was found; the
  audit reports the file and section.
- **Exit 2** — configuration error (missing `CHANGELOG.md`, malformed
  `bedrock.toml`).
```

- [ ] **Step 4: Add the index row to `docs/standards/README.md`**

Insert a new row immediately after the `S014` row (line 44) and before the
`S100` row:

```markdown
| [S015](s015-release-automation-and-changelog-contract.md) | Release Automation & Changelog Contract | active | `bedrock.tools.s015_audit_release_notes` | platform |
```

- [ ] **Step 5: Append the `bedrock.toml` sections**

Append after the existing `[tool.bedrock.audit.s100]` block (end of file):

```toml
[tool.bedrock.audit.s015]
changelog_path = "CHANGELOG.md"
exemptions = []

[tool.bedrock.ecosystem]
consumers = ["CollectIt", "MLBTracker"]
```

- [ ] **Step 6: Add the `### Changelog Entry` block to the PR template**

Insert into `.github/PULL_REQUEST_TEMPLATE.md` after the `## Test Plan`
section (after line 24, before `## Platform Standards Checklist`):

```markdown
## Changelog Entry

<!-- Required for any PR labeled type:defect. The release generator
     extracts this verbatim and maps it onto CHANGELOG.md's Origin / Root
     Cause and Prevention / Test keys — write the narrative once, here. -->

- **Root Cause & Escape:** <!-- Why existing tests missed it. -->
- **Prevention:** <!-- Specific regression tests added. -->
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd packages/bedrock-api && python -m pytest tests/test_standard_s015_doc.py -v`
Expected: PASS (6 passed)

- [ ] **Step 8: Commit**

```bash
git add docs/standards/s015-release-automation-and-changelog-contract.md \
        docs/standards/README.md bedrock.toml \
        .github/PULL_REQUEST_TEMPLATE.md \
        packages/bedrock-api/tests/test_standard_s015_doc.py
git commit -m "$(cat <<'EOF'
docs(standards): author §S015 release automation and changelog contract

Registers the new platform standard in docs/standards/README.md and
bedrock.toml, declares the [tool.bedrock.ecosystem] consumer list as the
single source of truth for downstream repos, and adds the required
### Changelog Entry block to the PR template so root-cause narrative is
authored once, at merge time, by the PR's own author.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `s015_audit_release_notes` dual-location audit module

**Files:**
- Create: `packages/bedrock-api/bedrock/tools/s015_audit_release_notes.py`
- Create: `scripts/audit/s015_audit_release_notes.py`
- Modify: `packages/bedrock-api/bedrock/tools/_config.py` (add
  `AuditS015Config`, register in `_AUDIT_SECTIONS`, `_SECTION_CLASSES`,
  `BedrockConfig`)
- Modify: `packages/bedrock-api/bedrock/tools/run_all.py` (import + append
  to `AUDIT_MODULES`)
- Modify: `packages/bedrock-api/bedrock/tools/sync_standards.py:43` (widen
  `_is_canonical` range to include 15)
- Test: `packages/bedrock-api/tests/test_audit_s015_release_notes.py`

**Interfaces:**
- Consumes: `AuditReporter` (`bedrock.tools._reporter`, constructor
  `AuditReporter(audit_code: str, audit_name: str, repo_root: Path,
  config_file: Path)`, methods `start_check(str)`, `pass_check(str = "")`,
  `fail_check(str, file_path=None, line=None, hint=None)`, `error(str)`,
  `finish() -> int`, `render() -> str`). `load_bedrock_config(root: Path) ->
  BedrockConfig` and the new `config.audit_s015.changelog_path: str`,
  `config.audit_s015.exemptions: list[str]` (`bedrock.tools._config`).
- Produces: `audit(root: Path, target_version: str, changelog_rel: str,
  exemptions: list[str]) -> list[ReleaseNoteViolation]` and `main(argv:
  list[str] | None = None) -> int`, matching the `_AuditModule` protocol
  `run_all.py` requires (`def main(self, argv: list[str] | None = None) ->
  int`). `ReleaseNoteViolation` is a `@dataclass` with a single `message:
  str` field, matching `PinViolation`'s shape in `s012_audit_pins.py`. The
  module's CLI takes a positional `version` argument (`vX.Y.Z`) in addition
  to `--root`, since the audit is version-scoped (spec §2.4) — consumed
  directly by Task 4's `Invoke-PreTagGates` as
  `s015_audit_release_notes.py <TargetVersion> --root .`.

- [ ] **Step 1: Write the failing test**

```python
# packages/bedrock-api/tests/test_audit_s015_release_notes.py
from pathlib import Path

from bedrock.tools import s015_audit_release_notes


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def _write_toml(root: Path, extra: str = "") -> None:
    _write(
        root / "bedrock.toml",
        f"""
[tool.bedrock]
[tool.bedrock.audit.s015]
changelog_path = "CHANGELOG.md"
exemptions = []
{extra}
""",
    )


_COMPLIANT_ENTRY = """## v0.11.0 - 2026-09-22

### Breaking Changes
None

### Fixed
- **[#101] Fix route collision on wildcard admin paths**
  - **Origin / Root Cause:** the wildcard route registered before the
    literal route, shadowing it.
  - **Prevention / Test:** test_admin_routes.py::test_literal_route_wins

### Added / Changed
- **[#104] Add bulk CSV export to the Grid Editor**

### Platform Maintenance
None

### For consumers
- **Resolves Upstream Issues:** #101, #104
- **Target Downstream Repositories:** `djntechnic/CollectIt`, `djntechnic/MLBTracker`
- **Expected Pin Migration:** `/bump-bedrock-pin v0.11.0`
"""


def test_compliant_entry_passes(tmp_path):
    _write_toml(tmp_path)
    _write(tmp_path / "CHANGELOG.md", _COMPLIANT_ENTRY)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 0


def test_missing_target_version_fails(tmp_path):
    _write_toml(tmp_path)
    _write(tmp_path / "CHANGELOG.md", _COMPLIANT_ENTRY)
    assert s015_audit_release_notes.main(["v9.9.9", "--root", str(tmp_path)]) == 1


def test_missing_for_consumers_section_fails(tmp_path):
    _write_toml(tmp_path)
    broken = _COMPLIANT_ENTRY.split("### For consumers")[0]
    _write(tmp_path / "CHANGELOG.md", broken)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 1


def test_missing_breaking_changes_header_fails(tmp_path):
    _write_toml(tmp_path)
    broken = _COMPLIANT_ENTRY.replace("### Breaking Changes\nNone\n\n", "")
    _write(tmp_path / "CHANGELOG.md", broken)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 1


def test_fixed_bullet_missing_origin_root_cause_fails(tmp_path):
    _write_toml(tmp_path)
    broken = _COMPLIANT_ENTRY.replace(
        "  - **Origin / Root Cause:** the wildcard route registered before the\n"
        "    literal route, shadowing it.\n",
        "",
    )
    _write(tmp_path / "CHANGELOG.md", broken)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 1


def test_fixed_bullet_missing_prevention_test_fails(tmp_path):
    _write_toml(tmp_path)
    broken = _COMPLIANT_ENTRY.replace(
        "  - **Prevention / Test:** test_admin_routes.py::test_literal_route_wins\n",
        "",
    )
    _write(tmp_path / "CHANGELOG.md", broken)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 1


def test_mismatched_pin_migration_tag_fails(tmp_path):
    _write_toml(tmp_path)
    broken = _COMPLIANT_ENTRY.replace(
        "**Expected Pin Migration:** `/bump-bedrock-pin v0.11.0`",
        "**Expected Pin Migration:** `/bump-bedrock-pin v0.9.0`",
    )
    _write(tmp_path / "CHANGELOG.md", broken)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 1


def test_unbolded_fixed_bullet_form_also_passes(tmp_path):
    _write_toml(tmp_path)
    unbolded = _COMPLIANT_ENTRY.replace(
        "- **[#101] Fix route collision on wildcard admin paths**",
        "- [#101] Fix route collision on wildcard admin paths",
    )
    _write(tmp_path / "CHANGELOG.md", unbolded)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 0


def test_missing_changelog_file_errors(tmp_path):
    _write_toml(tmp_path)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 2


def test_malformed_bedrock_toml_errors(tmp_path):
    _write(tmp_path / "bedrock.toml", "not [ valid toml")
    _write(tmp_path / "CHANGELOG.md", _COMPLIANT_ENTRY)
    assert s015_audit_release_notes.main(["v0.11.0", "--root", str(tmp_path)]) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/bedrock-api && python -m pytest tests/test_audit_s015_release_notes.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named
'bedrock.tools.s015_audit_release_notes'`.

- [ ] **Step 3: Register `AuditS015Config` in `_config.py`**

In `packages/bedrock-api/bedrock/tools/_config.py`, add after
`AuditS014Config` (currently ending at line 179):

```python
@dataclass
class AuditS015Config:
    changelog_path: str = "CHANGELOG.md"
    exemptions: list[str] = field(default_factory=list)
```

Change line 53-54:

```python
_AUDIT_SECTIONS: tuple[str, ...] = tuple(f"s{i:03d}" for i in range(1, 16)) + ("s100",)
```

(delete the now-redundant first `_AUDIT_SECTIONS` assignment on the
original line 53 — the file currently has two consecutive assignments to
the same name; collapse to one line ending at `range(1, 16)` to include
`s015`.)

In `_SECTION_CLASSES` (after the `"s014"` entry):

```python
    "s015": AuditS015Config,
```

In `BedrockConfig` (after `audit_s014: AuditS014Config`):

```python
    audit_s015: AuditS015Config
```

- [ ] **Step 4: Write the core audit module**

```python
# packages/bedrock-api/bedrock/tools/s015_audit_release_notes.py
"""
Module:  s015_audit_release_notes.py
Layer:   bedrock/tools
Desc:    Enforcement for [S015-release-automation-and-changelog-contract]
         (../../../../docs/standards/s015-release-automation-and-changelog-contract.md).

         Validates one target version's CHANGELOG.md entry, at the
         committed `###` heading level (never the heading-promoted release
         body), against the mandatory section structure, ### Fixed
         metadata contract, and ### For consumers schema.

         Exit 0 clean, 1 on a structural violation, 2 on a configuration
         error (missing CHANGELOG.md, malformed bedrock.toml).

Usage:   python -m bedrock.tools.s015_audit_release_notes vX.Y.Z --root .
"""
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import load_bedrock_config
from bedrock.tools._reporter import AuditReporter

_VERSION_BLOCK = re.compile(
    r"^## (?P<version>v\d+\.\d+\.\d+) - \d{4}-\d{2}-\d{2}\n(?P<body>.*?)(?=\n## v\d+\.\d+\.\d+ - |\Z)",
    re.DOTALL | re.MULTILINE,
)
_SUBSECTION = re.compile(r"^### (?P<title>[^\n]+)\n(?P<body>.*?)(?=\n### |\Z)", re.DOTALL | re.MULTILINE)
_FIXED_BULLET = re.compile(
    r"^-\s+(?:\*\*)?\[#(?P<issue>\d+)\][^\n]*\n(?P<children>(?:  .*\n?)*)",
    re.MULTILINE,
)
_PIN_MIGRATION = re.compile(r"/bump-bedrock-pin\s+(v\d+\.\d+\.\d+)")

_REQUIRED_SECTION_ORDER = (
    "Breaking Changes",
    "Fixed",
    "Added / Changed",
    "Platform Maintenance",
    "For consumers",
)


@dataclass
class ReleaseNoteViolation:
    message: str


def _extract_version_block(changelog_text: str, target_version: str) -> str | None:
    for match in _VERSION_BLOCK.finditer(changelog_text):
        if match.group("version") == target_version:
            return match.group("body")
    return None


def _parse_subsections(block_text: str) -> dict[str, str]:
    return {m.group("title").strip(): m.group("body") for m in _SUBSECTION.finditer(block_text)}


def _section_order_violations(block_text: str) -> list[ReleaseNoteViolation]:
    found_order = [m.group("title").strip() for m in _SUBSECTION.finditer(block_text)]
    violations: list[ReleaseNoteViolation] = []
    for required in _REQUIRED_SECTION_ORDER:
        if required not in found_order:
            violations.append(ReleaseNoteViolation(f"missing required section: ### {required}"))
    if "Breaking Changes" in found_order and "For consumers" in found_order:
        bc_idx = found_order.index("Breaking Changes")
        fc_idx = found_order.index("For consumers")
        between = found_order[bc_idx + 1 : fc_idx]
        if between:
            violations.append(
                ReleaseNoteViolation(
                    "### Breaking Changes must immediately precede ### For consumers, "
                    f"found {between} in between"
                )
            )
    return violations


def _fixed_entry_violations(fixed_body: str) -> list[ReleaseNoteViolation]:
    violations: list[ReleaseNoteViolation] = []
    bullets = list(_FIXED_BULLET.finditer(fixed_body))
    if not bullets:
        return violations
    for bullet in bullets:
        children = bullet.group("children")
        issue = bullet.group("issue")
        if "Origin / Root Cause" not in children:
            violations.append(ReleaseNoteViolation(f"[#{issue}] missing Origin / Root Cause child bullet"))
        if "Prevention / Test" not in children:
            violations.append(ReleaseNoteViolation(f"[#{issue}] missing Prevention / Test child bullet"))
    return violations


def _for_consumers_violations(section_body: str, target_version: str) -> list[ReleaseNoteViolation]:
    violations: list[ReleaseNoteViolation] = []
    for key in ("Resolves Upstream Issues", "Target Downstream Repositories", "Expected Pin Migration"):
        if f"**{key}:**" not in section_body:
            violations.append(ReleaseNoteViolation(f"### For consumers missing required key: {key}"))

    pin_match = _PIN_MIGRATION.search(section_body)
    if pin_match is None:
        violations.append(ReleaseNoteViolation("### For consumers Expected Pin Migration has no /bump-bedrock-pin tag"))
    elif pin_match.group(1) != target_version:
        violations.append(
            ReleaseNoteViolation(
                f"### For consumers Expected Pin Migration tag {pin_match.group(1)} "
                f"does not match target version {target_version}"
            )
        )
    return violations


def audit(root: Path, target_version: str, changelog_rel: str) -> list[ReleaseNoteViolation]:
    changelog_path = root / changelog_rel
    if not changelog_path.exists():
        raise FileNotFoundError(f"CHANGELOG.md not found at {changelog_path}")

    changelog_text = changelog_path.read_text(encoding="utf-8")
    block = _extract_version_block(changelog_text, target_version)
    if block is None:
        return [ReleaseNoteViolation(f"no CHANGELOG.md entry found for {target_version}")]

    violations = _section_order_violations(block)
    subsections = _parse_subsections(block)

    if "Fixed" in subsections:
        violations.extend(_fixed_entry_violations(subsections["Fixed"]))
    if "For consumers" in subsections:
        violations.extend(_for_consumers_violations(subsections["For consumers"], target_version))

    return violations


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version", help="target release version, e.g. v0.11.0")
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("S015", "Release Automation & Changelog Contract", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    reporter.start_check(f"Validating CHANGELOG.md entry for {args.version}")
    try:
        violations = audit(root, args.version, config.audit_s015.changelog_path)
    except FileNotFoundError as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()

    if violations:
        for violation in violations:
            reporter.fail_check(violation.message)
    else:
        reporter.pass_check(f"{args.version} entry satisfies the §S015 contract")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
```

- [ ] **Step 5: Write the CLI shim**

```python
# scripts/audit/s015_audit_release_notes.py
"""Runner shim for Standard S015 audit."""
import sys

from bedrock.tools.s015_audit_release_notes import main

sys.exit(main())
```

- [ ] **Step 6: Register in `run_all.py`**

Add `s015_audit_release_notes` to the import block (after `s014_audit_ledger_freshness,`):

```python
    s014_audit_ledger_freshness,
    s015_audit_release_notes,
    s100_audit_domain_registry,
```

`s015_audit_release_notes.main` requires a positional `version` argument
that `run_all.py`'s generic `_run_one(code, module, root)` does not supply,
so `s015` is **not** added to `AUDIT_MODULES` (which calls every module
with only `["--root", str(root)]`) — it is a version-scoped audit invoked
directly by `Cut-BedrockRelease.ps1` (Task 4), the same way it would not
make sense to run it against no target version in a general sweep. Update
the module docstring's audit count reference (lines 5-10) to note this
carve-out:

```python
Desc:    Orchestrates the full platform audit suite - `s001` through
         `s014`, plus `s100` - as a single command, so CI (and a developer before
         opening a PR) gets one master summary instead of fifteen separate
         invocations to remember and interpret individually. `s015` is
         version-scoped (it validates one CHANGELOG.md entry, not the whole
         repo) and is invoked directly by the release orchestrator instead
         of through this sweep.
```

- [ ] **Step 7: Widen `_is_canonical` in `sync_standards.py`**

Change line 43:

```python
    return 1 <= number <= 15 or number == 100
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd packages/bedrock-api && python -m pytest tests/test_audit_s015_release_notes.py tests/test_standard_s015_doc.py -v`
Expected: PASS (all tests green)

- [ ] **Step 9: Run the full backend suite and typecheck**

Run: `cd packages/bedrock-api && python -m pytest`
Expected: all tests pass, zero failures.

- [ ] **Step 10: Commit**

```bash
git add packages/bedrock-api/bedrock/tools/s015_audit_release_notes.py \
        scripts/audit/s015_audit_release_notes.py \
        packages/bedrock-api/bedrock/tools/_config.py \
        packages/bedrock-api/bedrock/tools/run_all.py \
        packages/bedrock-api/bedrock/tools/sync_standards.py \
        packages/bedrock-api/tests/test_audit_s015_release_notes.py
git commit -m "$(cat <<'EOF'
feat(tools): add s015_audit_release_notes dual-location audit module

Validates a target version's committed CHANGELOG.md entry against the
§S015 section-order, ### Fixed metadata, and ### For consumers schema
contracts. Registered in _config.py, sync_standards.py's canonical range;
version-scoped, so invoked directly by the release orchestrator rather
than through run_all.py's whole-repo sweep.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `Cut-BedrockRelease.ps1` unified release orchestrator

**Files:**
- Create: `scripts/maintenance/Cut-BedrockRelease.ps1`
- Create: `scripts/maintenance/CutBedrockRelease.Helpers.psm1`
- Test: `scripts/maintenance/CutBedrockRelease.Helpers.Tests.ps1`

**Interfaces:**
- Consumes: `s015_audit_release_notes.py <TargetVersion> --root .` (Task 3,
  exit 0/1/2), `s012_audit_pins.py --root .` (existing, exit 0/1/2),
  `bedrock.toml`'s `[tool.bedrock.ecosystem]` `consumers` list (Task 2).
- Produces: nothing consumed by a later task's code — Task 6 references
  this script's path and parameter names
  (`scripts/maintenance/Cut-BedrockRelease.ps1`, switches `-Resume`,
  `-Force`, `-TargetVersion`) in its skill documentation.

The design spec's `Cut-BedrockRelease.ps1` mixes pure decision logic
(semver segment selection, heading promotion, changelog-entry assembly)
with network/filesystem mutation (git, `gh`). This repository has no prior
Pester/PowerShell test convention (confirmed: no `*.Tests.ps1` file exists
anywhere in the tree). Rather than leave the pure logic untested, it is
factored into a separate module,
`scripts/maintenance/CutBedrockRelease.Helpers.psm1`, of side-effect-free
functions that a Pester `Describe`/`It` suite exercises directly without
mocking `gh`/`git`. `Cut-BedrockRelease.ps1` itself imports that module and
wraps its pure functions with the network/git-mutating orchestration steps,
which are not unit-tested (per §4.2's ordering guarantee they are also
never reached until every pure decision has already been validated) but are
exercised by the `-WhatIf` dry-run path documented in the script's own
comment-based help.

- [ ] **Step 1: Write the failing Pester tests for the helper module**

```powershell
# scripts/maintenance/CutBedrockRelease.Helpers.Tests.ps1
Import-Module (Join-Path $PSScriptRoot "CutBedrockRelease.Helpers.psm1") -Force

Describe "Resolve-TargetVersion" {
    It "bumps patch when only defect/chore labels are in the delta" {
        $labels = @(@("type:defect"), @("chore"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels
        $result.Version | Should -Be "v0.10.4"
        $result.Segment | Should -Be "patch"
        $result.Halted | Should -Be $false
    }

    It "bumps minor when a type:feature label is present and no major label is" {
        $labels = @(@("type:defect"), @("type:feature"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels
        $result.Version | Should -Be "v0.11.0"
        $result.Segment | Should -Be "minor"
    }

    It "bumps major when a breaking label is present" {
        $labels = @(@("type:feature"), @("breaking"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels
        $result.Version | Should -Be "v1.0.0"
        $result.Segment | Should -Be "major"
    }

    It "accepts an explicit -TargetVersion that agrees with the computed segment" {
        $labels = @(@("type:defect"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels -ExplicitVersion "v0.10.4"
        $result.Version | Should -Be "v0.10.4"
        $result.Halted | Should -Be $false
    }

    It "halts when an explicit -TargetVersion under-bumps past a breaking label, without -Force" {
        $labels = @(@("breaking"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels -ExplicitVersion "v0.10.4"
        $result.Halted | Should -Be $true
        $result.HaltReason | Should -Match "breaking"
    }

    It "does not halt on an under-bump when -Force is passed" {
        $labels = @(@("breaking"))
        $result = Resolve-TargetVersion -BaselineTag "v0.10.3" -PrLabelSets $labels -ExplicitVersion "v0.10.4" -Force
        $result.Halted | Should -Be $false
        $result.Version | Should -Be "v0.10.4"
    }
}

Describe "ConvertTo-PromotedReleaseBody" {
    It "promotes a ### For consumers heading to ## For consumers, once" {
        $changelogEntry = "### Breaking Changes`nNone`n`n### For consumers`n- **Resolves Upstream Issues:** None`n"
        $result = ConvertTo-PromotedReleaseBody -ChangelogEntry $changelogEntry
        $result | Should -Match "(?m)^## For consumers$"
        $result | Should -Not -Match "(?m)^### For consumers$"
    }

    It "leaves every other ### heading at its original depth" {
        $changelogEntry = "### Fixed`n- entry`n`n### For consumers`n- key: value`n"
        $result = ConvertTo-PromotedReleaseBody -ChangelogEntry $changelogEntry
        $result | Should -Match "(?m)^### Fixed$"
    }
}

Describe "Build-ChangelogEntry" {
    It "assembles a fixed entry's metadata from a PR body's ### Changelog Entry block" {
        $pr = @{
            Number = 101
            Title  = "Fix route collision on wildcard admin paths"
            Labels = @("type:defect")
            Body   = "### Changelog Entry`n- **Root Cause & Escape:** wildcard route registered first.`n- **Prevention:** test_admin_routes.py::test_literal_route_wins`n"
        }
        $entry = Build-ChangelogEntry -MergedPrs @($pr) -TargetVersion "v0.11.0" -Consumers @("CollectIt", "MLBTracker") -ResolvedIssueNumbers @(101)
        $entry | Should -Match "\[#101\] Fix route collision on wildcard admin paths"
        $entry | Should -Match "Origin / Root Cause:\*\* wildcard route registered first\."
        $entry | Should -Match "Prevention / Test:\*\* test_admin_routes\.py::test_literal_route_wins"
        $entry | Should -Match "/bump-bedrock-pin v0\.11\.0"
        $entry | Should -Match "djntechnic/CollectIt.*djntechnic/MLBTracker"
    }

    It "halts (returns Halted = true) for a type:defect PR with no ### Changelog Entry block" {
        $pr = @{ Number = 102; Title = "Fix thing"; Labels = @("type:defect"); Body = "no block here" }
        $entry = Build-ChangelogEntry -MergedPrs @($pr) -TargetVersion "v0.11.0" -Consumers @("CollectIt") -ResolvedIssueNumbers @(102)
        $entry.Halted | Should -Be $true
        $entry.HaltReason | Should -Match "102"
    }

    It "emits 'None' body for Breaking Changes when no PR carries a breaking label" {
        $pr = @{ Number = 103; Title = "Add export"; Labels = @("type:feature"); Body = "" }
        $entry = Build-ChangelogEntry -MergedPrs @($pr) -TargetVersion "v0.11.0" -Consumers @("CollectIt") -ResolvedIssueNumbers @()
        $entry | Should -Match "(?s)### Breaking Changes\r?\nNone"
    }
}

Describe "Test-RemoteReleaseState (three-fact resume check)" {
    It "reports NotStarted when the tag does not exist remotely" {
        $state = Test-RemoteReleaseState -TagExists $false -ReleaseExists $false
        $state.Phase | Should -Be "NotStarted"
    }

    It "reports TagOnly when the tag exists but no release does" {
        $state = Test-RemoteReleaseState -TagExists $true -ReleaseExists $false
        $state.Phase | Should -Be "TagOnly"
    }

    It "reports Published when both the tag and the release exist" {
        $state = Test-RemoteReleaseState -TagExists $true -ReleaseExists $true
        $state.Phase | Should -Be "Published"
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pwsh -Command "Invoke-Pester -Path scripts/maintenance/CutBedrockRelease.Helpers.Tests.ps1 -Output Detailed"`
Expected: FAIL — `CutBedrockRelease.Helpers.psm1` does not exist, module
import fails.

- [ ] **Step 3: Write the pure-logic helper module**

```powershell
# scripts/maintenance/CutBedrockRelease.Helpers.psm1
<#
.SYNOPSIS
    Side-effect-free decision logic for Cut-BedrockRelease.ps1, split out so
    it is directly Pester-testable without mocking git/gh.
#>

function Resolve-TargetVersion {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [string]$BaselineTag,
        [Parameter(Mandatory)] [array]$PrLabelSets,
        [string]$ExplicitVersion,
        [switch]$Force
    )

    if ($BaselineTag -notmatch '^v(\d+)\.(\d+)\.(\d+)$') {
        throw "BaselineTag '$BaselineTag' is not a vMAJOR.MINOR.PATCH tag"
    }
    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    $patch = [int]$Matches[3]

    $hasMajor = $false
    $hasMinor = $false
    foreach ($labels in $PrLabelSets) {
        if ($labels -contains "semver:major" -or $labels -contains "breaking") { $hasMajor = $true }
        if ($labels -contains "semver:minor" -or $labels -contains "type:feature" -or $labels -contains "enhancement") { $hasMinor = $true }
    }

    if ($hasMajor) { $segment = "major"; $computed = "v$($major + 1).0.0" }
    elseif ($hasMinor) { $segment = "minor"; $computed = "v$major.$($minor + 1).0" }
    else { $segment = "patch"; $computed = "v$major.$minor.$($patch + 1)" }

    if (-not $ExplicitVersion) {
        return [pscustomobject]@{ Version = $computed; Segment = $segment; Halted = $false; HaltReason = $null }
    }

    if ($ExplicitVersion -eq $computed -or $Force) {
        return [pscustomobject]@{ Version = $ExplicitVersion; Segment = $segment; Halted = $false; HaltReason = $null }
    }

    if ($hasMajor -and $ExplicitVersion -ne $computed) {
        return [pscustomobject]@{
            Version    = $ExplicitVersion
            Segment    = $segment
            Halted     = $true
            HaltReason = "explicit -TargetVersion $ExplicitVersion under-bumps past a breaking-labeled PR in the delta (labels imply $computed); pass -Force to override"
        }
    }

    return [pscustomobject]@{ Version = $ExplicitVersion; Segment = $segment; Halted = $false; HaltReason = $null }
}

function ConvertTo-PromotedReleaseBody {
    [CmdletBinding()]
    param([Parameter(Mandatory)] [string]$ChangelogEntry)

    return ($ChangelogEntry -replace '(?m)^### For consumers$', '## For consumers')
}

function Build-ChangelogEntry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [array]$MergedPrs,
        [Parameter(Mandatory)] [string]$TargetVersion,
        [Parameter(Mandatory)] [array]$Consumers,
        [Parameter(Mandatory)] [array]$ResolvedIssueNumbers
    )

    $fixedEntries = @()
    $addedEntries = @()
    $maintEntries = @()
    $breakingEntries = @()

    foreach ($pr in $MergedPrs) {
        if ($pr.Labels -contains "breaking" -or $pr.Labels -contains "semver:major") {
            $breakingEntries += "- **[#$($pr.Number)] $($pr.Title)**"
        }
        if ($pr.Labels -contains "type:defect" -or $pr.Labels -contains "bug") {
            if ($pr.Body -notmatch '(?ms)### Changelog Entry') {
                return [pscustomobject]@{
                    Halted     = $true
                    HaltReason = "PR #$($pr.Number) is labeled type:defect but has no ### Changelog Entry block"
                    Text       = $null
                }
            }
            $rootCauseMatch = [regex]::Match($pr.Body, '(?ms)\*\*Root Cause & Escape:\*\*\s*(.+?)\r?\n')
            $preventionMatch = [regex]::Match($pr.Body, '(?ms)\*\*Prevention:\*\*\s*(.+?)\r?\n')
            $rootCause = if ($rootCauseMatch.Success) { $rootCauseMatch.Groups[1].Value.Trim() } else { "" }
            $prevention = if ($preventionMatch.Success) { $preventionMatch.Groups[1].Value.Trim() } else { "" }
            $fixedEntries += "- **[#$($pr.Number)] $($pr.Title)**`n  - **Origin / Root Cause:** $rootCause`n  - **Prevention / Test:** $prevention"
        }
        elseif ($pr.Labels -contains "type:feature" -or $pr.Labels -contains "type:task" -or $pr.Labels -contains "enhancement") {
            $addedEntries += "- **[#$($pr.Number)] $($pr.Title)**"
        }
        else {
            $maintEntries += "- **[#$($pr.Number)] $($pr.Title)**"
        }
    }

    $breakingBody = if ($breakingEntries.Count -gt 0) { $breakingEntries -join "`n" } else { "None" }
    $fixedBody = if ($fixedEntries.Count -gt 0) { $fixedEntries -join "`n" } else { "None" }
    $addedBody = if ($addedEntries.Count -gt 0) { $addedEntries -join "`n" } else { "None" }
    $maintBody = if ($maintEntries.Count -gt 0) { $maintEntries -join "`n" } else { "None" }
    $issuesBody = if ($ResolvedIssueNumbers.Count -gt 0) { ($ResolvedIssueNumbers | ForEach-Object { "#$_" }) -join ", " } else { "None" }
    $consumersBody = ($Consumers | ForEach-Object { "``djntechnic/$_``" }) -join ", "

    $today = (Get-Date -Format "yyyy-MM-dd")
    $text = @"
## $TargetVersion - $today

### Breaking Changes
$breakingBody

### Fixed
$fixedBody

### Added / Changed
$addedBody

### Platform Maintenance
$maintBody

### For consumers
- **Resolves Upstream Issues:** $issuesBody
- **Target Downstream Repositories:** $consumersBody
- **Expected Pin Migration:** ``/bump-bedrock-pin $TargetVersion``
"@

    return [pscustomobject]@{ Halted = $false; HaltReason = $null; Text = $text }
}

function Test-RemoteReleaseState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)] [bool]$TagExists,
        [Parameter(Mandatory)] [bool]$ReleaseExists
    )

    if (-not $TagExists) {
        return [pscustomobject]@{ Phase = "NotStarted" }
    }
    if (-not $ReleaseExists) {
        return [pscustomobject]@{ Phase = "TagOnly" }
    }
    return [pscustomobject]@{ Phase = "Published" }
}

Export-ModuleMember -Function Resolve-TargetVersion, ConvertTo-PromotedReleaseBody, Build-ChangelogEntry, Test-RemoteReleaseState
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pwsh -Command "Invoke-Pester -Path scripts/maintenance/CutBedrockRelease.Helpers.Tests.ps1 -Output Detailed"`
Expected: PASS (13 tests, 0 failed)

- [ ] **Step 5: Write the orchestrator script**

```powershell
# scripts/maintenance/Cut-BedrockRelease.ps1
<#
.SYNOPSIS
    Unified local release orchestrator for bedrock. Repository-local
    preparation only — never touches another GitHub repository, never
    closes or files an issue anywhere (that is cascade.yml's job, see
    docs/specs/2026-09-22-release-automation-and-cascade-design.md §3).
.DESCRIPTION
    1. Validates a clean master working tree.
    2. Resolves the baseline tag and target version (labels drive semver
       selection unless -TargetVersion is given; §4.3).
    3. Fetches merged-PR delta via a single gh api graphql round-trip.
    4. Assembles and prepends the CHANGELOG.md entry, syncs version
       manifests.
    5. Runs pre-tag quality gates: s015_audit_release_notes, s012_audit_pins,
       pytest, npm test, npm run typecheck.
    6. Commits, tags at the full 40-char SHA, pushes, verifies remote
       visibility.
    7. Publishes the GitHub Release with the heading-promoted body.
.PARAMETER TargetVersion
    Explicit vX.Y.Z override. Must agree with what merged-PR labels imply
    unless -Force is passed.
.PARAMETER Resume
    Re-entrant recovery: checks the three-fact remote state (tag exists?
    release exists?) and resumes from the first incomplete step instead of
    re-running everything.
.PARAMETER Force
    Overrides the halt-for-confirmation guard when an explicit
    -TargetVersion under-bumps past a labeled breaking change, and the
    halt-for-confirmation guard for a type:defect PR missing its
    ### Changelog Entry block.
.EXAMPLE
    pwsh ./scripts/maintenance/Cut-BedrockRelease.ps1
    pwsh ./scripts/maintenance/Cut-BedrockRelease.ps1 -TargetVersion v0.11.0
    pwsh ./scripts/maintenance/Cut-BedrockRelease.ps1 -Resume
#>
[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$TargetVersion,
    [switch]$Resume,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "CutBedrockRelease.Helpers.psm1") -Force

function Test-CleanWorkingTree {
    $status = git status --porcelain
    if ($status) {
        throw "Working tree is not clean. Commit or stash changes before cutting a release."
    }
    $branch = git rev-parse --abbrev-ref HEAD
    if ($branch -ne "master") {
        throw "Cut-BedrockRelease.ps1 must run on master, not '$branch'."
    }
}

function Get-LatestReleaseTag {
    git fetch --tags origin | Out-Null
    $tags = git tag --list "v*.*.*" --sort=-v:refname
    if (-not $tags) {
        throw "No existing vMAJOR.MINOR.PATCH tag found to compute a baseline from."
    }
    return ($tags -split "`n")[0]
}

function Invoke-GraphQLDeltaQuery {
    param([Parameter(Mandatory)] [string]$BaselineTag)

    $query = @'
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    pullRequests(states: MERGED, first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        number
        title
        body
        labels(first: 20) { nodes { name } }
        closingIssuesReferences(first: 10) { nodes { number } }
      }
    }
  }
}
'@
    $raw = gh api graphql -f query=$query -f owner="djntechnic" -f repo="bedrock" | ConvertFrom-Json
    return $raw.data.repository.pullRequests.nodes
}

function Invoke-PreTagGates {
    param([Parameter(Mandatory)] [string]$Version)

    Write-Host "==> Gate: s015_audit_release_notes" -ForegroundColor Cyan
    python scripts/audit/s015_audit_release_notes.py $Version --root .
    if ($LASTEXITCODE -ne 0) { throw "s015_audit_release_notes failed (exit $LASTEXITCODE)" }

    Write-Host "==> Gate: s012_audit_pins" -ForegroundColor Cyan
    python scripts/audit/s012_audit_pins.py --root .
    if ($LASTEXITCODE -ne 0) { throw "s012_audit_pins failed (exit $LASTEXITCODE)" }

    Write-Host "==> Gate: pytest" -ForegroundColor Cyan
    Push-Location packages/bedrock-api
    try {
        pytest
        if ($LASTEXITCODE -ne 0) { throw "pytest failed (exit $LASTEXITCODE)" }
    } finally { Pop-Location }

    Write-Host "==> Gate: npm test" -ForegroundColor Cyan
    npm test
    if ($LASTEXITCODE -ne 0) { throw "npm test failed (exit $LASTEXITCODE)" }

    Write-Host "==> Gate: npm run typecheck" -ForegroundColor Cyan
    npm run typecheck
    if ($LASTEXITCODE -ne 0) { throw "npm run typecheck failed (exit $LASTEXITCODE)" }
}

function New-ReleaseCommitAndTag {
    param([Parameter(Mandatory)] [string]$Version)

    git add CHANGELOG.md package.json packages/bedrock-api/pyproject.toml README.md
    git commit -m "release: $Version"
    $sha = (git rev-parse HEAD).Trim()
    git tag -a $Version $sha -m "release: $Version"
    git push origin master
    git push origin $Version

    $remoteTag = git ls-remote --tags origin $Version
    if (-not $remoteTag) {
        throw "git push origin $Version did not report HTTP success but the tag is not visible on origin. Do not report the release as ready; hand the user the commands and wait, per CLAUDE.md."
    }
    return $sha
}

function Publish-GitHubRelease {
    param(
        [Parameter(Mandatory)] [string]$Version,
        [Parameter(Mandatory)] [string]$ChangelogEntry
    )

    $body = ConvertTo-PromotedReleaseBody -ChangelogEntry $ChangelogEntry
    $bodyFile = New-TemporaryFile
    Set-Content -Path $bodyFile -Value $body -NoNewline
    try {
        gh release create $Version --title $Version --notes-file $bodyFile --target master
        if ($LASTEXITCODE -ne 0) { throw "gh release create failed (exit $LASTEXITCODE)" }
    } finally {
        Remove-Item $bodyFile -ErrorAction SilentlyContinue
    }
}

# --- Main flow -------------------------------------------------------------

$tagName = if ($TargetVersion) { $TargetVersion } else { $null }
$remoteTagExists = if ($tagName) { [bool](git ls-remote --tags origin $tagName) } else { $false }
$remoteReleaseExists = $false
if ($remoteTagExists) {
    gh release view $tagName *> $null
    $remoteReleaseExists = ($LASTEXITCODE -eq 0)
}

if ($Resume) {
    $state = Test-RemoteReleaseState -TagExists $remoteTagExists -ReleaseExists $remoteReleaseExists
    if ($state.Phase -eq "Published") {
        Write-Host "==> $tagName is already tagged and published. No further local action taken." -ForegroundColor Green
        exit 0
    }
}

Test-CleanWorkingTree
$baselineTag = Get-LatestReleaseTag
$mergedPrs = Invoke-GraphQLDeltaQuery -BaselineTag $baselineTag

$labelSets = $mergedPrs | ForEach-Object { $_.labels.nodes | ForEach-Object { $_.name } }
$resolution = Resolve-TargetVersion -BaselineTag $baselineTag -PrLabelSets $labelSets -ExplicitVersion $TargetVersion -Force:$Force
if ($resolution.Halted) {
    throw $resolution.HaltReason
}
$version = $resolution.Version

$consumers = (Get-Content bedrock.toml -Raw | Select-String -Pattern 'consumers\s*=\s*\[(.*?)\]').Matches[0].Groups[1].Value `
    -split "," | ForEach-Object { $_.Trim().Trim('"') }
$issueNumbers = $mergedPrs | ForEach-Object { $_.closingIssuesReferences.nodes } | ForEach-Object { $_.number } | Sort-Object -Unique

$entryResult = Build-ChangelogEntry -MergedPrs $mergedPrs -TargetVersion $version -Consumers $consumers -ResolvedIssueNumbers $issueNumbers
if ($entryResult.Halted -and -not $Force) {
    throw $entryResult.HaltReason
}

$changelogPath = "CHANGELOG.md"
$existing = Get-Content $changelogPath -Raw
Set-Content -Path $changelogPath -Value ($entryResult.Text + "`n`n" + $existing) -NoNewline

Invoke-PreTagGates -Version $version

if ($PSCmdlet.ShouldProcess("origin/master and tag $version", "commit, tag, and push")) {
    New-ReleaseCommitAndTag -Version $version
    Publish-GitHubRelease -Version $version -ChangelogEntry $entryResult.Text
}

Write-Host "==> Release $version published. Server-side cascade and issue closure run in CI on release: published." -ForegroundColor Green
exit 0
```

- [ ] **Step 6: Verify the orchestrator's syntax parses**

Run: `pwsh -Command "$null = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path 'scripts/maintenance/Cut-BedrockRelease.ps1'), [ref]$null, [ref]$errors); if ($errors) { $errors; exit 1 } else { Write-Host 'parses clean' }"`
Expected: `parses clean`, no errors.

- [ ] **Step 7: Commit**

```bash
git add scripts/maintenance/Cut-BedrockRelease.ps1 \
        scripts/maintenance/CutBedrockRelease.Helpers.psm1 \
        scripts/maintenance/CutBedrockRelease.Helpers.Tests.ps1
git commit -m "$(cat <<'EOF'
feat(release): add Cut-BedrockRelease.ps1 local orchestrator

Splits pure decision logic (semver selection, heading promotion, changelog
assembly, three-fact resume state) into a Pester-testable helper module,
CutBedrockRelease.Helpers.psm1 — the first PowerShell test convention in
this repo — and wraps it with the git/gh mutation steps per the design
spec's local/server-side execution boundary: this script never touches a
downstream repository or files/closes an issue anywhere.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Server-side upstream issue closure in `cascade.yml`

**Files:**
- Modify: `.github/workflows/cascade.yml` (add a new job, `close-upstream-issues`)
- Test: `packages/bedrock-api/tests/test_cascade_workflow_jobs.py`

**Interfaces:**
- Consumes: nothing programmatic from earlier tasks — reads the release
  body's `Resolves Upstream Issues` key that Task 4's `Build-ChangelogEntry`
  / `Publish-GitHubRelease` produce, at runtime, the same way the existing
  `file-adoption-issues` job reads `## For consumers`.
- Produces: nothing consumed by a later task's code.

- [ ] **Step 1: Write the failing test**

```python
# packages/bedrock-api/tests/test_cascade_workflow_jobs.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/bedrock-api && python -m pytest tests/test_cascade_workflow_jobs.py -v`
Expected: FAIL — `close-upstream-issues` not present in `data["jobs"]`.

- [ ] **Step 3: Add the job to `cascade.yml`**

Insert a new top-level job in `.github/workflows/cascade.yml`, after the
existing `file-adoption-issues` job (after line 74, end of file):

```yaml

  close-upstream-issues:
    runs-on: ubuntu-latest
    steps:
      - name: Resolve the release tag and body
        id: resolve
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          REPO: ${{ github.repository }}
          EVENT_BODY: ${{ github.event.release.body }}
          EVENT_TAG: ${{ github.event.release.tag_name }}
          INPUT_TAG: ${{ inputs.tag }}
        run: |
          if [ -n "$INPUT_TAG" ]; then
            TAG="$INPUT_TAG"
            BODY=$(gh release view "$TAG" --repo "$REPO" --json body --jq .body)
          else
            TAG="$EVENT_TAG"
            BODY="$EVENT_BODY"
          fi
          {
            echo "tag=$TAG"
            echo 'body<<CASCADE_EOF'
            printf '%s\n' "$BODY"
            echo 'CASCADE_EOF'
          } >> "$GITHUB_OUTPUT"

      - name: Close every resolved upstream issue
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          REPO: ${{ github.repository }}
          TAG: ${{ steps.resolve.outputs.tag }}
          BODY: ${{ steps.resolve.outputs.body }}
        run: |
          issues_line=$(printf '%s' "$BODY" | grep -m1 '\*\*Resolves Upstream Issues:\*\*' || true)
          if [ -z "$issues_line" ]; then
            echo "No 'Resolves Upstream Issues' key found in release $TAG body; nothing to close." >&2
            exit 0
          fi
          issue_numbers=$(printf '%s' "$issues_line" | grep -oE '#[0-9]+' | tr -d '#')
          if [ -z "$issue_numbers" ]; then
            echo "Resolves Upstream Issues is 'None' or unparseable for $TAG; nothing to close." >&2
            exit 0
          fi
          for issue in $issue_numbers; do
            gh issue comment "$issue" --repo "$REPO" --body "Resolved and verified in bedrock release \`$TAG\`."
            gh issue close "$issue" --repo "$REPO" --reason completed
          done
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/bedrock-api && python -m pytest tests/test_cascade_workflow_jobs.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Run the full backend suite to guard against regressions**

Run: `cd packages/bedrock-api && python -m pytest`
Expected: all tests pass, zero failures.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/cascade.yml \
        packages/bedrock-api/tests/test_cascade_workflow_jobs.py
git commit -m "$(cat <<'EOF'
feat(cascade): close upstream issues server-side on release publish

Adds close-upstream-issues as a sibling job in cascade.yml (not a second
workflow file, so the two stay visibly coupled to the same release:
published trigger). Runs under the default GITHUB_TOKEN scoped to
djntechnic/bedrock only — same-repo, low-privilege, no CASCADE_TOKEN
needed — closing every issue number in the release body's Resolves
Upstream Issues key with reason completed.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `bedrock-ai-kit` `/cut-release` skill realignment

**Files:**
- Modify: `C:\Dev\bedrock-ai-kit\skills\cut-release\SKILL.md`

**Interfaces:**
- Consumes: `scripts/maintenance/Cut-BedrockRelease.ps1` (Task 4) — path
  and switches `-TargetVersion`, `-Resume`, `-Force`, `-WhatIf`
  (PowerShell's built-in `SupportsShouldProcess` switch, since the script
  declares `[CmdletBinding(SupportsShouldProcess)]`).
- Produces: nothing consumed by another task; this is the terminal task.

This task operates in a different repository
(`C:\Dev\bedrock-ai-kit`) than the rest of this plan. It has no Python/TS
test suite of its own to extend — `SKILL.md` is a documentation artifact
consumed by an agent's skill-invocation runtime, not executable code — so
its own verification step is a manual content check rather than an
automated test, mirroring how the existing skill file has no test coverage
today. The "reproduction test" invariant (§S006) does not apply to a
documentation-only change in a sibling repository outside `bedrock`'s own
audited surface; this task is exempted the same way `docs/**` changes are
exempted under `[tool.bedrock.audit.s006]`.

- [ ] **Step 1: Read the current skill file**

Run: `cat C:/Dev/bedrock-ai-kit/skills/cut-release/SKILL.md` (or open it in
an editor) to confirm the current manual 7-step structure before editing —
do this immediately before Step 2 so the diff reflects the file's actual
current content, not a stale assumption.

- [ ] **Step 2: Replace the manual step-by-step body with delegation to the orchestrator**

Replace the skill's execution section (the manual 7-step sequence) with:

```markdown
## Execution

This skill delegates entirely to bedrock's own local release orchestrator —
it does not perform any step manually. Run, from the `bedrock` repository
root:

```bash
pwsh ./scripts/maintenance/Cut-BedrockRelease.ps1
```

Pass `-TargetVersion vX.Y.Z` to override the auto-computed semver segment
(the script halts for confirmation if the override under-bumps past a
merged PR carrying a `breaking` or `semver:major` label; pass `-Force` to
proceed anyway). Pass `-Resume` to recover after a partial failure — the
script checks three remote facts (does the tag exist on `origin`? does a
GitHub Release exist at that tag? — cascade itself is always server-owned
and is never re-triggered locally) and resumes from the first incomplete
step. Pass `-WhatIf` for a dry run that reports what would change without
committing, tagging, pushing, or publishing.

The script's own scope ends at `gh release create` — it never touches
`CollectIt` or `MLBTracker`, and it never files or closes an issue in
another repository. Everything past that point (downstream adoption issue
filing, upstream issue closure) is server-side, in
`.github/workflows/cascade.yml`, triggered automatically by the
`release: published` event the script's last step produces. If
`git push origin <tag>` fails with HTTP 403, the tag was not created — do
not report the release as ready; hand the user the exact commands the
script printed and wait, per bedrock's own `CLAUDE.md` release-workflow
contract.

## Cross-Repo Synchronization

After a release publishes, verify this skill and bedrock's own release
tooling have not drifted:

```bash
git -C C:/Dev/bedrock log -1 --format=%H -- scripts/maintenance/Cut-BedrockRelease.ps1
```

Compare the printed commit SHA against the SHA this skill file was last
updated against (recorded in this file's own git history) — if
`Cut-BedrockRelease.ps1` has moved since this skill was last synced, update
this file's parameter list and switches to match before relying on it for
the next release.
```

- [ ] **Step 3: Verify the file is well-formed markdown**

Run: `cat C:/Dev/bedrock-ai-kit/skills/cut-release/SKILL.md | head -50` and
visually confirm the frontmatter (if any) at the top of the file is
unmodified and the new `## Execution` / `## Cross-Repo Synchronization`
sections render as valid markdown (no unclosed code fences).

- [ ] **Step 4: Commit in the bedrock-ai-kit repository**

```bash
cd C:/Dev/bedrock-ai-kit
git add skills/cut-release/SKILL.md
git commit -m "$(cat <<'EOF'
docs(cut-release): delegate to Cut-BedrockRelease.ps1 orchestrator

The skill's manual 7-step sequence is replaced by a single delegated call
to bedrock's own scripts/maintenance/Cut-BedrockRelease.ps1, which now
owns working-tree validation, semver selection, changelog assembly, the
pre-tag quality gates, and the commit/tag/push/publish sequence. Cross-repo
mutation (downstream adoption issues, upstream issue closure) stays
entirely server-side in cascade.yml, consistent with the release-automation
design's local/server-side execution boundary.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
cd C:/Dev/bedrock
```

---

## Self-Review

**1. Spec coverage:**
- §1 invariant 1 (cascade.yml sole cross-repo mechanism) — Task 4's script
  never calls `gh issue create`/`close` against another repo; Task 5's new
  job stays scoped to `djntechnic/bedrock`. Covered.
- §1 invariant 2 (dual-heading contract) — Task 3's audit validates the
  `###` form; Task 4's `ConvertTo-PromotedReleaseBody` performs the
  promotion, tested in Task 4 Step 1. Covered.
- §1 invariant 3 (immutable SHA anchoring) — Task 4's
  `New-ReleaseCommitAndTag` resolves `$sha` post-commit via
  `git rev-parse HEAD` and tags that SHA explicitly. Covered.
- §2.1-2.4 (§S015 contract + audit) — Tasks 2 and 3. Covered, including the
  bolded-bullet regex tolerance and the section-order/adjacency check.
- §2.2 PR template requirement — Task 2 Step 6. Covered.
- §3.1 (7-step local orchestrator) — Task 4's main flow implements all
  seven steps in order. Covered.
- §3.2 (server-side issue closure + existing cascade dispatch) — Task 5
  adds the closure job; the existing `file-adoption-issues` job is
  untouched. Covered.
- §4.1 (three-fact resume state machine) — `Test-RemoteReleaseState` +
  the `-Resume` branch in Task 4's main flow, tested in Task 4 Step 1.
  Covered.
- §4.2 (pre-mutation network safety, single GraphQL round-trip) — Task 4's
  main flow does all `gh`/network reads (`Invoke-GraphQLDeltaQuery`) before
  any `git add`/`commit`/`tag`/`push`. Covered.
- §4.3 (semver segment selection + halt/-Force) — `Resolve-TargetVersion`,
  tested in Task 4 Step 1. Covered.
- §5.1 (`.github/release.yml` + `bedrock.toml` ecosystem list) — Task 1 and
  Task 2. Covered, including the parity test against `cascade.yml`'s
  matrix.
- §5.2 (dual-location audit placement + registration) — Task 3. Covered.
- §5.3 (standard doc authored, registered in two places) — Task 2. Covered.
- §7 (explicitly out of scope for the *design* doc) — not applicable to
  this plan; this plan is precisely the follow-on implementation work §7
  names.

**2. Placeholder scan:** No "TBD"/"TODO"/"implement later" strings appear
in any task. Every code block (Python, PowerShell, YAML, Markdown) is
complete and directly runnable/committable as written.

**3. Type/signature consistency:** `ReleaseNoteViolation` (Task 3) matches
`PinViolation`'s single-field `message: str` shape used elsewhere in the
codebase. `s015_audit_release_notes.main(argv)` matches the `_AuditModule`
protocol's `main(self, argv: list[str] | None = None) -> int` shape used by
every other module, even though it is not registered in `AUDIT_MODULES`
(documented rationale: it requires a positional version argument the
generic sweep cannot supply). `Resolve-TargetVersion`, `Build-ChangelogEntry`,
`ConvertTo-PromotedReleaseBody`, and `Test-RemoteReleaseState` are used with
identical parameter names between their Pester test definitions (Task 4
Step 1) and their implementations (Task 4 Step 3), and their return shapes
(`.Version`, `.Segment`, `.Halted`, `.HaltReason`, `.Text`, `.Phase`) are
consistent between definition and the orchestrator's own consumption of
them in the main flow.

**4. Review Focus:** all five items listed above are each paired with a
test in the task that owns the code (Task 4 Step 1 for the first two and
the fifth; Task 3 Step 1 for the third and fourth).
