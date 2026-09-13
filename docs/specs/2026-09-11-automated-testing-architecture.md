# Unified Automated Testing Architecture Specification

**Status**: Proposed / Approved Architectural Design
**Ecosystem Scope**: `bedrock` (`C:\Dev\bedrock`), `MLBTracker` (`C:\Dev\MLBTracker`), and `CollectIt` (`C:\Dev\CollectIt`)
**Target Specification File**: `bedrock/docs/superpowers/specs/automated-testing-architecture.md`
**Date**: 2026-09-11

---

## 1. Executive Summary & Problem Statement

Across the bedrock platform and its consumer applications (`CollectIt`, `MLBTracker`), automated testing suffers from 8 core operational failure modes:
1. **All-or-Nothing Sweeps**: Monolithic test runs lack granular isolation, forcing agents to execute 1,000+ tests for single-line logic changes.
2. **Linear Runtime Degradation**: Test runtime scales linearly as new features land, without subsystem sharding or incremental isolation.
3. **Equal Severity Weighting**: Minor cosmetic edge cases fail with identical blast radius as critical invariants (e.g. SQLite live-DB canaries, auth bypasses, or catalog drift).
4. **Test Bloat & Orphaned Code**: Stale mock tests and abandoned endpoints remain indefinitely in the active test suite.
5. **Inflexible QA Controls**: Absence of suite, layer, or subsystem selector switches.
6. **Ephemeral Telemetry**: Zero runtime tracking, flakiness detection, or historical degradation tracking.
7. **Agent Token Churn**: Verbose stdout dumping and busy-wait polling loops consume context tokens and degrade agent reasoning.
8. **Fragmented Maintenance Audits**: Dozens of maintenance scripts (`audit_grids.py`, `audit_config.py`, `audit_schema_names.py`) require separate manual coordination.

This specification establishes a **unified, transparent, and scalable automated testing architecture** standard across all three repositories.

---

## 2. Granular Test Layering & Tri-Marking Taxonomy

All automated tests across backend (`pytest`) and frontend (`vitest`) must adhere to a standardized **Tri-Marking Model** spanning three orthogonal axes:

```
+-------------------------------------------------------------------------+
|                           Tri-Marking Model                             |
+------------------------------------+------------------------------------+
| Axis 1: Subsystem / Module         | listings, auth, grids, players     |
+------------------------------------+------------------------------------+
| Axis 2: Test Type / Layer          | unit, integration, audit, e2e      |
+------------------------------------+------------------------------------+
| Axis 3: Severity / Business Impact | blocker, critical, normal, low     |
+------------------------------------+------------------------------------+
```

### 2.1 Backend Pytest Markers (`pytest.ini`)
Every test is categorized along these dimensions:
```ini
[pytest]
addopts = -q --tb=short --no-header
pythonpath = .
markers =
    # Axis 1: Test Type
    unit: isolated, memory-only execution with mocked dependencies (<15ms/test).
    integration: data-dependent tests requiring seeded database fixtures or server lifespan.
    audit: static analysis, catalog synchronization, or codebase invariant verification.
    e2e: multi-step user-flow or browser-simulated workflows.

    # Axis 2: Severity / Blast Radius
    blocker: database isolation canaries, security guards, RBAC, schema integrity, zero-tolerance invariants.
    critical: core domain calculations, persistence mutations, financial/export data generation.
    normal: standard business workflows, input validation, status transitions.
    low: cosmetic formatting, auxiliary metadata, optional edge cases.

    # Axis 3: Subsystems (examples)
    module_auth: authentication, tokens, session lifecycles, and permissions.
    module_grids: grid definitions, column metadata, and filter query generators.
    module_listings: listing draft states, image pipelines, and item persistence.
    module_exporter: eBay/CSV generation, file transformations, and upload conduits.
```

### 2.2 Frontend Vitest Workspace Sharding (`frontend/vitest.workspace.ts`)
Monolithic frontend suites are partitioned into dedicated projects by layer and architectural boundary:
```typescript
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vite.config.ts",
    test: {
      name: "ui-primitives",
      include: ["src/components/ui/**/*.test.{ts,tsx}"],
      environment: "jsdom",
    },
  },
  {
    extends: "./vite.config.ts",
    test: {
      name: "domain-features",
      include: ["src/features/**/*.test.{ts,tsx}", "src/pages/**/*.test.{ts,tsx}"],
      environment: "jsdom",
    },
  },
  {
    extends: "./vite.config.ts",
    test: {
      name: "hooks-and-state",
      include: ["src/hooks/**/*.test.{ts,tsx}", "src/stores/**/*.test.{ts,tsx}"],
      environment: "jsdom",
    },
  },
  {
    extends: "./vite.config.ts",
    test: {
      name: "platform-contracts",
      include: ["src/test/contracts/**/*.test.{ts,tsx}"],
      environment: "jsdom",
    },
  },
]);
```

Frontend tests carry metadata annotations in test context:
```typescript
it("aborts when live DB canary fails", { meta: { severity: "blocker", type: "unit" } }, () => {
  expect(isCanaryActive()).toBe(true);
});
```

---

## 3. Deterministic Delta & Impact Execution

