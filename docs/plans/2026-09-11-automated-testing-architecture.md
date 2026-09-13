# Implementation Plan: Unified Automated Testing Architecture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a unified, transparent, and scalable automated testing architecture across `bedrock`, `MLBTracker`, and `CollectIt`, featuring a Tri-Marking taxonomy, Vitest workspace sharding, sub-30s deterministic delta execution, dead code elimination (`vulture` + `knip`), local append-only telemetry (`.artifacts/qa/history.jsonl`), Allure static reporting, token-preserving CLI orchestration (`scripts/run_qa.py`), and updated S05 test coverage standards with maintenance/evolution doctrine.

**Architecture:**
- Core platform runner `scripts/run_qa.py` acts as the single execution orchestrator across Python and Node test runners, capturing and buffering stdout to emit a single-line JSON summary and direct binary exit codes.
- Tests are tri-marked by subsystem/module, test type (`unit`, `integration`, `audit`, `e2e`), and severity (`blocker`, `critical`, `normal`, `low`).
- Vitest workspaces (`vitest.workspace.ts`) partition frontend tests by architectural domain.
- CI and local gates enforce AST dead-code elimination via `vulture` and `knip`.
- Telemetry streams locally into `.artifacts/qa/history.jsonl` with optional Allure artifact generation.
- S05 standards documents across repos are updated with precise maintenance rules, marking schemas, and rules for adapting as new features land.

**Tech Stack:** Python 3.11, Pytest, pytest-testmon, vulture, Allure (allure-pytest, allure-vitest), Node.js, Vitest (workspaces), knip, TypeScript.

**Spec:** `c:\Dev\bedrock\docs\superpowers\specs\automated-testing-architecture.md`

## Global Constraints
- Target repositories: `bedrock` (`C:\Dev\bedrock`), `MLBTracker` (`C:\Dev\MLBTracker`), and `CollectIt` (`C:\Dev\CollectIt`).
- Reusable platform logic originates in `bedrock` or `packages/bedrock-api` / `@djntechnic/bedrock-ui`.
- Direct return codes: `0` for clean pass, `1` for test/lint failure, `2` for environment error.
- Token preservation: No unbounded stdout streaming for passing runs. Single-line JSON summary for automated agent runs.
- Anti-polling invariant: Zero busy-wait polling loops (`sleep`, repetitive status calls).
- Zero broken tests ship to master (§S05).

---

## File Structure & Responsibilities

### Bedrock Platform (`C:\Dev\bedrock`)
- `scripts/run_qa.py`: Unified test and audit runner script with subprocess isolation, memory buffering, telemetry logging, and JSON reporting.
- `packages/bedrock-api/pytest.ini`: Standardized Pytest configuration with Tri-Marking taxonomy.
- `vitest.workspace.ts`: Root Vitest workspace definition sharding `@djntechnic/bedrock-ui` into component and hook projects.
- `scripts/maintenance/vulture_whitelist.py`: Whitelist for Python AST dead code analyzer.
- `knip.json`: Configuration for TypeScript and dependency dead code detection.
- `packages/bedrock-api/pyproject.toml`: Add optional test dependencies (`pytest-testmon`, `vulture`, `allure-pytest`).
- `package.json`: Add devDependencies (`knip`, `allure-vitest`).
- `.github/workflows/ci.yml`: Integrate `run_qa.py`, dead code checks, and artifact storage.
- `docs/standards/S05_Test_Coverage_Mandatory.md`: Baseline platform testing standards.

### CollectIt Domain (`C:\Dev\CollectIt`)
- `scripts/run_qa.py`: Host repository adapter or link to bedrock runner.
- `pytest.ini`: Updated with tri-marking taxonomy and module filters.
- `frontend/vitest.workspace.ts`: Frontend workspace sharding (`ui-primitives`, `domain-features`, `hooks-and-state`, `platform-contracts`).
- `scripts/maintenance/vulture_whitelist.py`: Domain-specific whitelist for CollectIt.
- `frontend/knip.json`: Knip configuration for CollectIt frontend.
- `requirements.txt`: Add `pytest-testmon`, `vulture`, `allure-pytest`.
- `frontend/package.json`: Add `knip`, `allure-vitest`.
- `docs/standards/S05_Test_Coverage_Mandatory.md`: Synchronized S05 doctrine including maintenance lifecycle.
- `.agents/skills/run-tests/SKILL.md`: Updated agent skill invoking `run_qa.py`.

