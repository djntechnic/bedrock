# MLBTracker PR #392 CI Failure Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve failing CI checks on MLBTracker PR #392 (`feature/granular-security-model`), fixing the frontend `ProtectedRoute` anonymous access stall in `@djntechnic/bedrock-ui` and the backend `auth_user_module_overrides.can_view` schema absence in clean container CI runs. The entire plan is ONLY completed when all GitHub Actions CI gates pass green on GitHub.

**Architecture:** Scope `@tanstack/react-query` permission loading in `ProtectedRoute.tsx` strictly to routes specifying granular actions (`action?: ActionType`). Add idempotent, guarded schema migration statements to `migrations/067_domain_security_seed.sql` ensuring all `auth_*` capability and audit columns are materialized across both fresh container checkouts and localized databases.

**Tech Stack:** TypeScript, React 18, React Router v6, TanStack Query, Vitest, Python 3.11, FastAPI, SQLite, Pytest, GitHub Actions CI.

**Spec:** `docs/superpowers/specs/2026-08-28-granular-security-model-design.md`

## Global Constraints
- Bedrock Platform version pinned to `v0.9.0` across `pyproject.toml`, `package.json`, `requirements.txt`, and downstream dependencies.
- Zero TypeScript compiler errors (`tsc -b --noEmit`).
- All 107 Vitest suites (1,362 tests) in MLBTracker frontend must pass 100%.
- Full Pytest suite (1,280+ tests) in MLBTracker backend must pass 100% on clean CI checkouts without a pre-existing `data/mlbtracker.db`.
- Strictly follow Conventional Commits format (`fix(security): ...`, `feat(security): ...`).
- **Reporting Invariant**: At the conclusion of every task, write a comprehensive markdown report (`task-X-report.md`) detailing changes made, test output, and verification results to `.superpowers/sdd/2026-08-30-mlbtracker-pr392-ci-remediation/`.
- **Completion Invariant**: This plan CANNOT be claimed or marked as complete until all GitHub Actions CI checks on PR #392 have finished with `status: success`.

---

### Task 1: Fix Route Guard Security Loading Scope in Bedrock Platform

**Agent Assignment:** Senior Frontend Engineer (`Bedrock UI / React`)  
**Repository:** `C:/Dev/bedrock`  
**Deliverable Report:** `.superpowers/sdd/2026-08-30-mlbtracker-pr392-ci-remediation/task-1-report.md`

**Files:**
- Modify: `packages/bedrock-ui/src/components/ProtectedRoute.tsx:55-70`
- Modify: `packages/bedrock-ui/src/components/ProtectedRoute.test.tsx:55-80`

**Interfaces:**
- Consumes: `useAuth()`, `useModules()`, `useSecurity()` from `packages/bedrock-ui/src/hooks/`
- Produces: `<ProtectedRoute />` component that gates on `securityLoading` *only* when `action` is specified, allowing anonymous and public module routes to render immediately.

- [ ] **Step 1: Write failing test in Bedrock UI for anonymous route with pending security query**

In `packages/bedrock-ui/src/components/ProtectedRoute.test.tsx`:
```tsx
it("renders immediately when allowAnon and requiredModule are provided without waiting for security query", () => {
  renderAt(
    "/public-view",
    <ProtectedRoute allowAnon requiredModule="dashboard">
      <div>PUBLIC DASHBOARD</div>
    </ProtectedRoute>,
  );
  expect(screen.getByText("PUBLIC DASHBOARD")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails if security loading is mocked as pending**

Run in `C:/Dev/bedrock`:
```bash
npx vitest run packages/bedrock-ui/src/components/ProtectedRoute.test.tsx
```

- [ ] **Step 3: Update `ProtectedRoute.tsx` to conditionally gate on `securityLoading` only when `action` is defined**

In `packages/bedrock-ui/src/components/ProtectedRoute.tsx`:
```tsx
  if (requiredModule && !isAdmin) {
    if (modulesLoading) return null;
    if (!hasModule(requiredModule)) {
      return <ModuleDisabled reason="module" required={requiredModule} />;
    }
    if (action) {
      if (securityLoading) return null;
      if (!can(requiredModule, action)) {
        return <ModuleDisabled reason="role" required={`${requiredModule}:${action}`} />;
      }
    }
  }