### 3.1 Sub-30s Iterative Commit Loop
During active coding iterations:
- **Frontend Delta**: `npx vitest related <changed_files> --run --reporter=dot` (leverages Vitest's module transform graph).
- **Backend Delta**: `python -m pytest --testmon -m "not integration and (blocker or critical)" -q` (uses `pytest-testmon`'s AST dependency tracker to execute only tests whose executed lines were modified).
- **Audit Deltas**: Run only file-scoped audits (e.g. `python scripts/maintenance/audit_grids.py --diff`).

### 3.2 Dead Code & Test Bloat Elimination
To prevent unreferenced code and orphaned tests from accumulating:
1. **Python AST Analysis (`vulture`)**:
   - Integrated into CI and local audit sweeps.
   - Configured via `scripts/maintenance/vulture_whitelist.py` for dynamic FastAPI dependency overrides and migration hooks.
   - Blocks PR merges if unused endpoints, dead functions, or obsolete test fixtures are detected.
2. **TypeScript / Export Pruning (`knip`)**:
   - Enforced as a mandatory blocking CI check.
   - Checks `frontend/package.json` for unused dependencies, unreferenced exports, and un-imported components.

---

## 4. Telemetry, Reporting & Token Preservation

### 4.1 Local JSON-Lines Metric Persistence (`.artifacts/qa/history.jsonl`)
Append-only telemetry recorded on every test run. Facilitates local regression analysis and flakiness tracking with zero cloud dependencies:
```json
{
  "timestamp": "2026-09-11T19:15:00Z",
  "commit": "8f3b2a1",
  "branch": "feature/qa-orchestrator",
  "mode": "fast",
  "status": "pass",
  "duration_ms": 8420,
  "summary": {
    "vitest": {"passed": 38, "failed": 0, "skipped": 0, "duration_ms": 3200},
    "pytest": {"passed": 94, "failed": 0, "skipped": 2, "duration_ms": 4850},
    "audits": {"passed": 2, "failed": 0, "duration_ms": 370}
  },
  "failures": []
}
```

### 4.2 Zero-Dependency Offline Allure Static Reporting
- `allure-pytest` and `allure-vitest` write raw event JSONs to `.artifacts/qa/allure-results/`.
- Offline static HTML bundle generated on demand via:
  ```bash
  allure generate .artifacts/qa/allure-results -o .artifacts/qa/allure-report --clean
  ```
- Serves as an interactive, visual test dashboard during PR reviews and human QA audits.

### 4.3 Agent Token Preservation & Anti-Polling Invariant
To stop agent context exhaustion and infinite polling loops:
1. **Buffered Stdout**: Test stdout/stderr is buffered in memory by the runner. Passing stdout is suppressed.
2. **Single-Line Machine Output**:
   ```json
   {"status": "pass", "exit": 0, "duration_ms": 8420, "vitest": "38 passed", "pytest": "94 passed", "audits": "2 passed", "report": ".artifacts/qa/history.jsonl"}
   ```
3. **Capped Failure Frames**: On failure, only the failing assertion frame and the last 60 lines of error logs are emitted, immediately preceding the failure JSON.
4. **Direct Binary Return Codes**: The runner directly returns status code `0` (pass) or `1` (fail).
5. **No Polling**: Background jobs rely on system message wakeup. Agents never call sleep or poll status in a loop.

---

## 5. Unified QA Orchestrator (`scripts/run_qa.py`)

A single, parameter-driven runner script placed in `scripts/run_qa.py` (and reusable across repos):

### 5.1 CLI Interface
```bash
python scripts/run_qa.py [options]

Options:
  --mode {fast,scoped,full}     Execution tier (default: fast).
  --subsystem {ui,domain,hooks,api,db,exporter,all}
                                Filter by architectural subsystem.
  --severity {blocker,critical,normal,low,all}
                                Filter by test severity marker.
  --type {unit,integration,audit,all}
                                Filter by test type.
  --dead-code                   Execute vulture + knip checks.
  --allure                      Emit Allure raw results.
  --json                        Format terminal output as single-line JSON.
  --verbose                     Print unbuffered stdout (human debugging mode).
```

### 5.2 Execution Matrix by Mode

| Mode | Scope | Trigger | Target Duration | Checks Run |
|---|---|---|---|---|
| `fast` | Delta changes only | Agent commit loop | < 20s | `vitest related`, `pytest --testmon -m "not integration and (blocker or critical)"`, delta audits |
| `scoped` | Touched subsystems | Pre-PR verification | < 60s | Full `vitest` for touched projects, full `pytest` for touched modules, affected maintenance audits |
| `full` | Whole repository | Pre-merge / CI | 2–3m | All Vitest projects, all Pytest suites, all maintenance audits, `tsc -b --noEmit`, `vulture`, `knip` |

---

## 6. Migration and Rollout Roadmap

1. **Phase 1 (Bedrock Core)**:
   - Introduce `scripts/run_qa.py` and Pytest markers into `bedrock`.
   - Configure `vitest.workspace.ts` for `@djntechnic/bedrock-ui`.
   - Add telemetry logging (`.artifacts/qa/history.jsonl`).
2. **Phase 2 (Consumer Repos - CollectIt & MLBTracker)**:
   - Deploy `scripts/run_qa.py` and updated `pytest.ini`.
   - Partition frontend tests into `vitest.workspace.ts`.
   - Update agent skills (`.agents/skills/run-tests/SKILL.md`) to route through `run_qa.py`.
3. **Phase 3 (CI Integration)**:
   - Add dead-code audits (`vulture`, `knip`) to `.github/workflows/ci.yml`.
   - Archive Allure and telemetry artifacts in GitHub Actions runs.