### MLBTracker Domain (`C:\Dev\MLBTracker`)
- `scripts/run_qa.py`: Host repository runner.
- `pytest.ini`: Updated with tri-marking taxonomy.
- `frontend/vitest.workspace.ts`: Frontend workspace sharding.
- `scripts/maintenance/vulture_whitelist.py`: MLBTracker AST whitelist.
- `frontend/knip.json`: MLBTracker Knip configuration.
- `requirements.txt`: Add `pytest-testmon`, `vulture`, `allure-pytest`.
- `frontend/package.json`: Add `knip`, `allure-vitest`.
- `docs/standards/S05_Test_Coverage_Mandatory.md`: Synchronized S05 doctrine.
- `.agents/skills/run-tests/SKILL.md`: Updated agent skill invoking `run_qa.py`.

---

## Task Decomposition

### Task 1: Bedrock QA Orchestrator Core (`scripts/run_qa.py`)

**Files:**
- Create: `C:\Dev\bedrock\scripts\run_qa.py`
- Test: `C:\Dev\bedrock\packages\bedrock-api\tests\test_run_qa.py`

**Interfaces:**
- Consumes: CLI arguments `--mode`, `--subsystem`, `--severity`, `--type`, `--dead-code`, `--allure`, `--json`, `--verbose`.
- Produces: Buffered execution of Vitest and Pytest, JSON metric record in `.artifacts/qa/history.jsonl`, single-line summary JSON to stdout (`{"status": "pass"|"fail", "exit": 0|1, ...}`), exit code 0/1/2.

- [ ] **Step 1: Write unit tests for QA orchestrator CLI and argument parser**
```python
# packages/bedrock-api/tests/test_run_qa.py
import subprocess
import sys
from pathlib import Path

def test_run_qa_help():
    repo_root = Path(__file__).resolve().parents[3]
    script_path = repo_root / "scripts" / "run_qa.py"
    res = subprocess.run([sys.executable, str(script_path), "--help"], capture_output=True, text=True)
    assert res.returncode == 0
    assert "--mode" in res.stdout
    assert "--severity" in res.stdout
    assert "--subsystem" in res.stdout
```

- [ ] **Step 2: Run test to verify it fails**
Run: `pytest packages/bedrock-api/tests/test_run_qa.py`
Expected: FAIL (script does not exist).

- [ ] **Step 3: Implement `scripts/run_qa.py`**
Implement the orchestrator supporting:
- Argument parsing (`--mode {fast,scoped,full}`, `--subsystem`, `--severity`, `--type`, `--dead-code`, `--allure`, `--json`, `--verbose`).
- Mode-based command construction (fast uses `--testmon`, full runs all suites and audits).
- In-memory process execution with stdout/stderr capture.
- Telemetry writer appending JSON to `.artifacts/qa/history.jsonl`.
- Single-line JSON emission when `--json` is enabled.
- Exit code propagation.

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest packages/bedrock-api/tests/test_run_qa.py`
Expected: PASS.

- [ ] **Step 5: Commit changes in bedrock**
```bash
git add scripts/run_qa.py packages/bedrock-api/tests/test_run_qa.py
git commit -m "feat(qa): implement core run_qa.py orchestrator"
```

---

### Task 2: Standardize Pytest Tri-Marking Taxonomy in Bedrock

**Files:**
- Modify: `C:\Dev\bedrock\packages\bedrock-api\pytest.ini`
- Modify: `C:\Dev\bedrock\packages\bedrock-api\pyproject.toml`
- Test: `C:\Dev\bedrock\packages\bedrock-api\tests\test_markers.py`

**Interfaces:**
- Consumes: Pytest marker engine.
- Produces: Standard markers: `unit`, `integration`, `audit`, `e2e`, `blocker`, `critical`, `normal`, `low`, and `module_*`.

- [ ] **Step 1: Write test verifying standard markers are recognized without warnings**
```python
# packages/bedrock-api/tests/test_markers.py
import pytest

@pytest.mark.unit
@pytest.mark.blocker
@pytest.mark.module_auth
def test_sample_tri_marked():
    assert True
