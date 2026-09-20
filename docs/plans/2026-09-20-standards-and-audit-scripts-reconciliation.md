# Standards & Audit Scripts Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile all standards documents (§S001–§S014, §S100) with their audit scripts, enforce the `s###_audit_[description].py` naming standard, establish 1:1 runner shims in `scripts/audit/`, prune legacy duplicates, implement S100 domain registry audit, and deploy across `bedrock`, `bedrock-ai-kit`, `CollectIt`, and `MLBTracker`.

**Architecture:** Audit implementations remain packaged under `packages/bedrock-api/bedrock/tools/s###_audit_[description].py` for downstream pip distribution, paired 1:1 with lightweight executable root shims in `scripts/audit/s###_audit_[description].py`. `run_all.py` dispatches the full 15-audit platform suite. Standards frontmatter and authoring documentation are updated and synchronized to `bedrock-ai-kit` and consumer applications.

**Tech Stack:** Python 3.11, pytest, `bedrock.tools._reporter.AuditReporter`, `bedrock.tools._config`, PowerShell 7 (`pwsh`), Git.

**Spec:** [`docs/specs/2026-09-20-standards-and-audit-scripts-reconciliation-design.md`](../specs/2026-09-20-standards-and-audit-scripts-reconciliation-design.md)

## Global Constraints

- Audit Python scripts must follow `s###_audit_[description].py` snake_case naming (valid Python module identifiers; no hyphens in python filenames).
- Every standard in `docs/standards/s###-*.md` must pair 1:1 with an audit module in `packages/bedrock-api/bedrock/tools/` and a runner shim in `scripts/audit/`.
- All audits must inherit from `bedrock.tools._reporter.AuditReporter` and exit with code 0 (clean), 1 (violation), or 2 (configuration/environment error).
- Zero broken tests: all pytest suites across `packages/bedrock-api/tests` must pass hermetically.
- Shell status evaluations must inspect `$LASTEXITCODE` directly without masking pipes.

---

### Task 1: Reconcile & Standardize S001 Audit (`s001_audit_duplicates.py`)

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/s001_audit_duplicates.py`
- Create: `scripts/audit/s001_audit_duplicates.py`
- Modify: `packages/bedrock-api/tests/test_audit_s001_to_s004.py`
- Delete: `packages/bedrock-api/bedrock/tools/audit_s1_duplicates.py`
- Delete: `packages/bedrock-api/bedrock/tools/audit_s001_duplicates.py`
- Delete: `packages/bedrock-api/tests/test_audit_s1_duplicates.py`

**Interfaces:**

- Consumes: `bedrock.tools._reporter.AuditReporter`, `bedrock.tools._config.load_bedrock_config`
- Produces: `s001_audit_duplicates.main(argv: list[str] | None = None) -> int`

- [x] **Step 1: Port missing S1 test cases into `test_audit_s001_to_s004.py`**

Update `packages/bedrock-api/tests/test_audit_s001_to_s004.py` to import `s001_audit_duplicates` and include tests for direct `axios` imports, `@shadows <Name>` annotations, and duplicate export detection.

```python
def test_s001_flags_bare_axios_import(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s001]\nexemptions = []\n")
    _write(tmp_path / "api" / "client.ts", 'import axios from "axios";')
    assert s001_audit_duplicates.main(["--root", str(tmp_path)]) == 1

def test_s001_allows_shadows_marker(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s001]\nexemptions = []\n")
    _write(tmp_path / "components" / "Button.tsx", "// @shadows Button\nexport function Button() { return null; }")
    _write(tmp_path / "legacy" / "Button.tsx", "export function Button() { return null; }")
    assert s001_audit_duplicates.main(["--root", str(tmp_path)]) == 0
```

- [x] **Step 2: Implement `s001_audit_duplicates.py` consolidating all S001 invariants**

Create `packages/bedrock-api/bedrock/tools/s001_audit_duplicates.py` combining:

- Exported symbol collisions across the repo
- `@shadows <Name>` comment bypass
- Direct `axios` import check (`_AXIOS_IMPORT = re.compile(r'^\s*import\s+(?!type\b)(?:axios\b|\*\s+as\s+\w+)[^;]*?from\s+["\']axios["\']', re.M)`)
- Barrel-only primitives, inline formatters, inline query keys
- Standard `AuditReporter` lifecycle

- [x] **Step 3: Create runner shim `scripts/audit/s001_audit_duplicates.py`**

```python
#!/usr/bin/env python
"""Runner shim for Standard S001 audit."""
import sys
from bedrock.tools.s001_audit_duplicates import main