```

- [ ] **Step 4: Run Bedrock UI test suite and build**

Run in `C:/Dev/bedrock`:
```bash
npm test && npm run build && npm run build:types
```
Expected: 34 test files pass (297 tests passed), 0 TypeScript errors.

- [ ] **Step 5: Commit, Push, and Update `v0.9.0` Tag on Bedrock**

```bash
git add packages/bedrock-ui/src/components/ProtectedRoute.tsx packages/bedrock-ui/src/components/ProtectedRoute.test.tsx
git commit -m "fix(security): scope securityLoading gate strictly to routes specifying actions"
git push origin master
git tag -fa v0.9.0 -m "Release v0.9.0: Granular security model and navigation system"
git push origin v0.9.0 --force
```

- [ ] **Step 6: Generate Task 1 Completion Report**

Write report to `C:/Dev/bedrock/.superpowers/sdd/2026-08-30-mlbtracker-pr392-ci-remediation/task-1-report.md` summarizing code modifications, Vitest output, package build logs, and tag push confirmation.

---

### Task 2: Align Auth Overrides & Capability Columns in MLBTracker Migration 067

**Agent Assignment:** Senior Database & Backend Engineer (`MLBTracker Backend`)  
**Repository:** `C:/Dev/MLBTracker`  
**Deliverable Report:** `.superpowers/sdd/2026-08-30-mlbtracker-pr392-ci-remediation/task-2-report.md`

**Files:**
- Modify: `migrations/067_domain_security_seed.sql:1-35`
- Test: `api/tests/test_migration_067.py`
- Test: `api/tests/test_migration_baseline_stamps.py`

**Interfaces:**
- Consumes: SQLite schema migrations runner `_execute_statement` from `bedrock.core.migrations`
- Produces: Full materialization of capability columns (`can_view`, `can_update`, `can_delete`, `can_execute`) and audit columns on `auth_user_module_overrides`, `auth_roles`, `auth_modules`, `auth_user_roles`, and `auth_role_modules` regardless of legacy database state.

- [ ] **Step 1: Write unit test asserting all columns exist on `auth_user_module_overrides`**

In `api/tests/test_migration_067.py`:
```python
def test_migration_067_ensures_overrides_table_has_capability_columns():
    cols = db.query("PRAGMA table_info(auth_user_module_overrides)")
    col_names = cols["name"].tolist()
    for required in ["can_view", "can_update", "can_delete", "can_execute", "created_at", "created_by", "modified_at", "modified_by"]:
        assert required in col_names, f"Missing required column {required} on auth_user_module_overrides"
```

- [ ] **Step 2: Add guarded ALTER TABLE statements to `migrations/067_domain_security_seed.sql`**

In `migrations/067_domain_security_seed.sql`:
```sql
-- Migration 067: Domain Security Seed
-- Seeds auth_modules and auth_role_modules

-- 1. Ensure capability and audit columns exist across all auth tables post-rename
ALTER TABLE auth_role_modules ADD COLUMN can_view INTEGER NOT NULL DEFAULT 1;
ALTER TABLE auth_role_modules ADD COLUMN can_update INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auth_role_modules ADD COLUMN can_delete INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auth_role_modules ADD COLUMN can_execute INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auth_role_modules ADD COLUMN created_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE auth_role_modules ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System';
ALTER TABLE auth_role_modules ADD COLUMN modified_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE auth_role_modules ADD COLUMN modified_by TEXT NOT NULL DEFAULT 'System';

ALTER TABLE auth_user_module_overrides ADD COLUMN can_view INTEGER;
ALTER TABLE auth_user_module_overrides ADD COLUMN can_update INTEGER;
ALTER TABLE auth_user_module_overrides ADD COLUMN can_delete INTEGER;
ALTER TABLE auth_user_module_overrides ADD COLUMN can_execute INTEGER;
ALTER TABLE auth_user_module_overrides ADD COLUMN created_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE auth_user_module_overrides ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System';
ALTER TABLE auth_user_module_overrides ADD COLUMN modified_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE auth_user_module_overrides ADD COLUMN modified_by TEXT NOT NULL DEFAULT 'System';

ALTER TABLE auth_roles ADD COLUMN description TEXT;
ALTER TABLE auth_roles ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System';
ALTER TABLE auth_roles ADD COLUMN modified_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE auth_roles ADD COLUMN modified_by TEXT NOT NULL DEFAULT 'System';

ALTER TABLE auth_modules ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System';
ALTER TABLE auth_modules ADD COLUMN modified_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE auth_modules ADD COLUMN modified_by TEXT NOT NULL DEFAULT 'System';

ALTER TABLE auth_user_roles ADD COLUMN created_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE auth_user_roles ADD COLUMN created_by TEXT NOT NULL DEFAULT 'System';
ALTER TABLE auth_user_roles ADD COLUMN modified_at TEXT NOT NULL DEFAULT '1970-01-01 00:00:00';
ALTER TABLE auth_user_roles ADD COLUMN modified_by TEXT NOT NULL DEFAULT 'System';