```

- [ ] **Step 2: Run test with strict markers to verify it fails on undeclared markers**
Run: `pytest packages/bedrock-api/tests/test_markers.py --strict-markers`
Expected: FAIL (unknown markers).

- [ ] **Step 3: Update `pytest.ini` and `pyproject.toml`**
Add markers definition in `packages/bedrock-api/pytest.ini`:
```ini
[pytest]
testpaths = tests
addopts = -q --tb=short --strict-markers
markers =
    unit: isolated, memory-only execution with mocked dependencies.
    integration: data-dependent tests requiring database fixtures or server lifespan.
    audit: static analysis, catalog synchronization, or codebase invariant verification.
    e2e: end-to-end user-flow or browser-simulated workflows.
    blocker: database isolation canaries, security guards, RBAC, schema integrity.
    critical: core domain calculations, persistence mutations, financial/export data.
    normal: standard business workflows, input validation, status transitions.
    low: cosmetic formatting, auxiliary metadata, optional edge cases.
    module_auth: authentication, tokens, session lifecycles, and permissions.
    module_grids: grid definitions, column metadata, and filter queries.
    module_config: application settings, dynamic config rows, and fallback resolution.
```
Add `pytest-testmon`, `vulture`, `allure-pytest` to `[project.optional-dependencies] dev` in `pyproject.toml`.

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest packages/bedrock-api/tests/test_markers.py --strict-markers`
Expected: PASS.

- [ ] **Step 5: Commit changes in bedrock**
```bash
git add packages/bedrock-api/pytest.ini packages/bedrock-api/pyproject.toml packages/bedrock-api/tests/test_markers.py
git commit -m "feat(qa): declare tri-marking taxonomy in bedrock pytest.ini"
```

---

### Task 3: Shard Bedrock Vitest Workspace & Add Allure/Knip

**Files:**
- Create: `C:\Dev\bedrock\vitest.workspace.ts`
- Modify: `C:\Dev\bedrock\package.json`
- Create: `C:\Dev\bedrock\knip.json`
- Test: Existing Vitest tests in `packages/bedrock-ui/src/**/*.test.{ts,tsx}`

**Interfaces:**
- Consumes: Vitest multi-project runner, Knip unused export analyzer.
- Produces: Partitioned test runs (`components`, `hooks`, `admin`), Knip dead code audit.

- [ ] **Step 1: Create `vitest.workspace.ts`**
```typescript
// vitest.workspace.ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./packages/bedrock-ui/vite.config.ts",
    test: {
      name: "ui-components",
      include: ["packages/bedrock-ui/src/components/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
    },
  },
  {
    extends: "./packages/bedrock-ui/vite.config.ts",
    test: {
      name: "hooks-and-utils",
      include: [
        "packages/bedrock-ui/src/hooks/**/*.test.{ts,tsx}",
        "packages/bedrock-ui/src/utils/**/*.test.{ts,tsx}",
      ],
      environment: "jsdom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
    },
  },
]);
```

- [ ] **Step 2: Configure `knip.json`**
```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["packages/bedrock-ui/src/index.ts!"],
  "project": ["packages/bedrock-ui/src/**/*.{ts,tsx}!"],
  "ignore": ["**/*.test.{ts,tsx}", "vitest.setup.ts"]
}
```

- [ ] **Step 3: Update `package.json` scripts & devDependencies**
Add `allure-vitest` and `knip` to `devDependencies`.
Add scripts:
```json
"test": "vitest run",
"test:workspace": "vitest run --workspace vitest.workspace.ts",
"audit:dead-code": "knip"
```

- [ ] **Step 4: Execute workspace tests to verify they pass**
Run: `npx vitest run --workspace vitest.workspace.ts`
Expected: PASS across all sharded projects.

- [ ] **Step 5: Commit changes in bedrock**
```bash
git add vitest.workspace.ts knip.json package.json
git commit -m "feat(qa): shard bedrock-ui vitest workspace and configure knip"
```

---

### Task 4: Python AST Dead Code Detection (`vulture`) in Bedrock

**Files:**
- Create: `C:\Dev\bedrock\scripts\maintenance\vulture_whitelist.py`
- Modify: `C:\Dev\bedrock\scripts\run_qa.py`
- Test: Verification on bedrock codebase

**Interfaces:**
- Consumes: Vulture AST parser.
- Produces: Exit code 0 if no unreferenced code found (or only whitelisted items), 1 if dead code detected.

- [ ] **Step 1: Write `vulture_whitelist.py`**
```python
# scripts/maintenance/vulture_whitelist.py
# Whitelist for dynamic FastAPI attributes, lifespan context, and Pydantic models
from bedrock.core.database import DatabaseManager
DatabaseManager.close_pool  # unused attribute
```

