# Ecosystem Standards & Tooling Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize canonical standards (S001–S012) and audit tools into `bedrock`, enforce strict 1:1 standards-to-audit parity, purge legacy baggage and hardcoded exceptions via declarative `bedrock.toml` manifests, partition `scripts/audit/` from `scripts/maintenance/` across all three repos, and execute phased consumer migrations in `CollectIt` and `MLBTracker`.

**Architecture:**
1. Bedrock platform owns `docs/standards/S001`–`S012` and generic CLI tools `bedrock.tools.audit_s001` through `audit_s012`.
2. Shared reporter `_reporter.py` standardizes UX, assertions, microsecond timings, and exit codes.
3. Shared loader `_config.py` loads `bedrock.toml` with additive exemption merging.
4. Consumers synchronize read-only standards mirrors via `bedrock.tools.sync_standards` and dispatch suites via `scripts/run_audit.ps1` and `bedrock.tools.run_all`.
5. Scripts are partitioned strictly into `scripts/audit/` (blocking quality gates) and `scripts/maintenance/` (operational utilities).

**Tech Stack:** Python 3.11, FastAPI, Pydantic, pytest, PowerShell 7, GitHub Actions CI.

**Spec:** [`C:\Dev\bedrock\docs\specs\2026-09-12-ecosystem-standards-and-tooling-architecture.md`](file:///C:/Dev/bedrock/docs/specs/2026-09-12-ecosystem-standards-and-tooling-architecture.md)

## Global Constraints
- Target Repositories: `C:\Dev\bedrock`, `C:\Dev\CollectIt`, `C:\Dev\MLBTracker`.
- Python Interpreter: `.venv\Scripts\python.exe` on Windows 11 / PowerShell 7.
- Zero broken tests ship to master (§S005).
- Every standard `S###` has exactly one audit script `audit_s###.py` with 1:1 parity.
- Every tool manifest section requires an `exemptions = [...]` list (even if empty).
- Bedrock baseline exemptions apply to all consumers; consumers declare additive domain exemptions in `bedrock.toml`.
- All quality gate scripts live in `scripts/audit/`; operational tasks live in `scripts/maintenance/`.
- Lockstep dual-pin dependency governance: `requirements.txt` and `package.json` stay pinned to the identical bedrock release tag (`v0.10.0`).

---

## File Structure Plan

### Phase 1: `bedrock` (`C:\Dev\bedrock`)
- Create: `docs/standards/S001_No_Duplicate_UI_Code.md` through `S012_Dual_Pin_Platform_Governance.md`
- Create: `docs/standards/README.md`
- Create: `packages/bedrock-api/bedrock/tools/_reporter.py` (Standardized UX, timings, exit code reporter)
- Create: `packages/bedrock-api/bedrock/tools/_config.py` (Parses `bedrock.toml` with bedrock default exemptions)
- Create: `packages/bedrock-api/bedrock/tools/audit_s001_duplicates.py` (Refactored from `audit_s1_duplicates.py`)
- Create: `packages/bedrock-api/bedrock/tools/audit_s002_grids.py` (Promoted from MLBTracker 69KB engine)
- Create: `packages/bedrock-api/bedrock/tools/audit_s003_logging.py` (New AST/regex logging gate)
- Create: `packages/bedrock-api/bedrock/tools/audit_s004_config.py` (Promoted from MLBTracker 27KB engine)
- Create: `packages/bedrock-api/bedrock/tools/audit_s005_testing.py` (New structural test coverage gate)
- Create: `packages/bedrock-api/bedrock/tools/audit_s006_pr_workflow.py` (Incorporates `audit_ledger_freshness.py` & PR workflow)
- Create: `packages/bedrock-api/bedrock/tools/audit_s007_schema_catalog.py` (Promoted from `audit_schema_names.py`)
- Create: `packages/bedrock-api/bedrock/tools/audit_s008_guidance.py` (Merges `audit_guidance.py` and `check_claude_md_length.py`)
- Create: `packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py` (Promoted from `audit_design_tokens.py`)
- Create: `packages/bedrock-api/bedrock/tools/audit_s010_security.py` (New route AST security gate)
- Create: `packages/bedrock-api/bedrock/tools/audit_s011_navigation.py` (Merges `audit_navigation.py` and `audit_targets.py`)
- Create: `packages/bedrock-api/bedrock/tools/audit_s012_pins.py` (Promoted from `audit_bedrock_pins.py`)
- Create: `packages/bedrock-api/bedrock/tools/sync_standards.py` (Syncs S001-S012 into consumer repos with `--check`)
- Create: `packages/bedrock-api/bedrock/tools/run_all.py` (Runs audit_s001 through audit_s012)
- Create: `bedrock.toml` (Bedrock repo manifest)
- Create: `scripts/audit/` (Runner shims for local testing)
- Modify: `packages/bedrock-api/pyproject.toml` (Version bump to `0.10.0`, register package data)
- Create tests: `packages/bedrock-api/tests/test_audit_s*.py` and `test_config.py`

### Phase 2: `CollectIt` (`C:\Dev\CollectIt`)
- Create: `CollectIt/bedrock.toml`
- Create: `CollectIt/scripts/run_audit.ps1`
- Create: `CollectIt/scripts/audit/audit_s101_ebay_compliance.py`
- Create: `CollectIt/scripts/audit/audit_s102_listing_templates.py`
- Move/Rename: Domain standards to `docs/standards/S101_...` and `S102_...`
- Mirror: Core standards `S001`–`S012` via `sync_standards`
- Delete: Duplicated scripts from `scripts/maintenance/audit_*.py` and `check_claude_md_length.py`
- Modify: `requirements.txt` (Bump to `v0.10.0`)
- Modify: `frontend/package.json` (Bump to `v0.10.0`)
- Modify: `.github/workflows/ci.yml`, `CLAUDE.md`, `GEMINI.md`

### Phase 3: `MLBTracker` (`C:\Dev\MLBTracker`)
- Create: `MLBTracker/bedrock.toml`
- Create: `MLBTracker/scripts/run_audit.ps1`
- Create: `MLBTracker/scripts/audit/audit_s101_rankings_pipeline.py`
- Create: `MLBTracker/scripts/audit/audit_s102_ledger_transactions.py`
- Move/Rename: Domain standards to `docs/standards/S101_...` and `S102_...`
- Mirror: Core standards `S001`–`S012` via `sync_standards`
- Delete: Duplicated scripts from `scripts/maintenance/audit_*.py` and `check_claude_md_length.py`
- Modify: `requirements.txt` (Bump to `v0.10.0`)
- Modify: `frontend/package.json` (Bump to `v0.10.0`)
- Modify: `.github/workflows/ci.yml`, `CLAUDE.md`, `GEMINI.md`

---

## Phase 1 Tasks: Bedrock Canonical Core (`C:\Dev\bedrock`)

### Task 1.1: Author Platform Standards `S001` through `S012` in Bedrock

**Files:**
- Create: `C:\Dev\bedrock\docs\standards\README.md`
- Create: `C:\Dev\bedrock\docs\standards\S001_No_Duplicate_UI_Code.md`
- Create: `C:\Dev\bedrock\docs\standards\S002_All_Grids_Wired_To_Admin_Config.md`
- Create: `C:\Dev\bedrock\docs\standards\S003_Logging_Protocol.md`
- Create: `C:\Dev\bedrock\docs\standards\S004_No_Hardcoded_Config_Settings.md`
- Create: `C:\Dev\bedrock\docs\standards\S005_Test_Coverage_Mandatory.md`
- Create: `C:\Dev\bedrock\docs\standards\S006_Defect_Isolation_And_PR_Workflow.md`
- Create: `C:\Dev\bedrock\docs\standards\S007_Schema_Catalog.md`
- Create: `C:\Dev\bedrock\docs\standards\S008_Documentation_Layout_And_Naming.md`
- Create: `C:\Dev\bedrock\docs\standards\S009_Design_System.md`
- Create: `C:\Dev\bedrock\docs\standards\S010_Granular_Security_Model.md`
- Create: `C:\Dev\bedrock\docs\standards\S011_Config_Driven_Navigation.md`
- Create: `C:\Dev\bedrock\docs\standards\S012_Dual_Pin_Platform_Governance.md`

**Interfaces:**
- Consumes: Existing standards from `CollectIt/docs/standards` and `MLBTracker/docs/standards`.
- Produces: Canonical standard files with 3-digit padded numbering (`S001`–`S012`), linking to their corresponding `bedrock.tools.audit_s###` scripts.

- [ ] **Step 1: Create `C:\Dev\bedrock\docs\standards\` and write `README.md`**
Define the standards catalog table mapping S001 through S012 to their contracts and enforcement tools.

- [ ] **Step 2: Copy and renumber `S01`–`S11` from `CollectIt/docs/standards/` into `bedrock/docs/standards/S001_...` through `S011_...`**
Harmonize definitions, replace 2-digit numbers with 3-digit padded references (`§S001`–`§S011`), and remove any CollectIt/MLBTracker specific domain language from the core standards.

- [ ] **Step 3: Author `S012_Dual_Pin_Platform_Governance.md`**
Document the dual-pin lockstep invariant: `bedrock-api` and `@djntechnic/bedrock-ui` must be pinned to the identical release tag (`vX.Y.Z`), banning branches, commit SHAs, and `file:` overrides on master.

- [ ] **Step 4: Verify markdown integrity**
Check line counts, header structures, and links.

- [ ] **Step 5: Commit**
```bash
git add docs/standards/
git commit -m "docs: establish canonical platform standards S001-S012 in bedrock"
```

---

### Task 1.2: Implement `_reporter.py` (Unified Console UX & Timings)

**Files:**
- Create: `C:\Dev\bedrock\packages\bedrock-api\bedrock\tools\_reporter.py`
- Create: `C:\Dev\bedrock\packages\bedrock-api\tests\test_reporter.py`

**Interfaces:**
- Produces: `AuditReporter(audit_code: str, audit_name: str, repo_root: Path, config_file: Path)`
  - `start_check(description: str) -> CheckContext`
  - `pass_check(details: str = "")`
  - `fail_check(message: str, file_path: Path | str = None, line: int = None, hint: str = None)`
  - `finish() -> int` (returns `0` if clean, `1` if violations detected, `2` if environment error)

- [ ] **Step 1: Write failing unit tests for `AuditReporter`**
In `tests/test_reporter.py`, assert that checks record elapsed microsecond/millisecond times, format PASS and FAIL banners, track multiple violations, and return exit codes `0` and `1`.

- [ ] **Step 2: Run test to verify failure**
```bash
pytest packages/bedrock-api/tests/test_reporter.py
```

- [ ] **Step 3: Implement `AuditReporter` in `bedrock/tools/_reporter.py`**
Include ANSI color support (`_Colors`), high-precision monotonic timing (`time.perf_counter`), standardized 80-column banner layout, and structured violation rendering.

- [ ] **Step 4: Verify tests pass**
```bash
pytest packages/bedrock-api/tests/test_reporter.py
```

- [ ] **Step 5: Commit**
```bash
git add packages/bedrock-api/bedrock/tools/_reporter.py packages/bedrock-api/tests/test_reporter.py
git commit -m "feat(tools): add unified AuditReporter for consistent UX and timings"
```

---

### Task 1.3: Implement `_config.py` (Declarative `bedrock.toml` Loader)

**Files:**
- Create: `C:\Dev\bedrock\packages\bedrock-api\bedrock\tools\_config.py`
- Create: `C:\Dev\bedrock\packages\bedrock-api\tests\test_config_loader.py`
- Create: `C:\Dev\bedrock\bedrock.toml`

**Interfaces:**
- Produces: `load_bedrock_config(repo_root: Path | None = None) -> BedrockConfig`
  - Resolves repo root from `--repo-root`, `.git`, or current working directory.
  - Loads `bedrock.toml` (using Python 3.11 `tomllib`).
  - Merges `tool.bedrock.audit.<s###>.exemptions` additively with Bedrock platform baseline defaults.
  - Validates that every audit section contains an `exemptions` list.

- [ ] **Step 1: Write failing unit tests for `_config.py`**
In `tests/test_config_loader.py`, test:
- Parsing valid `bedrock.toml`.
- Merging platform baseline exemptions with domain exemptions.
- Failing with exit code `2` if `bedrock.toml` is missing or missing required sections.

- [ ] **Step 2: Run test to verify failure**
```bash
pytest packages/bedrock-api/tests/test_config_loader.py
```

- [ ] **Step 3: Implement `_config.py`**
Define typed dataclasses for `BedrockConfig`, `BedrockStandardsConfig`, `AuditS001Config`...`AuditS012Config`. Implement fallback defaults and additive list merging.

- [ ] **Step 4: Create bedrock's own `bedrock.toml` at repo root**
Populate `C:\Dev\bedrock\bedrock.toml` with default paths and empty exemptions.

- [ ] **Step 5: Verify tests pass**
```bash
pytest packages/bedrock-api/tests/test_config_loader.py
```

- [ ] **Step 6: Commit**
```bash
git add packages/bedrock-api/bedrock/tools/_config.py packages/bedrock-api/tests/test_config_loader.py bedrock.toml
git commit -m "feat(tools): implement declarative bedrock.toml manifest loader"
```

---

### Task 1.4: Implement Platform Audit Tools `audit_s001` through `audit_s004`

**Files:**
- Create: `packages/bedrock-api/bedrock/tools/audit_s001_duplicates.py`
- Create: `packages/bedrock-api/bedrock/tools/audit_s002_grids.py`
- Create: `packages/bedrock-api/bedrock/tools/audit_s003_logging.py`
- Create: `packages/bedrock-api/bedrock/tools/audit_s004_config.py`
- Create: Unit tests for each tool under `packages/bedrock-api/tests/`

**Interfaces:**
- Each tool exposes `main(argv: list[str] | None = None) -> int`.
- Reads `BedrockConfig` from `_config.py` and reports progress via `AuditReporter`.

- [ ] **Step 1: Implement `audit_s001_duplicates.py`**
Refactor existing `audit_s1_duplicates.py`: adopt `AuditReporter`, load allowlists/exemptions from `bedrock.toml` merged with `IGNORED_NAMES`.

- [ ] **Step 2: Implement `audit_s002_grids.py`**
Port MLBTracker's 69KB engine: purge hardcoded table/component lists, source `presentational_tables`, `grid_component_paths`, `dynamic_grid_ids`, and `exemptions` from `bedrock.toml`. Adopt `AuditReporter`.

- [ ] **Step 3: Implement `audit_s003_logging.py`**
Author automated AST/regex scanner: ban bare `console.*` in frontend (require `log` from `@djntechnic/bedrock-ui`); ban bare `print()` and standard `logging` in backend (require `loguru.logger`). Use `exempt_paths` and `exemptions` from `bedrock.toml`.

- [ ] **Step 4: Implement `audit_s004_config.py`**
Port MLBTracker's 27KB engine: read `app_config_enum` and `env_exemptions` from `bedrock.toml`. Validate that DB config rows match enum keys. Adopt `AuditReporter`.

- [ ] **Step 5: Write unit tests and verify**
```bash
pytest packages/bedrock-api/tests/test_audit_s001.py packages/bedrock-api/tests/test_audit_s002.py packages/bedrock-api/tests/test_audit_s003.py packages/bedrock-api/tests/test_audit_s004.py
```

- [ ] **Step 6: Commit**
```bash
git add packages/bedrock-api/bedrock/tools/audit_s001_duplicates.py packages/bedrock-api/bedrock/tools/audit_s002_grids.py packages/bedrock-api/bedrock/tools/audit_s003_logging.py packages/bedrock-api/bedrock/tools/audit_s004_config.py packages/bedrock-api/tests/
git commit -m "feat(tools): implement audit_s001 through audit_s004 with standardized UX"
```

---

### Task 1.5: Implement Platform Audit Tools `audit_s005` through `audit_s008`

**Files:**
- Create: `packages/bedrock-api/bedrock/tools/audit_s005_testing.py`
- Create: `packages/bedrock-api/bedrock/tools/audit_s006_pr_workflow.py`
- Create: `packages/bedrock-api/bedrock/tools/audit_s007_schema_catalog.py`
- Create: `packages/bedrock-api/bedrock/tools/audit_s008_guidance.py`
- Create: Unit tests for each tool under `packages/bedrock-api/tests/`

- [ ] **Step 1: Implement `audit_s005_testing.py`**
Author automated structural test gate: scan `api/routes/` and frontend feature components for paired test files; scan for committed `@pytest.mark.skip` / `test.skip`; verify test assertions exist.

- [ ] **Step 2: Implement `audit_s006_pr_workflow.py`**
Consolidate `audit_ledger_freshness.py` and PR branch validation. Verify `docs/reference/bedrock_issues_to_file.md` against GitHub API (`gh issue list`).

- [ ] **Step 3: Implement `audit_s007_schema_catalog.py`**
Promote `audit_schema_names.py`: enforce `schema_catalog.py` imports for tables/views/columns; ban bare SQL object literals; check catalog freshness. Source system table exemptions from `bedrock.toml`.

- [ ] **Step 4: Implement `audit_s008_guidance.py`**
Merge `audit_guidance.py` and `check_claude_md_length.py`: verify markdown links, path code spans, blocking CI gate claims, and enforce the ≤200 line limit on `CLAUDE.md` and `GEMINI.md`.

- [ ] **Step 5: Write unit tests and verify**
```bash
pytest packages/bedrock-api/tests/test_audit_s005.py packages/bedrock-api/tests/test_audit_s006.py packages/bedrock-api/tests/test_audit_s007.py packages/bedrock-api/tests/test_audit_s008.py
```

- [ ] **Step 6: Commit**
```bash
git add packages/bedrock-api/bedrock/tools/audit_s005_testing.py packages/bedrock-api/bedrock/tools/audit_s006_pr_workflow.py packages/bedrock-api/bedrock/tools/audit_s007_schema_catalog.py packages/bedrock-api/bedrock/tools/audit_s008_guidance.py packages/bedrock-api/tests/
git commit -m "feat(tools): implement audit_s005 through audit_s008 with standardized UX"
```

---

### Task 1.6: Implement Platform Audit Tools `audit_s009` through `audit_s012`

**Files:**
- Create: `packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py`
- Create: `packages/bedrock-api/bedrock/tools/audit_s010_security.py`
- Create: `packages/bedrock-api/bedrock/tools/audit_s011_navigation.py`
- Create: `packages/bedrock-api/bedrock/tools/audit_s012_pins.py`
- Create: Unit tests for each tool under `packages/bedrock-api/tests/`

- [ ] **Step 1: Implement `audit_s009_design_tokens.py`**
Promote `audit_design_tokens.py`: scan UI source for raw hex/rgb/hsl literals; verify token resolution through `ThemePalette`. Source palette file from `bedrock.toml`.

- [ ] **Step 2: Implement `audit_s010_security.py`**
Author automated security gate: inspect FastAPI route decorators and frontend protected route definitions to ensure every route declares `module` and `action`; enforce RBAC evaluation; ban raw role comparisons (`user.role == "admin"`).

- [ ] **Step 3: Implement `audit_s011_navigation.py`**
Merge `audit_navigation.py` and `audit_targets.py`: verify `registerNavItems()` usage, distinct `sort_order`s, and assert that all sidebar targets, `navigate()` calls, and admin grid pages resolve in `App.tsx`.

- [ ] **Step 4: Implement `audit_s012_pins.py`**
Promote `audit_bedrock_pins.py`: assert `requirements.txt` and `package.json` point to identical release tag (`vX.Y.Z`); check lockfile clean of overrides.

- [ ] **Step 5: Write unit tests and verify**
```bash
pytest packages/bedrock-api/tests/test_audit_s009.py packages/bedrock-api/tests/test_audit_s010.py packages/bedrock-api/tests/test_audit_s011.py packages/bedrock-api/tests/test_audit_s012.py
```

- [ ] **Step 6: Commit**
```bash
git add packages/bedrock-api/bedrock/tools/audit_s009_design_tokens.py packages/bedrock-api/bedrock/tools/audit_s010_security.py packages/bedrock-api/bedrock/tools/audit_s011_navigation.py packages/bedrock-api/bedrock/tools/audit_s012_pins.py packages/bedrock-api/tests/
git commit -m "feat(tools): implement audit_s009 through audit_s012 with standardized UX"
```

---

### Task 1.7: Implement `sync_standards.py` and `run_all.py`

**Files:**
- Create: `packages/bedrock-api/bedrock/tools/sync_standards.py`
- Create: `packages/bedrock-api/bedrock/tools/run_all.py`
- Create: `packages/bedrock-api/tests/test_sync_standards.py`
- Create: `packages/bedrock-api/tests/test_run_all.py`

**Interfaces:**
- `sync_standards.py`:
  - Copies or fetches `S001`–`S012` into `docs/standards/` with generated header.
  - `--check` flag: compares local consumer files against canonical source; exits `0` if identical, `1` on drift.
- `run_all.py`:
  - Dispatches `audit_s001` through `audit_s012`.
  - Emits grand total summary with overall timing and pass/fail counts.
  - Returns `0` if all pass, `1` if any fail.

- [ ] **Step 1: Write failing tests for `sync_standards.py` and `run_all.py`**
Test mirror writing, `--check` drift detection, and aggregated exit codes.

- [ ] **Step 2: Implement `sync_standards.py`**
Use `_config.py` to identify standards directory. Add generated comment header. Implement `--check` mode.

- [ ] **Step 3: Implement `run_all.py`**
Sequentially or concurrently run `audit_s001` through `audit_s012`. Print grand summary table.

- [ ] **Step 4: Verify tests pass**
```bash
pytest packages/bedrock-api/tests/test_sync_standards.py packages/bedrock-api/tests/test_run_all.py
```

- [ ] **Step 5: Commit**
```bash
git add packages/bedrock-api/bedrock/tools/sync_standards.py packages/bedrock-api/bedrock/tools/run_all.py packages/bedrock-api/tests/
git commit -m "feat(tools): implement sync_standards and run_all suite runner"
```

---

### Task 1.8: Establish Bedrock `scripts/audit/` and `scripts/maintenance/`

**Files:**
- Create: `C:\Dev\bedrock\scripts\audit\audit_s001_duplicates.py` through `audit_s012_pins.py`
- Move: `C:\Dev\bedrock\scripts\clean_branches.py` -> `C:\Dev\bedrock\scripts\maintenance\clean_branches.py`
- Move: `C:\Dev\bedrock\scripts\clean_branches.bat` -> `C:\Dev\bedrock\scripts\maintenance\clean_branches.bat`
- Create: `C:\Dev\bedrock\scripts\run_audit.ps1`

- [ ] **Step 1: Create `C:\Dev\bedrock\scripts\audit\` shims**
Each script is a 3-line forwarder to `bedrock.tools.audit_s###.main()`.

- [ ] **Step 2: Partition `scripts/maintenance/` in Bedrock**
Move `clean_branches.py` and `clean_branches.bat` into `scripts/maintenance/`.

- [ ] **Step 3: Add `C:\Dev\bedrock\scripts\run_audit.ps1`**
Implement the unified runner matching the spec.

- [ ] **Step 4: Verify execution**
```powershell
.\scripts\run_audit.ps1 -All
```

- [ ] **Step 5: Commit**
```bash
git add scripts/
git commit -m "refactor(scripts): partition scripts/audit and scripts/maintenance in bedrock"
```

---

### Task 1.9: Bump Bedrock Version to `v0.10.0`, Cut Release Tag

**Files:**
- Modify: `C:\Dev\bedrock\packages\bedrock-api\pyproject.toml` (version = "0.10.0")
- Modify: `C:\Dev\bedrock\packages\bedrock-ui\package.json` (version = "0.10.0")
- Modify: `C:\Dev\bedrock\CHANGELOG.md`

- [ ] **Step 1: Update version strings in both package manifests to `0.10.0`**
- [ ] **Step 2: Add CHANGELOG entry documenting S001-S012, bedrock.tools, and bedrock.toml**
- [ ] **Step 3: Run Bedrock's full audit and test suite**
```bash
pytest packages/bedrock-api/tests
python -m bedrock.tools.run_all
```
- [ ] **Step 4: Commit release bump**
```bash
git add packages/bedrock-api/pyproject.toml packages/bedrock-ui/package.json CHANGELOG.md
git commit -m "chore(release): prepare v0.10.0 platform release"
```
- [ ] **Step 5: Tag release `v0.10.0` and push to remote**
```bash
git tag -a v0.10.0 -m "v0.10.0 - Ecosystem standards S001-S012 and unified audit tooling"
git push origin master --tags
```

---

## Phase 2 Tasks: CollectIt Migration (`C:\Dev\CollectIt`)

### Task 2.1: Bump Bedrock Pin to `v0.10.0` in CollectIt

**Files:**
- Modify: `C:\Dev\CollectIt\requirements.txt`
- Modify: `C:\Dev\CollectIt\frontend\package.json`
- Modify: `C:\Dev\CollectIt\frontend\package-lock.json`

- [ ] **Step 1: Update `requirements.txt`**
Point `bedrock-api` to tag `v0.10.0`.
- [ ] **Step 2: Update `frontend/package.json`**
Point `@djntechnic/bedrock-ui` to tag `v0.10.0`.
- [ ] **Step 3: Regenerate lockfile and install**
```bash
cd frontend && npm install --package-lock-only --ignore-scripts
npm install --ignore-scripts
cd ..
pip install -r requirements.txt
```
- [ ] **Step 4: Verify package resolution**
```bash
python -c "import bedrock.tools.run_all; print('Bedrock tools loaded successfully')"
```
- [ ] **Step 5: Commit**
```bash
git add requirements.txt frontend/package.json frontend/package-lock.json
git commit -m "chore(deps): bump bedrock pin to v0.10.0"
```

---

### Task 2.2: Add `CollectIt/bedrock.toml` and Sync Standards `S001`–`S012`

**Files:**
- Create: `C:\Dev\CollectIt\bedrock.toml`
- Modify/Sync: `C:\Dev\CollectIt\docs\standards\S001_...` through `S012_...`
- Move/Rename: Domain standards in `CollectIt/docs/standards/`:
  - `S101_Ebay_Sanitizer_And_Vault.md`
  - `S102_Listing_Engine_Templates_And_Export.md`
- Modify: `C:\Dev\CollectIt\docs\standards\README.md`

- [ ] **Step 1: Write `CollectIt/bedrock.toml`**
Configure paths for `schema_catalog`, `frontend_src`, `app_routes`, `navigation_file`, `api_preview_bindings`, and audit exemptions.
- [ ] **Step 2: Renumber CollectIt domain standards**
Rename domain standards to `S101_...` and `S102_...`.
- [ ] **Step 3: Run `sync_standards` to populate `S001`–`S012` mirror**
```bash
python -m bedrock.tools.sync_standards
```
- [ ] **Step 4: Update `docs/standards/README.md`**
Group table into Platform Standards (S001–S012) and Domain Standards (S101–S102).
- [ ] **Step 5: Verify mirror freshness**
```bash
python -m bedrock.tools.sync_standards --check
```
- [ ] **Step 6: Commit**
```bash
git add bedrock.toml docs/standards/
git commit -m "docs(standards): sync bedrock S001-S012 and renumber domain standards S101-S102"
```

---

### Task 2.3: Partition Scripts (`scripts/audit/` vs `scripts/maintenance/`) & Remove Duplicates in CollectIt

**Files:**
- Create: `C:\Dev\CollectIt\scripts\audit\audit_s101_ebay_compliance.py`
- Create: `C:\Dev\CollectIt\scripts\audit\audit_s102_listing_templates.py`
- Delete: `C:\Dev\CollectIt\scripts\maintenance\audit_bedrock_pins.py`
- Delete: `C:\Dev\CollectIt\scripts\maintenance\audit_config.py`
- Delete: `C:\Dev\CollectIt\scripts\maintenance\audit_ebay_compliance.py`
- Delete: `C:\Dev\CollectIt\scripts\maintenance\audit_grids.py`
- Delete: `C:\Dev\CollectIt\scripts\maintenance\audit_guidance.py`
- Delete: `C:\Dev\CollectIt\scripts\maintenance\audit_navigation.py`
- Delete: `C:\Dev\CollectIt\scripts\maintenance\audit_schema_names.py`
- Delete: `C:\Dev\CollectIt\scripts\maintenance\audit_targets.py`
- Delete: `C:\Dev\CollectIt\scripts\maintenance\check_claude_md_length.py`
- Retain in `scripts/maintenance/`: `generate_ebay_specs.py`, `generate_schema_catalog.py`
- Create: `C:\Dev\CollectIt\scripts\run_audit.ps1`

- [ ] **Step 1: Create `scripts/audit/` and establish 1:1 domain audit scripts**
- Move `audit_ebay_compliance.py` -> `scripts/audit/audit_s101_ebay_compliance.py`, adopt `AuditReporter`.
- Author `scripts/audit/audit_s102_listing_templates.py` adopting `AuditReporter`.
- [ ] **Step 2: Delete duplicate platform audit scripts from `scripts/maintenance/`**
- [ ] **Step 3: Create `scripts/run_audit.ps1`**
- [ ] **Step 4: Run full audit suite via PowerShell runner**
```powershell
.\scripts\run_audit.ps1 -All
```
- [ ] **Step 5: Commit**
```bash
git add scripts/
git commit -m "refactor(scripts): establish scripts/audit vs maintenance and remove platform duplicates"
```

---

### Task 2.4: Update CollectIt CI, `CLAUDE.md`, and `GEMINI.md`

**Files:**
- Modify: `C:\Dev\CollectIt\.github\workflows\ci.yml`
- Modify: `C:\Dev\CollectIt\CLAUDE.md`
- Modify: `C:\Dev\CollectIt\GEMINI.md`

- [ ] **Step 1: Update `.github/workflows/ci.yml`**
Replace individual `python scripts/maintenance/audit_*.py` steps in the `consistency` job with `sync_standards --check` and `bedrock.tools.run_all`, followed by `scripts/audit/audit_s1*.py`.
- [ ] **Step 2: Update `CLAUDE.md` and `GEMINI.md`**
Replace maintenance script references with `.\scripts\run_audit.ps1` and `python -m bedrock.tools.*`. Ensure line count stays ≤200.
- [ ] **Step 3: Execute full local gatekeeper check**
```bash
python -m bedrock.tools.run_all
.\scripts\run_audit.ps1 -Domain
pytest -m "not integration"
```
- [ ] **Step 4: Commit**
```bash
git add .github/workflows/ci.yml CLAUDE.md GEMINI.md
git commit -m "ci: update consistency gates to use bedrock.tools and scripts/audit"
```

---

## Phase 3 Tasks: MLBTracker Migration (`C:\Dev\MLBTracker`)

### Task 3.1: Bump Bedrock Pin to `v0.10.0` in MLBTracker

**Files:**
- Modify: `C:\Dev\MLBTracker\requirements.txt`
- Modify: `C:\Dev\MLBTracker\frontend\package.json`
- Modify: `C:\Dev\MLBTracker\frontend\package-lock.json`

- [ ] **Step 1: Update `requirements.txt` to `v0.10.0`**
- [ ] **Step 2: Update `frontend/package.json` to `v0.10.0`**
- [ ] **Step 3: Regenerate lockfile and install**
```bash
cd frontend && npm install --package-lock-only --ignore-scripts
npm install --ignore-scripts
cd ..
pip install -r requirements.txt
```
- [ ] **Step 4: Verify package resolution**
```bash
python -c "import bedrock.tools.run_all; print('Bedrock tools loaded successfully')"
```
- [ ] **Step 5: Commit**
```bash
git add requirements.txt frontend/package.json frontend/package-lock.json
git commit -m "chore(deps): bump bedrock pin to v0.10.0"
```

---

### Task 3.2: Add `MLBTracker/bedrock.toml` and Sync Standards `S001`–`S012`

**Files:**
- Create: `C:\Dev\MLBTracker\bedrock.toml`
- Modify/Sync: `C:\Dev\MLBTracker\docs\standards\S001_...` through `S012_...`
- Move/Rename: Domain standards in `MLBTracker/docs/standards/`:
  - `S101_Rankings_Pipeline_And_Stat_Invariants.md`
  - `S102_Ledger_Transactions_And_Audit_Trail.md`
- Modify: `C:\Dev\MLBTracker\docs\standards\README.md`

- [ ] **Step 1: Write `MLBTracker/bedrock.toml`**
Configure paths for `schema_catalog`, `frontend_src`, `app_routes`, `navigation_file`, `api_preview_bindings`, presentational tables (`RosterTable`, `CardListTable`), and exemptions.
- [ ] **Step 2: Renumber MLBTracker domain standards**
Rename domain standards to `S101_...` and `S102_...`.
- [ ] **Step 3: Run `sync_standards` to populate `S001`–`S012` mirror**
```bash
python -m bedrock.tools.sync_standards
```
- [ ] **Step 4: Update `docs/standards/README.md`**
Group table into Platform Standards (S001–S012) and Domain Standards (S101–S102).
- [ ] **Step 5: Verify mirror freshness**
```bash
python -m bedrock.tools.sync_standards --check
```
- [ ] **Step 6: Commit**
```bash
git add bedrock.toml docs/standards/
git commit -m "docs(standards): sync bedrock S001-S012 and renumber domain standards S101-S102"
```

---

### Task 3.3: Partition Scripts (`scripts/audit/` vs `scripts/maintenance/`) & Remove Duplicates in MLBTracker

**Files:**
- Create: `C:\Dev\MLBTracker\scripts\audit\audit_s101_rankings_pipeline.py`
- Create: `C:\Dev\MLBTracker\scripts\audit\audit_s102_ledger_transactions.py`
- Delete: `C:\Dev\MLBTracker\scripts\maintenance\audit_bedrock_pins.py`
- Delete: `C:\Dev\MLBTracker\scripts\maintenance\audit_config.py`
- Delete: `C:\Dev\MLBTracker\scripts\maintenance\audit_framework_boundary.py`
- Delete: `C:\Dev\MLBTracker\scripts\maintenance\audit_grids.py`
- Delete: `C:\Dev\MLBTracker\scripts\maintenance\audit_guidance.py`
- Delete: `C:\Dev\MLBTracker\scripts\maintenance\audit_project.py`
- Delete: `C:\Dev\MLBTracker\scripts\maintenance\audit_schema_names.py`
- Delete: `C:\Dev\MLBTracker\scripts\maintenance\audit_targets.py`
- Delete: `C:\Dev\MLBTracker\scripts\maintenance\check_claude_md_length.py`
- Retain in `scripts/maintenance/`: `download_headshots.py`, `run_etl_players.py`, `validate_inventory.py`, `purge_inventory.py`, backup subsystem, operational diagnostics, `generate_schema_catalog.py`.
- Create: `C:\Dev\MLBTracker\scripts\run_audit.ps1`

- [ ] **Step 1: Create `scripts/audit/` and establish 1:1 domain audit scripts**
- Author `scripts/audit/audit_s101_rankings_pipeline.py` adopting `AuditReporter`.
- Author `scripts/audit/audit_s102_ledger_transactions.py` adopting `AuditReporter`.
- [ ] **Step 2: Delete duplicate platform audit scripts from `scripts/maintenance/`**
- [ ] **Step 3: Create `scripts/run_audit.ps1`**
- [ ] **Step 4: Run full audit suite via PowerShell runner**
```powershell
.\scripts\run_audit.ps1 -All
```
- [ ] **Step 5: Commit**
```bash
git add scripts/
git commit -m "refactor(scripts): establish scripts/audit vs maintenance and remove platform duplicates"
```

---

### Task 3.4: Update MLBTracker CI, `CLAUDE.md`, and `GEMINI.md`

**Files:**
- Modify: `C:\Dev\MLBTracker\.github\workflows\ci.yml`
- Modify: `C:\Dev\MLBTracker\CLAUDE.md`
- Modify: `C:\Dev\MLBTracker\GEMINI.md`

- [ ] **Step 1: Update `.github/workflows/ci.yml`**
Replace legacy script invocations in the `consistency` job with `sync_standards --check`, `bedrock.tools.run_all`, and `scripts/audit/audit_s1*.py`.
- [ ] **Step 2: Update `CLAUDE.md` and `GEMINI.md`**
Replace maintenance script references with `.\scripts\run_audit.ps1` and `python -m bedrock.tools.*`. Verify line count ≤200.
- [ ] **Step 3: Execute full local gatekeeper check**
```bash
python -m bedrock.tools.run_all
.\scripts\run_audit.ps1 -Domain
pytest -m "not integration"
```
- [ ] **Step 4: Commit**
```bash
git add .github/workflows/ci.yml CLAUDE.md GEMINI.md
git commit -m "ci: update consistency gates to use bedrock.tools and scripts/audit"
```

---

## Verification Plan

### Automated Platform Checks
1. **Bedrock Core**:
   ```bash
   cd C:\Dev\bedrock
   pytest packages/bedrock-api/tests
   python -m bedrock.tools.run_all
   ```
2. **CollectIt**:
   ```bash
   cd C:\Dev\CollectIt
   python -m bedrock.tools.sync_standards --check
   python -m bedrock.tools.run_all
   powershell .\scripts\run_audit.ps1 -All
   pytest -m "not integration"
   ```
3. **MLBTracker**:
   ```bash
   cd C:\Dev\MLBTracker
   python -m bedrock.tools.sync_standards --check
   python -m bedrock.tools.run_all
   powershell .\scripts\run_audit.ps1 -All
   pytest -m "not integration"
   ```

### Manual / Structural Inspection
- Verify `git status --porcelain` is clean across all three repositories.
- Verify `scripts/audit/` contains only quality gates (1:1 with standards) and `scripts/maintenance/` contains only operational utilities.
- Verify that every section in `bedrock.toml` has an `exemptions = [...]` key.
- Verify that `CLAUDE.md` and `GEMINI.md` across all three repositories are ≤ 200 lines.