CREATE TABLE IF NOT EXISTS app_nav_item_settings (
    nav_setting_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nav_key             TEXT    NOT NULL UNIQUE,
    parent_key          TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    label_override      TEXT,
    icon_override       TEXT,
    tooltip_override    TEXT,
    is_hidden_override  INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    created_by          TEXT    NOT NULL DEFAULT 'System',
    modified_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    modified_by         TEXT    NOT NULL DEFAULT 'System'
);
```

- [ ] **Step 3: Run migration tests and verify clean replay**

Run in `C:/Dev/MLBTracker`:
```bash
pytest api/tests/test_migration_067.py api/tests/test_migration_baseline_stamps.py -v
```
Expected: 25 passed.

- [ ] **Step 4: Commit changes to MLBTracker**

```bash
git add migrations/067_domain_security_seed.sql api/tests/test_migration_067.py
git commit -m "fix(security): ensure capability and audit columns exist on auth_user_module_overrides in migration 067"
```

- [ ] **Step 5: Generate Task 2 Completion Report**

Write report to `C:/Dev/MLBTracker/.superpowers/sdd/2026-08-30-mlbtracker-pr392-ci-remediation/task-2-report.md` summarizing SQL migration updates, schema verification output, and test pass logs.

---

### Task 3: Package Reinstallation, Clean DB Simulation & Test Execution

**Agent Assignment:** Full-Stack Verification & CI Engineer (`MLBTracker`)  
**Repository:** `C:/Dev/MLBTracker`  
**Deliverable Report:** `.superpowers/sdd/2026-08-30-mlbtracker-pr392-ci-remediation/task-3-report.md`

**Files:**
- Modify: `frontend/package-lock.json`
- Test: `frontend/src/components/ProtectedRoute.test.tsx`
- Test: `api/tests/test_modules.py`, `api/tests/test_security_audit.py`, `api/tests/test_subject_service.py`, `api/tests/test_transaction_service.py`

**Interfaces:**
- Consumes: `@djntechnic/bedrock-ui#v0.9.0` release tag from GitHub
- Produces: Complete passing test suite on both frontend (Vitest) and backend (Pytest).

- [ ] **Step 1: Pull updated Bedrock UI package into MLBTracker frontend**

Run in `C:/Dev/MLBTracker/frontend`:
```bash
npm install github:djntechnic/bedrock#v0.9.0 --force
```

- [ ] **Step 2: Run frontend test suite and type check**

Run in `C:/Dev/MLBTracker/frontend`:
```bash
npx vitest run src/components/ProtectedRoute.test.tsx
npm run test:run
npx tsc -b --noEmit
```
Expected: 107 test files pass (1,362 tests passed, 0 failures), 0 TypeScript errors.

- [ ] **Step 3: Run backend Pytest suite with clean container simulation**

Run in `C:/Dev/MLBTracker`:
```bash
pytest api/tests/test_modules.py api/tests/test_security_audit.py api/tests/test_subject_service.py api/tests/test_transaction_service.py -v
```
Expected: All tests pass with 0 errors (no 500s or missing column errors).

- [ ] **Step 4: Run full backend Pytest suite**

Run in `C:/Dev/MLBTracker`:
```bash
pytest api/tests/
```
Expected: 1,280+ tests pass.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore(deps): update @djntechnic/bedrock-ui to v0.9.0 with ProtectedRoute fix"
```

- [ ] **Step 6: Generate Task 3 Completion Report**

Write report to `C:/Dev/MLBTracker/.superpowers/sdd/2026-08-30-mlbtracker-pr392-ci-remediation/task-3-report.md` detailing frontend and backend test metrics, dependency tree verification, and clean container simulation results.

---

### Task 4: Push to Feature Branch & Live CI Verification

**Agent Assignment:** Release & CI Workflow Engineer  
**Repository:** `C:/Dev/MLBTracker`  
**Deliverable Report:** `.superpowers/sdd/2026-08-30-mlbtracker-pr392-ci-remediation/task-4-report.md`

**Files:**
- Remote: `djntechnic/MLBTracker` PR #392 (`feature/granular-security-model`)

**Interfaces:**
- Consumes: GitHub Actions CI workflow `ci.yml`
- Produces: Fully green PR #392 CI run across all validation jobs.

- [ ] **Step 1: Push commits to GitHub origin**

Run in `C:/Dev/MLBTracker`:
```bash
git push origin feature/granular-security-model
```

- [ ] **Step 2: Monitor GitHub Actions CI run**

Run in `C:/Dev/MLBTracker`:
```bash
gh run list --limit 3
```
Wait for and inspect the initiated workflow run:
```bash
gh run watch <run_id>
```

- [ ] **Step 3: Verify all CI jobs complete with success**

Verify status:
- `Classify changed paths`: Pass
- `Repo consistency (guidance + pins)`: Pass
- `Grid standard audit`: Pass
- `Frontend compilation type check (tsc -b)`: Pass
- `Frontend tests (Vitest)`: Pass
- `Backend tests (Pytest)`: Pass

- [ ] **Step 4: Generate Task 4 Final Verification Report**

Write report to `C:/Dev/MLBTracker/.superpowers/sdd/2026-08-30-mlbtracker-pr392-ci-remediation/task-4-report.md` with:
- PR #392 GitHub URL and head SHA
- Execution log of GitHub Actions workflow showing green checkmarks across all jobs
- Summary confirming that both Bedrock platform and MLBTracker downstream are in full compliance with the granular security design specification.