- [ ] **Step 2: Add `--dead-code` integration in `scripts/run_qa.py`**
In `scripts/run_qa.py`, implement execution of `vulture packages/bedrock-api scripts/maintenance/vulture_whitelist.py` and `npx knip`.

- [ ] **Step 3: Execute dead-code audit to verify clean output**
Run: `python scripts/run_qa.py --dead-code`
Expected: PASS with 0 violations.

- [ ] **Step 4: Commit changes in bedrock**
```bash
git add scripts/maintenance/vulture_whitelist.py scripts/run_qa.py
git commit -m "feat(qa): integrate vulture AST dead code detection into bedrock"
```

---

### Task 5: Bedrock S05 Testing Doctrine & Maintenance Standards

**Files:**
- Create: `C:\Dev\bedrock\docs\standards\S05_Test_Coverage_Mandatory.md`
- Test: Structural audit or markdown lint

**Interfaces:**
- Produces: The authoritative reference for testing requirements, tri-marking rules, runtime invariants, and feature maintenance lifecycle for the bedrock platform.

- [ ] **Step 1: Draft `S05_Test_Coverage_Mandatory.md`**
Define:
1. Universal Zero-Tolerance Defect Contract (Zero broken tests ship to master).
2. Tri-Marking Standards (Subsystem, Layer, Severity).
3. Runtime & Anti-Polling Invariants (Buffered execution, reactive wakeups).
4. Feature Maintenance & Evolution Guide:
   - What to update when adding a new backend module (add `module_<name>` marker in `pytest.ini`, register in `run_qa.py`).
   - What to update when adding frontend components (ensure project inclusion in `vitest.workspace.ts`, add Knip entry if public).
   - How to manage AST whitelists (add verified dynamic hooks to `vulture_whitelist.py`).
   - How to maintain isolation canaries (rules for database snapshotting).

- [ ] **Step 2: Verify document formatting and relative links**
Check file content and markdown syntax.

- [ ] **Step 3: Commit changes in bedrock**
```bash
git add docs/standards/S05_Test_Coverage_Mandatory.md
git commit -m "docs(standards): create S05 test coverage and maintenance standard in bedrock"
```

---

### Task 6: Deploy QA Orchestrator & Tri-Marking to CollectIt

**Files:**
- Create: `C:\Dev\CollectIt\scripts\run_qa.py`
- Modify: `C:\Dev\CollectIt\pytest.ini`
- Create: `C:\Dev\CollectIt\frontend\vitest.workspace.ts`
- Create: `C:\Dev\CollectIt\scripts\maintenance\vulture_whitelist.py`
- Create: `C:\Dev\CollectIt\frontend\knip.json`
- Modify: `C:\Dev\CollectIt\requirements.txt`
- Modify: `C:\Dev\CollectIt\frontend\package.json`
- Modify: `C:\Dev\CollectIt\docs\standards\S05_Test_Coverage_Mandatory.md`
- Modify: `C:\Dev\CollectIt\.agents\skills\run-tests\SKILL.md`

**Interfaces:**
- Consumes: CollectIt domain codebase, SQLite test database isolation canaries.
- Produces: Tri-marked CollectIt test suite, sharded frontend Vitest, sub-30s delta test loop via `run_qa.py --mode fast`.

- [ ] **Step 1: Install dependencies**
Add `pytest-testmon`, `vulture`, `allure-pytest` to `requirements.txt`.
Add `knip`, `allure-vitest` to `frontend/package.json`.

- [ ] **Step 2: Deploy `scripts/run_qa.py` to CollectIt**
Copy and customize `scripts/run_qa.py` to execute CollectIt's specific backend suite (`api/tests`), frontend Vitest workspace, and maintenance audits (`audit_grids.py`, `audit_config.py`, `audit_schema_names.py`, `audit_ebay_compliance.py`, `audit_targets.py`).

- [ ] **Step 3: Update `pytest.ini` with Tri-Marking markers**
Register `unit`, `integration`, `audit`, `blocker`, `critical`, `normal`, `low`, `module_listings`, `module_auth`, `module_exporter`, `module_entities`.

- [ ] **Step 4: Create `frontend/vitest.workspace.ts` and `frontend/knip.json`**
Shard frontend into `ui-primitives`, `domain-features`, `hooks-and-state`, `platform-contracts`.