if __name__ == "__main__":
    sys.exit(main())
```

- [x] **Step 4: Remove legacy files**

Delete:

- `packages/bedrock-api/bedrock/tools/audit_s1_duplicates.py`
- `packages/bedrock-api/bedrock/tools/audit_s001_duplicates.py`
- `packages/bedrock-api/tests/test_audit_s1_duplicates.py`

- [x] **Step 5: Run tests to verify**

Run: `pytest packages/bedrock-api/tests/test_audit_s001_to_s004.py -k "s001" -v`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/bedrock-api/bedrock/tools/s001_audit_duplicates.py scripts/audit/s001_audit_duplicates.py packages/bedrock-api/tests/test_audit_s001_to_s004.py
git rm packages/bedrock-api/bedrock/tools/audit_s1_duplicates.py packages/bedrock-api/bedrock/tools/audit_s001_duplicates.py packages/bedrock-api/tests/test_audit_s1_duplicates.py
git commit -m "refactor(tools): standardize s001_audit_duplicates and prune audit_s1_duplicates"
```

---

### Task 2: Reconcile S009 Design Tokens & Prune Legacy Audit

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/s009_audit_design_tokens.py`
- Create: `scripts/audit/s009_audit_design_tokens.py`
- Modify: `packages/bedrock-api/tests/test_audit_design_tokens.py`
- Delete: `packages/bedrock-api/bedrock/tools/audit_design_tokens.py`
- Delete: `packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py`

**Interfaces:**

- Consumes: `bedrock.tools._reporter.AuditReporter`, `bedrock.tools._config.load_bedrock_config`
- Produces: `s009_audit_design_tokens.main(argv: list[str] | None = None) -> int`

- [ ] **Step 1: Move `audit_s009_design_tokens.py` to `s009_audit_design_tokens.py`**

Rename `packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py` -> `packages/bedrock-api/bedrock/tools/s009_audit_design_tokens.py`.

- [ ] **Step 2: Create runner shim `scripts/audit/s009_audit_design_tokens.py`**

```python
#!/usr/bin/env python
"""Runner shim for Standard S009 audit."""
import sys
from bedrock.tools.s009_audit_design_tokens import main

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Update `test_audit_design_tokens.py` and `test_audit_s009_to_s012.py`**

Update `test_audit_s009_to_s012.py` and `test_audit_design_tokens.py` to import `s009_audit_design_tokens`. Delete `packages/bedrock-api/bedrock/tools/audit_design_tokens.py`.

- [ ] **Step 4: Run tests to verify**

Run: `pytest packages/bedrock-api/tests/test_audit_s009_to_s012.py -k "s009" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/bedrock-api/bedrock/tools/s009_audit_design_tokens.py scripts/audit/s009_audit_design_tokens.py packages/bedrock-api/tests/test_audit_s009_to_s012.py packages/bedrock-api/tests/test_audit_design_tokens.py
git rm packages/bedrock-api/bedrock/tools/audit_design_tokens.py packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py
git commit -m "refactor(tools): standardize s009_audit_design_tokens and prune audit_design_tokens"
```

---

### Task 3: Rename S002–S008, S010–S014 Audits & Create Runner Shims

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/s002_audit_grids.py` through `s014_audit_ledger_freshness.py`
- Create: `scripts/audit/s002_audit_grids.py` through `s014_audit_ledger_freshness.py`
- Modify: `packages/bedrock-api/tests/test_audit_s001_to_s004.py`
- Modify: `packages/bedrock-api/tests/test_audit_s005_to_s008.py`
- Modify: `packages/bedrock-api/tests/test_audit_s009_to_s012.py`
- Modify: `packages/bedrock-api/tests/test_audit_api_docs.py`
- Modify: `packages/bedrock-api/tests/test_audit_ledger_freshness.py`
- Delete: old `audit_s002_*.py` through `audit_s014_*.py` files in `packages/bedrock-api/bedrock/tools/`

**Interfaces:**

- Consumes: `bedrock.tools._reporter.AuditReporter`
- Produces: `s###_audit_[name].main(argv: list[str] | None = None) -> int` for each standard

- [ ] **Step 1: Rename tool modules to `s###_audit_[name].py`**

Rename via git mv:

