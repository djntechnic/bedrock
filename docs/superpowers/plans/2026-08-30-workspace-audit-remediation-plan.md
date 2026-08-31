# Workspace Audit, Progress Assessment & Realignment Plan

**Date:** 2026-08-30  
**Scope:** Full multi-repo alignment audit across **Bedrock Platform**, **CollectIt**, and **MLBTracker** against `docs/platform_guide.md` and active implementation plans.

---

## 1. Task Alignment & Gap Matrix

| Task ID / Spec Ref | Target Stack / Repo | Status | File Targets | Action Required |
| :--- | :--- | :---: | :--- | :--- |
| **BEDROCK-SEC-001**<br>(§1 Capability Model) | `bedrock` (Backend) | **Complete** | `packages/bedrock-api/bedrock/core/migrations.py`<br>`packages/bedrock-api/bedrock/services/security_service.py` | None. Migration 005 DDL and runtime resolution verified (572 tests pass). |
| **BEDROCK-SEC-002**<br>(§2 Overrides & Tri-State) | `bedrock` (Full-Stack) | **Complete** | `packages/bedrock-ui/src/components/admin/UserOverridesDrawer.tsx`<br>`packages/bedrock-ui/src/components/admin/UserAccessProfileView.tsx` | None. Tri-state coercion (`NULL`/`1`/`0`) and visual badge indicators verified. |
| **BEDROCK-SEC-003**<br>(§3 Dynamic Nav Hierarchy) | `bedrock` (Full-Stack) | **Complete** | `packages/bedrock-ui/src/components/admin/MenuNavEditorPanel.tsx`<br>`packages/bedrock-ui/src/hooks/useNavSettings.ts`<br>`packages/bedrock-ui/src/components/navRegistry.ts` | None. `isNavItemVisible` updated with security capability checks and verified. |
| **BEDROCK-SEC-004**<br>(§4 Admin Hub Panels) | `bedrock` (Frontend) | **Complete** | `packages/bedrock-ui/src/index.ts`<br>`packages/bedrock-ui/src/components/admin/ModulesPanel.tsx`<br>`packages/bedrock-ui/src/components/admin/RoleMatrixPanel.tsx` | None. All 5 Security Hub panels exported in package root and verified. |
| **BEDROCK-SEC-005**<br>(§5 Non-blocking Route Guards) | `bedrock` (Frontend) | **Complete** | `packages/bedrock-ui/src/components/ProtectedRoute.tsx` | None. Scoped `securityLoading` evaluation strictly to routes with `action` prop. |
| **COLLECTIT-SEC-001**<br>(PR #73 Security Seed) | `CollectIt` (Backend) | **Complete** | `migrations/017_domain_security_seed.sql`<br>`api/tests/test_migration_017.py` | None. All domain modules seeded and migration tests passing (1,084 tests pass). |
| **COLLECTIT-SEC-002**<br>(PR #73 Route Protection) | `CollectIt` (Backend) | **Complete** | `api/routes/*.py` (9 routers)<br>`api/tests/test_route_security.py` | None. `dependencies=[require_permission(m, a)]` enforced across all domain endpoints. |
| **COLLECTIT-SEC-003**<br>(PR #73 Admin Hub & Nav) | `CollectIt` (Frontend) | **Complete** | `frontend/src/pages/AdminPage.tsx`<br>`frontend/src/components/navigation.ts` | None. Bedrock UI v0.9.0 integrated; CI run `33320490285` 100% green. |
| **MLBTRACKER-SEC-001**<br>(PR #392 Schema Alignment) | `MLBTracker` (Backend) | **Complete** | `migrations/067_domain_security_seed.sql`<br>`api/tests/test_migration_067.py` | None. Guarded `ALTER TABLE` capability columns across all auth tables verified. |
| **MLBTRACKER-SEC-002**<br>(PR #392 Route Protection) | `MLBTracker` (Backend) | **Complete** | `api/routes/*.py` (7 routers)<br>`api/tests/test_security_audit.py` | None. Permissions enforced across rankings, catalog, imports, and inventory. |
| **MLBTRACKER-SEC-003**<br>(PR #392 Lockstep Reinstall) | `MLBTracker` (Frontend) | **Complete** | `frontend/package.json`<br>`frontend/src/components/domain/navigation.ts` | None. Bedrock UI v0.9.0 synchronized; CI run `33320788346` 100% green. |

---

## 2. Cross-Repo Boundary & Contract Review

### A. Dual-Pin Dependency Synchronization
- **Platform Invariant (§6)**: Both backend (`requirements.txt`) and frontend (`frontend/package.json`) pins must point to the identical release tag simultaneously.
- **Verification Status**:
  - `bedrock`: Manifests and git tag synchronized at `v0.9.0` (commit `e4125a0`).
  - `CollectIt`: `audit_bedrock_pins.py` passes `[audit_bedrock_pins] OK — both pins on v0.9.0.`. Installed `bedrock-ui` version is `0.9.0`.
  - `MLBTracker`: `audit_bedrock_pins.py` passes `[audit_bedrock_pins] OK — both pins on v0.9.0.`. Installed `bedrock-ui` version is `0.9.0`.

### B. Monorepo Boundary & Separation of Concerns
- **Core Platform Invariant (§1)**: Bedrock contains zero domain logic (no cards, listings, players, teams, or pricing concepts).
- **Audit Findings**:
  - `bedrock` operates exclusively against `app_*` and `auth_*` tables.
  - Extension points (`register_health_counter`, `register_schema_objects`, `navRegistry`) are code-driven and executed eagerly at import time, strictly adhering to the **Eager-Import Rule (§4)**.
  - No domain imports or leaked dependencies exist in Bedrock.

### C. Build & Tooling Contracts
- **3 Load-Bearing Build Rules (§5)**:
  1. `vite.config.ts` excludes/inlines Bedrock appropriately for Vite/Vitest.
  2. `src/index.css` contains `@source` scanning for Tailwind v4 token resolution.
  3. Barrel imports strictly used (`@djntechnic/bedrock-ui`); no deep-path imports.

---

## 3. Subagent & Thinking Allocation Map

For future remediation passes and new feature development across the ecosystem, the following execution and reasoning model assignments are standardized:

| Workload Type | Optimal Model Tier | Thinking / Reasoning Level | Specialized Subagent Role | Rationale |
| :--- | :---: | :---: | :--- | :--- |
| **Dependency & Pin Synchronization** | `flash` / `flash_lite` | **Low** | *Release & Build Engineer* | Highly mechanical operations (lockfile regen, version bumps, CI monitoring). Low reasoning overhead. |
| **Schema Migrations & DDL Replay** | `pro` | **High** | *Database & Schema Engineer* | High blast radius. Requires careful transaction isolation, idempotency checks, and backward-compatible DDL. |
| **Async Lifecycles & API Security** | `pro` | **High** | *Backend API Security Engineer* | Multi-layered middleware execution, FastAPI dependency injection, session scopes, and 401/403/409 HTTP contracts. |
| **Frontend React Components & State** | `pro` | **Medium** | *React UI / Platform Engineer* | Component composition, memoization hooks, TanStack Query cache invalidation, and Vitest testing. |
| **Cross-Repo Documentation & Audits** | `inherit` | **Medium** | *Technical Architect / Auditor* | Cross-referencing specifications, markdown synthesis, and verification evidence reporting. |

---

## 4. Triage Log (Out-of-Scope / Pre-existing Issues)

All identified out-of-scope defects have been cataloged in `docs/backlog/out-of-scope-bugs.md` across all three repositories with explicit priority and zero immediate scope-creep:

1. **BUG-001 (P2 - MLBTracker)**: Dual-discipline synthetic player tests in `test_player_profile.py` require CI seed fixture; create localized test fixture decorator.
2. **BUG-002 (P3 - MLBTracker)**: Add auto-expiration / reaper mechanism for interrupted background sync jobs in `rankings_service.py`.
3. **BUG-003 (P3 - CollectIt)**: Add standard clipboard API mock in `setupTests.ts` to silence JSDOM console warnings.
4. **BUG-004 (P3 - Ecosystem)**: Update GitHub Actions workflow YAMLs to use latest Action releases targeting Node 24 runtime.