- [ ] **Step 5: Create `scripts/maintenance/vulture_whitelist.py`**
Whitelist FastAPI dependency overrides and eBay CSV exporter schema models.

- [ ] **Step 6: Update `docs/standards/S05_Test_Coverage_Mandatory.md`**
Update S05 with the new Tri-Marking matrix, runtime limits, and maintenance evolution doctrine.

- [ ] **Step 7: Update `.agents/skills/run-tests/SKILL.md`**
Point skill modes (`fast`, `scoped`, `full`) to invoke `python scripts/run_qa.py --mode <mode> --json`.

- [ ] **Step 8: Execute `run_qa.py --mode fast` and verify green output**
Run: `python scripts/run_qa.py --mode fast --json`
Expected: Output returns `{"status": "pass", "exit": 0, ...}` in < 25s.

- [ ] **Step 9: Commit changes in CollectIt**
```bash
git add scripts/run_qa.py pytest.ini frontend/vitest.workspace.ts scripts/maintenance/vulture_whitelist.py frontend/knip.json requirements.txt frontend/package.json docs/standards/S05_Test_Coverage_Mandatory.md .agents/skills/run-tests/SKILL.md
git commit -m "feat(qa): implement unified testing architecture and updated S05 standard in CollectIt"
```

---

### Task 7: Deploy QA Orchestrator & Tri-Marking to MLBTracker

**Files:**
- Create: `C:\Dev\MLBTracker\scripts\run_qa.py`
- Modify: `C:\Dev\MLBTracker\pytest.ini`
- Create: `C:\Dev\MLBTracker\frontend\vitest.workspace.ts`
- Create: `C:\Dev\MLBTracker\scripts\maintenance\vulture_whitelist.py`
- Create: `C:\Dev\MLBTracker\frontend\knip.json`
- Modify: `C:\Dev\MLBTracker\requirements.txt`
- Modify: `C:\Dev\MLBTracker\frontend\package.json`
- Modify: `C:\Dev\MLBTracker\docs\standards\S05_Test_Coverage_Mandatory.md`
- Modify: `C:\Dev\MLBTracker\.agents\skills\run-tests\SKILL.md`

**Interfaces:**
- Consumes: MLBTracker domain codebase, baseball statistics pipelines, live-DB canaries.
- Produces: Tri-marked MLBTracker suite, sharded frontend Vitest workspace, sub-30s delta test loop via `run_qa.py --mode fast`.

- [ ] **Step 1: Install dependencies**
Add `pytest-testmon`, `vulture`, `allure-pytest` to `requirements.txt`.
Add `knip`, `allure-vitest` to `frontend/package.json`.

- [ ] **Step 2: Deploy `scripts/run_qa.py` to MLBTracker**
Configure to run MLBTracker's backend suite (`api/tests`), frontend Vitest workspace, and maintenance audits (`audit_grids.py`, `audit_config.py`, `audit_schema_names.py`, `audit_guidance.py`, `audit_targets.py`).

- [ ] **Step 3: Update `pytest.ini` with Tri-Marking markers**
Register `unit`, `integration`, `audit`, `blocker`, `critical`, `normal`, `low`, `module_players`, `module_stats`, `module_rankings`, `module_auth`.

- [ ] **Step 4: Create `frontend/vitest.workspace.ts` and `frontend/knip.json`**
Shard frontend into `ui-primitives`, `domain-features`, `hooks-and-state`, `platform-contracts`.

- [ ] **Step 5: Create `scripts/maintenance/vulture_whitelist.py`**
Whitelist Pandas DataFrame operations, background pipeline hooks, and FastAPI overrides.

- [ ] **Step 6: Update `docs/standards/S05_Test_Coverage_Mandatory.md`**
Update S05 with the new Tri-Marking matrix, runtime limits, and maintenance evolution doctrine.

- [ ] **Step 7: Update `.agents/skills/run-tests/SKILL.md`**
Point skill modes (`fast`, `scoped`, `full`) to invoke `python scripts/run_qa.py --mode <mode> --json`.

- [ ] **Step 8: Execute `run_qa.py --mode fast` and verify green output**
Run: `python scripts/run_qa.py --mode fast --json`
Expected: Output returns `{"status": "pass", "exit": 0, ...}` in < 25s.