- `audit_s002_grids.py` -> `s002_audit_grids.py`
- `audit_s003_logging.py` -> `s003_audit_logging.py`
- `audit_s004_config.py` -> `s004_audit_config.py`
- `audit_s005_testing.py` -> `s005_audit_testing.py`
- `audit_s006_pr_workflow.py` -> `s006_audit_pr_workflow.py`
- `audit_s007_schema_catalog.py` -> `s007_audit_schema_catalog.py`
- `audit_s008_guidance.py` -> `s008_audit_guidance.py`
- `audit_s010_security.py` -> `s010_audit_security.py`
- `audit_s011_navigation.py` -> `s011_audit_navigation.py`
- `audit_s012_pins.py` -> `s012_audit_pins.py`
- `audit_s013_api_docs.py` -> `s013_audit_api_docs.py`
- `audit_s014_ledger_freshness.py` -> `s014_audit_ledger_freshness.py`

- [ ] **Step 2: Create runner shims in `scripts/audit/`**

Create runner shims for `s002` through `s014` in `scripts/audit/` following the standard 4-line template:

```python
#!/usr/bin/env python
"""Runner shim for Standard S### audit."""
import sys
from bedrock.tools.s002_audit_grids import main

if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Update all test suite imports**

Update module imports in:

- `packages/bedrock-api/tests/test_audit_s001_to_s004.py`
- `packages/bedrock-api/tests/test_audit_s005_to_s008.py`
- `packages/bedrock-api/tests/test_audit_s009_to_s012.py`
- `packages/bedrock-api/tests/test_audit_api_docs.py`
- `packages/bedrock-api/tests/test_audit_ledger_freshness.py`

- [ ] **Step 4: Run the complete audit test suite**

Run: `pytest packages/bedrock-api/tests/test_audit_*.py -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bedrock-api/bedrock/tools/s*.py scripts/audit/*.py packages/bedrock-api/tests/
git commit -m "refactor(tools): rename platform audits to s###_audit_* and generate runner shims"
```

---

### Task 4: Implement S100 Domain Registry Audit & Shim

**Files:**

- Create: `packages/bedrock-api/bedrock/tools/s100_audit_domain_registry.py`
- Create: `scripts/audit/s100_audit_domain_registry.py`
- Create: `packages/bedrock-api/tests/test_audit_s100_domain_registry.py`

**Interfaces:**

- Consumes: `bedrock.tools._reporter.AuditReporter`, `bedrock.tools._config.load_bedrock_config`
- Produces: `s100_audit_domain_registry.main(argv: list[str] | None = None) -> int`

- [x] **Step 1: Write unit tests for S100 domain registry validation**

Create `packages/bedrock-api/tests/test_audit_s100_domain_registry.py`:

- Test platform range `S001`–`S099`, `S100` requires `tier: platform`.
- Test domain range `S101`–`S199` requires `tier: domain`.
- Test invalid range (e.g. `s200`, `s000`) fails.
- Test missing YAML frontmatter fields fails.
- Test missing 5 mandatory sections fails.
- Test clean standards directory returns exit code 0.

- [x] **Step 2: Run test to verify it fails initially**

Run: `pytest packages/bedrock-api/tests/test_audit_s100_domain_registry.py -v`
Expected: FAIL (ModuleNotFoundError: `bedrock.tools.s100_audit_domain_registry`)

- [x] **Step 3: Implement `s100_audit_domain_registry.py`**

Implement `packages/bedrock-api/bedrock/tools/s100_audit_domain_registry.py` using `AuditReporter`:

- Parses frontmatter and headings of markdown files in `docs/standards/`.
- Verifies tier matching, reserved numbering ranges, and 5 mandatory sections.
- Exits 0 clean, 1 on violation, 2 on config error.

- [x] **Step 4: Create runner shim `scripts/audit/s100_audit_domain_registry.py`**

```python
#!/usr/bin/env python
"""Runner shim for Standard S100 audit."""
import sys
from bedrock.tools.s100_audit_domain_registry import main

if __name__ == "__main__":
    sys.exit(main())
```

- [x] **Step 5: Run tests to verify they pass**

Run: `pytest packages/bedrock-api/tests/test_audit_s100_domain_registry.py -v`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add packages/bedrock-api/bedrock/tools/s100_audit_domain_registry.py scripts/audit/s100_audit_domain_registry.py packages/bedrock-api/tests/test_audit_s100_domain_registry.py
git commit -m "feat(tools): implement s100_audit_domain_registry and runner shim"
```

---

### Task 5: Update Orchestrator (`run_all.py`), Runner (`run_qa.py`), and Sync Tooling (`sync_standards.py`)

**Files:**

- Modify: `packages/bedrock-api/bedrock/tools/run_all.py`
- Modify: `packages/bedrock-api/bedrock/tools/sync_standards.py`
- Modify: `packages/bedrock-api/tests/test_run_all.py` (or equivalent orchestrator test)
- Modify: `scripts/run_qa.py`

**Interfaces:**

- Consumes: `s001_audit_duplicates` through `s014_audit_ledger_freshness`, `s100_audit_domain_registry`
- Produces: `run_all.run_all(root: Path, fail_fast: bool = False) -> tuple[list[AuditRunResult], int]`

- [ ] **Step 1: Update `run_all.py` to import and dispatch new module names including S100**

Update `AUDIT_MODULES` in `packages/bedrock-api/bedrock/tools/run_all.py` with all 15 audit tools:
`s001` through `s014`, plus `("s100", s100_audit_domain_registry)`.
Update summary header: `[RUN-ALL] Platform Audit Suite (S001-S014, S100)`.

- [ ] **Step 2: Update `sync_standards.py`**

Ensure `sync_standards.py` correctly handles `s001`–`s014` and `s100`, preserving the canonical sync contract.

- [ ] **Step 3: Run full local QA and verify `run_all` exit code**

Run: `python -m bedrock.tools.run_all --root .`
Expected: Exit code 0, all 15 audits pass.

- [ ] **Step 4: Commit**

```bash
git add packages/bedrock-api/bedrock/tools/run_all.py packages/bedrock-api/bedrock/tools/sync_standards.py scripts/run_qa.py
git commit -m "feat(tools): update run_all to dispatch s###_audit_* modules including S100"
```

---

### Task 6: Reconcile Standards Docs Frontmatter & Authoring Documentation

**Files:**

- Modify: `docs/standards/s001-no-duplicate-ui-code.md` through `s014-issue-logging-and-ecosystem-governance.md`
- Modify: `docs/standards/s100-domain-standard-authoring.md`
- Modify: `docs/standards/README.md`

**Interfaces:**

- Standards YAML frontmatter aligns with `enforced_by: bedrock.tools.s###_audit_[name]` and `cli_command: "python scripts/audit/s###_audit_[name].py --root ."`

- [ ] **Step 1: Update frontmatter in all platform standards**

In `docs/standards/s001-*.md` through `s014-*.md`, update:

```markdown
enforced*by: bedrock.tools.s###\_audit*[name]
cli*command: "python scripts/audit/s###\_audit*[name].py --root ."
```

- [ ] **Step 2: Update `s100-domain-standard-authoring.md` and `docs/standards/README.md`**

Update `README.md` index table and authoring checklists to specify the `s###_audit_[name].py` naming standard and the 6-step authoring workflow for platform and domain standards.

- [ ] **Step 3: Run S100 audit to verify all standards pass inspection**

Run: `python scripts/audit/s100_audit_domain_registry.py --root .`
Expected: Exit code 0, all standards valid.

- [ ] **Step 4: Commit**

```bash
git add docs/standards/
git commit -m "docs(standards): update frontmatter to s###_audit_* and document authoring lifecycle"
```

---

### Task 7: Deploy & Reconcile in `bedrock-ai-kit` (`c:\Dev\bedrock-ai-kit`)

**Files:**

- Modify: `c:\Dev\bedrock-ai-kit\rules\s001-no-duplicate-ui-code.md` through `s014...`
- Modify: `c:\Dev\bedrock-ai-kit\rules\s100-domain-standard-authoring.md`
- Modify: `c:\Dev\bedrock-ai-kit\scripts\Sync-AgenticTooling.ps1`
- Modify: `c:\Dev\bedrock-ai-kit\scripts\Audit-AgenticTooling.ps1`

- [ ] **Step 1: Synchronize updated standards into `bedrock-ai-kit/rules/`**

Copy the updated `s001`–`s014` and `s100` markdown files from `c:\Dev\bedrock\docs\standards\` to `c:\Dev\bedrock-ai-kit\rules\`.

- [ ] **Step 2: Update `Sync-AgenticTooling.ps1` and `Audit-AgenticTooling.ps1`**

Ensure `Audit-AgenticTooling.ps1` and `Sync-AgenticTooling.ps1` recognize the `s###_audit_` naming convention and shims in `scripts/audit/`.

- [ ] **Step 3: Run validation in `bedrock-ai-kit`**

Run: `pwsh -File c:\Dev\bedrock-ai-kit\scripts\Audit-AgenticTooling.ps1 -Root c:\Dev\bedrock-ai-kit`
Expected: PASS with 0 violations.

- [ ] **Step 4: Commit in `bedrock-ai-kit`**

```bash
git -C c:\Dev\bedrock-ai-kit add rules/ scripts/
git -C c:\Dev\bedrock-ai-kit commit -m "feat(doctrine): synchronize s###_audit_* standards and audit tooling"
```

---

### Task 8: Deploy & Reconcile in `CollectIt` (`c:\Dev\CollectIt`)

**Files:**

- Modify: `c:\Dev\CollectIt\docs\standards/` (synced via `sync_standards`)
- Rename/Create: `c:\Dev\CollectIt\scripts\audit\s101_audit_ebay_compliance.py`
- Rename/Create: `c:\Dev\CollectIt\scripts\audit\s102_audit_listing_templates.py`
- Rename/Create: `c:\Dev\CollectIt\scripts\audit\s103_audit_variables.py`
- Modify: `c:\Dev\CollectIt\scripts\run_qa.py` / `scripts\run_audit.ps1`

- [ ] **Step 1: Sync platform standards from Bedrock**

Run: `python -m bedrock.tools.sync_standards --target c:\Dev\CollectIt --source c:\Dev\bedrock`
Expected: Mirrors updated successfully.

- [ ] **Step 2: Align domain audit scripts into `scripts/audit/`**

Ensure `scripts/audit/` exists in `CollectIt` and rename domain audit scripts to:

- `scripts/audit/s101_audit_ebay_compliance.py`
- `scripts/audit/s102_audit_listing_templates.py`
- `scripts/audit/s103_audit_variables.py`
  Remove obsolete `scripts/audits/` if present.

- [ ] **Step 3: Run platform audits and domain audits in `CollectIt`**

Run:
`python -m bedrock.tools.run_all --root c:\Dev\CollectIt`
`python c:\Dev\CollectIt\scripts\audit\s101_audit_ebay_compliance.py --root c:\Dev\CollectIt`
Expected: Clean PASS.

- [ ] **Step 4: Commit in `CollectIt`**

```bash
git -C c:\Dev\CollectIt add docs/standards/ scripts/
git -C c:\Dev\CollectIt commit -m "chore(standards): sync platform standards and standardize scripts/audit to s###_audit_*"
```

---

### Task 9: Deploy & Reconcile in `MLBTracker` (`c:\Dev\MLBTracker`)

**Files:**

- Modify: `c:\Dev\MLBTracker\docs\standards/` (synced via `sync_standards`)
- Create: `c:\Dev\MLBTracker\scripts\audit\s101_audit_stat_invariants.py`
- Modify: `c:\Dev\MLBTracker\scripts\run_qa.py` / `scripts\run_audit.ps1`

- [ ] **Step 1: Sync platform standards from Bedrock**

Run: `python -m bedrock.tools.sync_standards --target c:\Dev\MLBTracker --source c:\Dev\bedrock`
Expected: Mirrors updated successfully.

- [ ] **Step 2: Establish `scripts/audit/s101_audit_stat_invariants.py`**

Ensure `scripts/audit/` exists in `MLBTracker` and create `scripts/audit/s101_audit_stat_invariants.py` subclassing `AuditReporter` to enforce Standard S101.

- [ ] **Step 3: Run platform audits and domain audit in `MLBTracker`**

Run:
`python -m bedrock.tools.run_all --root c:\Dev\MLBTracker`
`python c:\Dev\MLBTracker\scripts\audit\s101_audit_stat_invariants.py --root c:\Dev\MLBTracker`
Expected: Clean PASS.

- [ ] **Step 4: Commit in `MLBTracker`**

```bash
git -C c:\Dev\MLBTracker add docs/standards/ scripts/
git -C c:\Dev\MLBTracker commit -m "chore(standards): sync platform standards and establish scripts/audit/s101_audit_stat_invariants.py"
```

---

### Task 10: Ecosystem Verification & Gate Sign-Off

**Files:**

- Test/Audit: All repositories (`bedrock`, `bedrock-ai-kit`, `CollectIt`, `MLBTracker`)

- [ ] **Step 1: Run full QA in Bedrock**

Run: `python scripts/run_qa.py --mode full`
Expected: All steps pass (pytest, vitest, typecheck, 15 platform audits).

- [ ] **Step 2: Run S100 audit across all three consumer repositories**

Run:
`python -m bedrock.tools.s100_audit_domain_registry --root c:\Dev\bedrock`
`python -m bedrock.tools.s100_audit_domain_registry --root c:\Dev\CollectIt`
`python -m bedrock.tools.s100_audit_domain_registry --root c:\Dev\MLBTracker`
Expected: Exit code 0 across all 3 repos.

- [ ] **Step 3: Verify git status is clean across all repositories**

Run git status across `bedrock`, `bedrock-ai-kit`, `CollectIt`, `MLBTracker`.