- [ ] **Step 9: Commit changes in MLBTracker**
```bash
git add scripts/run_qa.py pytest.ini frontend/vitest.workspace.ts scripts/maintenance/vulture_whitelist.py frontend/knip.json requirements.txt frontend/package.json docs/standards/S05_Test_Coverage_Mandatory.md .agents/skills/run-tests/SKILL.md
git commit -m "feat(qa): implement unified testing architecture and updated S05 standard in MLBTracker"
```

---

### Task 8: CI Workflow Integration Across Repositories

**Files:**
- Modify: `C:\Dev\bedrock\.github\workflows\ci.yml`
- Modify: `C:\Dev\CollectIt\.github\workflows\ci.yml`
- Modify: `C:\Dev\MLBTracker\.github\workflows\ci.yml`

**Interfaces:**
- Consumes: GitHub Actions runner environment.
- Produces: Gated PR validation running `run_qa.py --mode full --dead-code`, uploading `.artifacts/qa/history.jsonl` and Allure reports.

- [ ] **Step 1: Update Bedrock CI workflow**
Add steps executing `scripts/run_qa.py --mode full --dead-code` and upload `.artifacts/qa/history.jsonl`.

- [ ] **Step 2: Update CollectIt CI workflow**
Update `backend-tests`, `frontend-tests`, and `consistency` jobs to integrate `scripts/run_qa.py` and enforce dead code checks.

- [ ] **Step 3: Update MLBTracker CI workflow**
Update CI jobs to integrate `scripts/run_qa.py` and enforce dead code checks.

- [ ] **Step 4: Commit CI changes in each repository**
```bash
# In each repository:
git add .github/workflows/ci.yml
git commit -m "ci(qa): integrate unified run_qa orchestrator and dead code checks"
```

---

## Maintenance & Evolution Doctrine (§S05 Appendix)

When developers or agents modify or add features to any repository in the ecosystem, the following maintenance checklist is mandatory:

### 1. Adding a New Backend Feature / Endpoint
1. **Mark the Test**:
   - Apply `@pytest.mark.unit` or `@pytest.mark.integration`.
   - Assign severity: `@pytest.mark.blocker` (security/invariants), `@pytest.mark.critical` (data mutation/calculation), or `@pytest.mark.normal`.
   - Tag with subsystem: `@pytest.mark.module_<name>`.
2. **Register New Markers**:
   - If introducing a new subsystem, register `module_<name>` in `pytest.ini`.
3. **Dead-Code Validation**:
   - If an endpoint or service is conditionally loaded or referenced dynamically, add its entry to `scripts/maintenance/vulture_whitelist.py`.
   - Run `python scripts/run_qa.py --dead-code` to confirm 0 new AST warnings.

### 2. Adding a New Frontend Component / Hook / Page
1. **Colocate and Mark Tests**:
   - Co-locate `.test.tsx` or `.test.ts`.
   - Add test metadata: `{ meta: { severity: "critical", type: "unit" } }`.
2. **Workspace Inclusion**:
   - Check `frontend/vitest.workspace.ts` to ensure the file path matches an existing project glob. If a new architectural layer is introduced (e.g. `src/workers/`), add a new project entry.
3. **Knip Export Audit**:
   - If exporting from a library or barrel, verify `npx knip` does not flag unused exports.

### 3. Modifying Database Schemas or Live-DB Invariants
1. **Canary Verification**:
   - Any test touching database materialization must run through `test_db_session` in `conftest.py`.
   - Never remove or weaken the four canaries (setup path assertion, post-swap assertion, teardown tempdir guard, mtime witness).
2. **Integration Marker**:
   - Must carry `@pytest.mark.integration` and `@pytest.mark.blocker`.

---

## Verification Plan

### Automated Tests
1. **Orchestrator Self-Test**:
   - `pytest packages/bedrock-api/tests/test_run_qa.py`
   - `python scripts/run_qa.py --help`
2. **Delta Commit Loop Speed**:
   - `python scripts/run_qa.py --mode fast --json` (Verify execution time < 30s and single-line JSON output).
3. **Dead Code Gate**:
   - `python scripts/run_qa.py --dead-code` (Verify exit code 0).
4. **Full Test Suite & Audits**:
   - `python scripts/run_qa.py --mode full` (Verify all Vitest projects, Pytest tests, and maintenance scripts pass).

### Manual Verification
- Inspect `.artifacts/qa/history.jsonl` to ensure telemetry records append cleanly with duration, status, and summary counts.
- Inspect Allure output in `.artifacts/qa/allure-results/`.
- Validate that CI check runs cleanly across GitHub Actions matrices.
