# Granular Security Model Remediation & CI Stabilization Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely remediate every specific defect (B-1 through B-9 in Bedrock, C-1 through C-8 in CollectIt, M-1 through M-11 in MLBTracker, and X-1 through X-3 cross-cutting) identified in `developer_peer_view.txt`, with discrete tasks, explicit test cases, and rigorous verification gates, ending in clean release tagging (`v0.9.0`), pin bumps, and 100% green GitHub Actions CI.

**Architecture:** 
Strict 4-stage dependency-ordered rollout:
1. **Stage 1 (Bedrock Platform Release Gate)**: Fix B-1 through B-9 in `bedrock`, eliminate all 21 `any` types, verify test suites, merge PR #62, and cut release tag `v0.9.0`.
2. **Stage 2 (CollectIt Remediation)**: Bump bedrock pin to `v0.9.0`, fix C-1 through C-8 in `CollectIt`, and verify clean install.
3. **Stage 3 (MLBTracker Remediation)**: Revert local filesystem aliases in `vite.config.ts`, bump bedrock pin to `v0.9.0`, fix M-1 through M-11 in `MLBTracker`, and verify clean install.
4. **Stage 4 (Multi-Repo Clean CI & Verification)**: Run full positive/negative permission matrices and verify 100% green status across all GitHub Actions workflows.

**Tech Stack:** Python 3.11, FastAPI, SQLite, Pydantic v2, TypeScript 5, React 18, TanStack Query v5, Tailwind CSS v4, Lucide React, Pytest, Vitest, GitHub Actions CI.

**References & Specs:**
- Spec: [`docs/superpowers/specs/2026-08-28-granular-security-model-design.md`](file:///C:/Dev/bedrock/docs/superpowers/specs/2026-08-28-granular-security-model-design.md)
- Catalog Deliverable: [`docs/superpowers/specs/module-screen-catalog.md`](file:///C:/Dev/bedrock/docs/superpowers/specs/module-screen-catalog.md)
- Peer Review Audit: [`C:/Dev/bedrock/.superpowers/sdd/2026-08-28-granular-security-model/developer_peer_view.txt`](file:///C:/Dev/bedrock/.superpowers/sdd/2026-08-28-granular-security-model/developer_peer_view.txt)
- Standards: `docs/standards/` in Bedrock, CollectIt, and MLBTracker.

---

## Complete Audit Defect Mapping Matrix

| Finding ID | Repo | Defect Summary | Target Task | Specific Test Case Built |
| :--- | :--- | :--- | :--- | :--- |
| **B-1** | `bedrock` | `useRoleMatrix` array identity triggers infinite re-render loop | Task 1.1 | `RoleMatrixPanel.test.tsx` renders and settles draft state in < 1.5s with zero worker timeouts |
| **B-2** | `bedrock` | `ModulesPanel` 404s on `/api/v1/modules` & schema mismatch | Task 1.2 | `ModulesPanel.test.tsx` tests against canonical `label`, `description`, `sort_order`, `is_core` |
| **B-3** | `bedrock` | `update_user_overrides_bulk` lacks PRAGMA guard for legacy `granted` | Task 1.3 | `test_security_service.py::test_update_user_overrides_bulk_legacy_compat` |
| **B-4** | `bedrock` | `SubItem` lacks gating fields; `CommandPalette` security-blind | Task 1.4 | `AppSidebar.test.tsx` and `CommandPalette.test.tsx` assert sub-item hiding based on capability |
| **B-5** | `bedrock` | `/users/{id}/profile` lacks self-access branch; descope §3.4 endpoints | Task 1.5 | `test_routes_security_and_nav.py::test_user_can_view_own_security_profile` |
| **B-6** | `bedrock` | Int/bool wire mismatch renders overrides as "inherit" | Task 1.3 | `UserOverridesDrawer.test.tsx` and `UserAccessProfileView.test.tsx` assert 1/0 and true/false |
| **B-7** | `bedrock` | 21 `any` casts violate CLAUDE.md | Task 1.5 | `npm run build:types` passes with zero `any` types |
| **B-8** | `bedrock` | `test_migration_005.py` applies to empty DB skipping `ADD COLUMN` | Task 1.6 | `test_migration_005.py` executes migration against pre-005 schema verifying column addition |
| **B-9** | `bedrock` | Flaky `test_role_crud_and_matrix_routes` due to `_config_cache` | Task 1.6 | `test_database_config_cache_invalidation` verifying cache reset on path swap |
| **C-1** | `CollectIt` | `App.tsx` passes `module` instead of `requiredModule` | Task 2.1 | `App.test.tsx` route test asserting unauthenticated redirect/denial on `/templates` |
| **C-2** | `CollectIt` | 5 routers lack `require_permission` (`items_bulk`, `listing_templates`, etc.) | Task 2.2 | `test_route_security.py` covering bulk items, listing templates, settings, vocab, dashboard |
| **C-3** | `CollectIt` | 3 photo-upload endpoints lack `photos:update` | Task 2.2 | `test_route_security.py::test_photo_upload_requires_update_permission` |
| **C-4** | `CollectIt` | Migration 017 over-grants member and omits dashboard / anon | Task 2.3 | `test_migration_017.py` asserting catalog §5 grants, dashboard seed, and idempotency |
| **C-5** | `CollectIt` | `navigation.test.ts` deleted security check & widened array | Task 2.3 | `navigation.test.ts` restoring security check and asserting `/templates` hidden from viewer |
| **C-6** | `CollectIt` | `conftest.py` leaks unclosed patchers in `viewer_auth` | Task 2.3 | Clean `conftest.py` fixture lifecycle with zero leaked patchers |
| **C-7** | `CollectIt` | Regrade `images.py:409` to `photos:view` and `/render` to `templates:view` | Task 2.2 | `test_route_security.py` verifying preview/render allows read-only roles |
| **C-8** | `CollectIt` | Migrate `App.tsx:230` off `requiredRole="admin"` | Task 2.1 | `App.test.tsx` verifying capability-gated routes |
| **M-1** | `MLBTracker`| `rankings.py` has no authentication / authorization dependencies | Task 3.2 | `test_security_audit.py::test_rankings_sync_and_config_auth` |
| **M-2** | `MLBTracker`| Catalog approval queue allows member self-approval | Task 3.2 | `test_security_audit.py::test_catalog_approval_requires_admin` |
| **M-3** | `MLBTracker`| 13 mutating endpoints in `collection.py`/`transactions.py` behind read gate | Task 3.3 | `test_security_audit.py::test_collection_and_transaction_mutations_require_update` |
| **M-4** | `MLBTracker`| Migration 067 fails on clean checkouts due to 038 rename sequencing | Task 3.4 | `test_migration_067.py` asserting clean application on both fresh and migrated DBs |
| **M-5** | `MLBTracker`| `/database/summary` in `admin_domain.py` shadowed by bedrock | Task 3.3 | Verify clean unshadowed route resolution |
| **M-6** | `MLBTracker`| Missing anon grants for `allowAnon` routes; member health stripped | Task 3.4 | `test_migration_067.py` asserting anon seeds for rankings, trends, health, players |
| **M-7** | `MLBTracker`| Parent nav items deleted; admin Security group lacks module tag | Task 3.4 | `navigation.test.ts` asserting `/collection`, `/transactions`, `/catalog/sets` visibility |
| **M-8** | `MLBTracker`| `UserRolesPanel.tsx` §S1 duplicate panel mounted | Task 3.4 | Remove `UserRolesPanel.tsx` and run `audit_s1_duplicates` |
| **M-9** | `MLBTracker`| `vite.config.ts` committed local relative alias | Task 3.1 | Clean `npm run build` using standard npm package dependency |
| **M-10**| `MLBTracker`| Revert regressions in `MyCollectionPage.tsx` and `PartiesPage.tsx` | Task 3.4 | Restore Pino logger and nulls-last sorting |
| **M-11**| `MLBTracker`| Update `docs/guide/api_reference.md` to reflect actual post-change state | Task 3.4 | `python -m bedrock.tools.audit_api_docs` reports 100% route documentation |
| **X-1** | All | Release-before-pin-bump sequencing & clean environment purge | Stage 1 & 4 | Verify clean `npm ci` and `pip install -r requirements.txt` against tagged `v0.9.0` |
| **X-2** | All | Multi-persona E2E test matrix across 4 personas & overrides | Task 4.1 | Automated scripts verifying Anonymous, Viewer, Member, Admin, and Overrides |
| **X-3** | All | Sign off Checkpoint 0 deliverable `module-screen-catalog.md` | Task 4.1 | Update catalog deliverable status to Approved |

---

## Detailed Task Decomposition & Execution Stages

### Stage 1: Bedrock Platform Core, UI Hub, & Release `v0.9.0`

#### Task 1.1: Fix B-1 — `useRoleMatrix` Array Identity & Infinite Re-render Loop
**Files:**
- Modify: `packages/bedrock-ui/src/hooks/useRoleMatrix.ts`
- Modify: `packages/bedrock-ui/src/components/admin/RoleMatrixPanel.tsx`
- Test: `packages/bedrock-ui/src/components/admin/RoleMatrixPanel.test.tsx`

**Defect:** `useRoleMatrix.ts:108` returns `matrixQuery.data ?? []` creating a fresh array reference on every render, triggering `RoleMatrixPanel.tsx` `useEffect(..., [matrix])` in an infinite loop that times out Vitest and hangs CI.

- [ ] **Step 1: Write test asserting component settles and terminates fast**
```tsx
// packages/bedrock-ui/src/components/admin/RoleMatrixPanel.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import RoleMatrixPanel from "./RoleMatrixPanel";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

describe("RoleMatrixPanel stability", () => {
  it("renders without infinite loop and settles draft state cleanly", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <RoleMatrixPanel />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(screen.getByText("Role Permissions Matrix")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Memoize empty matrix array and stabilize draft sync**
In `packages/bedrock-ui/src/hooks/useRoleMatrix.ts`:
```ts
const EMPTY_MATRIX: RolePermissionMatrixRow[] = [];
export function useRoleMatrix() {
  // ...
  const matrix = matrixQuery.data ?? EMPTY_MATRIX;
  return { matrix, ... };
}
```
In `packages/bedrock-ui/src/components/admin/RoleMatrixPanel.tsx`:
Synchronize draft state based on `matrixQuery.dataUpdatedAt` rather than object identity of `matrix`.

- [ ] **Step 3: Run Vitest and verify test passes in < 1.5s**
Run: `npx vitest run packages/bedrock-ui/src/components/admin/RoleMatrixPanel.test.tsx` in `C:/Dev/bedrock`
Expected: PASS with 0 hangs.

- [ ] **Step 4: Commit**
```bash
git add packages/bedrock-ui/src/hooks/useRoleMatrix.ts packages/bedrock-ui/src/components/admin/RoleMatrixPanel.tsx packages/bedrock-ui/src/components/admin/RoleMatrixPanel.test.tsx
git commit -m "fix(ui): memoize useRoleMatrix data fallback to prevent infinite re-render loop (B-1)"
```

---

#### Task 1.2: Fix B-2 — `ModulesPanel` API Endpoints & Public Wire Shape Alignment
**Files:**
- Modify: `packages/bedrock-api/bedrock/routes/modules.py`
- Modify: `packages/bedrock-ui/src/components/admin/ModulesPanel.tsx`
- Modify: `packages/bedrock-ui/src/api/routes.ts`
- Test: `packages/bedrock-ui/src/components/admin/ModulesPanel.test.tsx`
- Test: `packages/bedrock-api/tests/test_modules.py`

**Defect:** `ModulesPanel.tsx` calls `GET /api/v1/modules` (which returned 404) and expects `display_label`/`detailed_description`/`is_core: 1|0` instead of `label`/`description`/`is_core: bool`.

- [ ] **Step 1: Write integration tests for `GET /api/v1/modules` and `ModulesPanel`**
```python
# packages/bedrock-api/tests/test_modules.py
def test_list_all_modules_admin_endpoint(api_test_client, admin_headers):
    r = api_test_client.get("/api/v1/modules", headers=admin_headers)
    assert r.status_code == 200
    mods = r.json()
    assert len(mods) > 0
    assert "slug" in mods[0] and "label" in mods[0] and isinstance(mods[0]["is_core"], bool)
```

- [ ] **Step 2: Add `GET /` to `packages/bedrock-api/bedrock/routes/modules.py`**
```python
@router.get("", dependencies=[require_permission("admin", "view")])
def list_modules_admin() -> list[dict[str, Any]]:
    """Return all registered functional modules with boolean is_core."""
    return ms.list_modules_public()
```

- [ ] **Step 3: Update `ModulesPanel.tsx` interface and rendering**
Map `module.label`, `module.description`, `module.sort_order`, and `module.is_core` (boolean).

- [ ] **Step 4: Run tests and verify**
Run: `pytest packages/bedrock-api/tests/test_modules.py && npx vitest run packages/bedrock-ui/src/components/admin/ModulesPanel.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/bedrock-api/bedrock/routes/modules.py packages/bedrock-ui/src/components/admin/ModulesPanel.tsx packages/bedrock-ui/src/components/admin/ModulesPanel.test.tsx packages/bedrock-ui/src/api/routes.ts
git commit -m "fix(modules): align ModulesPanel endpoint and schema with ModuleOut public shape (B-2)"
```

---

#### Task 1.3: Fix B-3 & B-6 — Bulk Overrides PRAGMA Guard & Tri-State Serialization
**Files:**
- Modify: `packages/bedrock-api/bedrock/services/security_service.py`
- Modify: `packages/bedrock-api/bedrock/routes/security.py`
- Modify: `packages/bedrock-ui/src/components/admin/UserOverridesDrawer.tsx`
- Modify: `packages/bedrock-ui/src/components/admin/UserAccessProfileView.tsx`
- Test: `packages/bedrock-api/tests/test_security_service.py`
- Test: `packages/bedrock-api/tests/test_routes_security_and_nav.py`
- Test: `packages/bedrock-ui/src/components/admin/UserOverridesDrawer.test.tsx`

**Defect:** `update_user_overrides_bulk` crashed on legacy schemas with `granted NOT NULL` column. `get_user_overrides_list` returned integers `1`/`0`/`None` while UI checked `=== true`/`=== false`, displaying explicit force-denies as "inherit".

- [ ] **Step 1: Write tests for bulk user overrides and tri-state equality**
```python
# packages/bedrock-api/tests/test_security_service.py
def test_update_user_overrides_bulk_legacy_compat(test_db):
    ss.update_user_overrides_bulk(
        user_id=1,
        overrides=[{"module_slug": "inventory", "capabilities": {"view": True, "update": False}}],
        actor="admin",
    )
    overrides = ss.get_user_overrides_list(1)
    assert overrides["inventory"]["view"] is True
    assert overrides["inventory"]["update"] is False
```

- [ ] **Step 2: Add PRAGMA column check to `update_user_overrides_bulk` & normalize return types**
In `security_service.py`: Add table_info PRAGMA check and include `granted` column if present. Normalize output values to `bool | None`.

- [ ] **Step 3: Update `UserOverridesDrawer.tsx` and `UserAccessProfileView.tsx` equality checks**
```ts
const isGranted = val === true || val === 1;
const isDenied = val === false || val === 0;
```

- [ ] **Step 4: Run tests and verify**
Run: `pytest packages/bedrock-api/tests/test_security_service.py packages/bedrock-api/tests/test_routes_security_and_nav.py && npx vitest run packages/bedrock-ui/src/components/admin/UserOverridesDrawer.test.tsx packages/bedrock-ui/src/components/admin/UserAccessProfileView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/bedrock-api/bedrock/services/security_service.py packages/bedrock-api/bedrock/routes/security.py packages/bedrock-ui/src/components/admin/UserOverridesDrawer.tsx packages/bedrock-ui/src/components/admin/UserAccessProfileView.tsx packages/bedrock-api/tests/test_security_service.py packages/bedrock-api/tests/test_routes_security_and_nav.py
git commit -m "fix(security): add legacy column guard to bulk overrides and normalize tri-state types (B-3, B-6)"
```

---

#### Task 1.4: Fix B-4 — SubItem Navigation Security Gating & CommandPalette Security Interception
**Files:**
- Modify: `packages/bedrock-ui/src/components/navRegistry.ts`
- Modify: `packages/bedrock-ui/src/hooks/useNavSettings.ts`
- Modify: `packages/bedrock-ui/src/components/AppSidebar.tsx`
- Modify: `packages/bedrock-ui/src/components/CommandPalette.tsx`
- Test: `packages/bedrock-ui/src/components/AppSidebar.test.tsx`
- Test: `packages/bedrock-ui/src/components/CommandPalette.test.tsx`

**Defect:** `SubItem` dropped `module`, `action`, and `role`. `AppSidebar` only filtered top-level items. `CommandPalette` had zero security filtering.

- [ ] **Step 1: Write failing unit tests for sub-item and command palette gating**
```tsx
// packages/bedrock-ui/src/components/AppSidebar.test.tsx
it("hides child navigation item when action capability is denied", () => {
  // Test /transactions/record hidden when can_update=0
});
```

- [ ] **Step 2: Add `module`, `action`, `role` to `SubItem` in `navRegistry.ts` & preserve in `useNavSettings.ts`**
```ts
export interface SubItem {
  to: string;
  label: string;
  icon?: string;
  tooltip?: string;
  module?: string;
  action?: "view" | "update" | "delete" | "execute";
  role?: string;
}
```

- [ ] **Step 3: Filter children in `AppSidebar.tsx` and routes in `CommandPalette.tsx`**
Ensure `isNavItemVisible(item, security)` gates both parent and child items in the sidebar and command palette search results.

- [ ] **Step 4: Run tests and verify**
Run: `npx vitest run packages/bedrock-ui/src/components/AppSidebar.test.tsx packages/bedrock-ui/src/components/CommandPalette.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add packages/bedrock-ui/src/components/navRegistry.ts packages/bedrock-ui/src/hooks/useNavSettings.ts packages/bedrock-ui/src/components/AppSidebar.tsx packages/bedrock-ui/src/components/CommandPalette.tsx
git commit -m "fix(nav): enforce granular capability gating on sub-items and command palette routes (B-4)"
```

---

#### Task 1.5: Fix B-5 & B-7 — Self-Profile Access Branch & Removal of All 21 `any` Types
**Files:**
- Modify: `packages/bedrock-api/bedrock/routes/security.py`
- Modify: `packages/bedrock-ui/src/components/admin/MenuNavEditorPanel.tsx`
- Modify: `packages/bedrock-ui/src/components/admin/RoleMatrixPanel.tsx`
- Modify: `packages/bedrock-ui/src/hooks/useNavSettings.ts`
- Modify: `packages/bedrock-ui/src/components/navRegistry.ts`
- Test: `packages/bedrock-api/tests/test_routes_security_and_nav.py`

**Defect:** `GET /security/users/{id}/profile` required `admin:view` with no self branch, causing 403 on non-admin profile page visits. 21 `any` casts violated CLAUDE.md.

- [ ] **Step 1: Write test for non-admin self profile access**
```python
# packages/bedrock-api/tests/test_routes_security_and_nav.py
def test_user_can_view_own_security_profile(api_test_client):
    member = us.create_user(email="self_profile@example.com", password="Password123!", default_role="member")
    token = us.create_access_token(member.user_id)
    r = api_test_client.get(f"/api/v1/security/users/{member.user_id}/profile", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
```

- [ ] **Step 2: Allow self-access in `routes/security.py`**
Allow access if `current_user.user_id == user_id` OR `current_user` holds `admin` / `is_superuser`.

- [ ] **Step 3: Remove all 21 `any` types in `bedrock-ui`**
Strictly type `action?: "view" | "update" | "delete" | "execute"` and remove all `as any` casts.

- [ ] **Step 4: Run typechecks and tests**
Run: `npm run build:types && pytest packages/bedrock-api/tests/`
Expected: 0 type errors, all tests pass.

- [ ] **Step 5: Commit**
```bash
git add packages/bedrock-api/bedrock/routes/security.py packages/bedrock-ui/src/
git commit -m "fix(security): allow self profile inspection and eliminate all any casts (B-5, B-7)"
```

---

#### Task 1.6: Fix B-8, B-9 & Stage 1 Release Gate — PR #62 Merge & Tag `v0.9.0`
**Files:**
- Modify: `packages/bedrock-api/tests/test_migration_005.py`
- Modify: `packages/bedrock-api/bedrock/core/database.py` (invalidate `_config_cache` on `sqlite_path` swap)
- Modify: `packages/bedrock-api/pyproject.toml`
- Modify: `packages/bedrock-ui/package.json`
- Modify: `package.json`

**Defect:** `test_migration_005.py` applied to empty DB skipping `ADD COLUMN`. Flaky 401 in `test_role_crud_and_matrix_routes` caused by stale `_config_cache`.

- [ ] **Step 1: Write upgrade test in `test_migration_005.py` from pre-005 schema**
Initialize SQLite DB with baseline tables without 005 columns, execute migration 005 SQL, and assert column presence.

- [ ] **Step 2: Invalidate `_config_cache` in `database.py` on path change**
Ensure config cache is cleared when `sqlite_path` is swapped by test fixtures.

- [ ] **Step 3: Run full platform test suite**
Run: `pytest packages/bedrock-api/tests/ && npm run test && npm run build && npm run build:types` in `C:/Dev/bedrock`
Expected: 569/569 pytest pass, all vitest pass, 0 tsc errors.

- [ ] **Step 4: Push to PR #62, merge into master, and tag `v0.9.0`**
```bash
git push origin feature/granular-security-model
gh pr checks 62 --watch
git checkout master && git pull origin master
git merge feature/granular-security-model --ff-only
git push origin master
git tag v0.9.0 -m "Release v0.9.0: Granular Security Model & Dynamic Navigation"
git push origin v0.9.0
```

---

### Stage 2: CollectIt Downstream Remediation

#### Task 2.1: Bump Bedrock Pin to `v0.9.0` & Fix C-1, C-8 `<ProtectedRoute>` Prop Regression
**Files:**
- Modify: `C:/Dev/CollectIt/requirements.txt` (bump to `v0.9.0`)
- Modify: `C:/Dev/CollectIt/frontend/package.json` (bump to `v0.9.0`)
- Modify: `C:/Dev/CollectIt/frontend/src/App.tsx:210-240`
- Test: `C:/Dev/CollectIt/frontend/src/App.test.tsx`

**Defect (C-1, C-8):** `App.tsx` passed `module="templates"` instead of `requiredModule="templates"`, opening `/templates` and `/libraries` unauthenticated.

- [ ] **Step 1: Bump pins, run clean `pip install` and `npm install`**
```bash
cd C:/Dev/CollectIt
# Update requirements.txt to @v0.9.0
# Update frontend/package.json to @djntechnic/bedrock-ui#v0.9.0
pip install -r requirements.txt
cd frontend && npm install
```

- [ ] **Step 2: Write route-level render test for `<ProtectedRoute>`**
```tsx
// C:/Dev/CollectIt/frontend/src/App.test.tsx
it("blocks unauthenticated access to /templates with requiredModule", () => {
  // Assert unauthorized redirect to /login
});
```

- [ ] **Step 3: Fix prop names in `CollectIt/frontend/src/App.tsx`**
Replace `module="templates"` with `requiredModule="templates"` and `module="libraries"` with `requiredModule="libraries"`.

- [ ] **Step 4: Run tests and verify**
Run: `npm run test:run && npm run build` in `C:/Dev/CollectIt/frontend`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add requirements.txt frontend/package.json frontend/package-lock.json frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "fix(security): bump bedrock to v0.9.0 and fix ProtectedRoute requiredModule prop (C-1, C-8)"
```

---

#### Task 2.2: Fix C-2, C-3, C-7 — Router Protections, Photo Upload Security, & Permission Regrading
**Files:**
- Modify: `C:/Dev/CollectIt/api/routes/items_bulk.py`
- Modify: `C:/Dev/CollectIt/api/routes/listing_templates.py`
- Modify: `C:/Dev/CollectIt/api/routes/settings.py`
- Modify: `C:/Dev/CollectIt/api/routes/vocabularies.py`
- Modify: `C:/Dev/CollectIt/api/routes/dashboard.py`
- Modify: `C:/Dev/CollectIt/api/routes/items.py`
- Modify: `C:/Dev/CollectIt/api/routes/images.py`
- Modify: `C:/Dev/CollectIt/api/routes/templates.py`
- Test: `C:/Dev/CollectIt/api/tests/test_route_security.py`

**Defect (C-2, C-3, C-7):** 5 routers lacked `require_permission`. 3 photo upload endpoints were unguarded. `images.py:409` and `templates.py:83` were misgraded.

- [ ] **Step 1: Write integration tests covering all 5 routers and upload endpoints**
```python
# C:/Dev/CollectIt/api/tests/test_route_security.py
@pytest.mark.asyncio
async def test_items_bulk_requires_update_permission(async_client: AsyncClient, viewer_headers):
    r = await async_client.post("/api/v1/listings/items/bulk", json={}, headers=viewer_headers)
    assert r.status_code == 403

@pytest.mark.asyncio
async def test_photo_upload_requires_update_permission(async_client: AsyncClient, viewer_headers):
    r = await async_client.post("/api/v1/listings/images/bulk", json={}, headers=viewer_headers)
    assert r.status_code == 403
```

- [ ] **Step 2: Add `require_permission` dependencies across all endpoints**
- `items_bulk.py`: `require_permission("listings", "update")` on bulk mutations.
- `listing_templates.py`: `require_permission("templates", "view")` on GET, `update` on POST/PUT, `delete` on DELETE.
- `settings.py`: `require_permission("admin", "update")` on PUT /settings.
- `vocabularies.py`: `require_permission("listings", "update")` on `/learn` and `/forget`.
- `dashboard.py`: `require_permission("dashboard", "view")`.
- `items.py` & `images.py`: `require_permission("photos", "update")` on upload/attachment routes; regrade `images.py:409` to `photos:view`.
- `templates.py:83`: Regrade `/render` to `templates:view` (previewing templates is a view action).

- [ ] **Step 3: Run pytest suite**
Run: `pytest api/tests/test_route_security.py -v` in `C:/Dev/CollectIt`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add api/routes/ api/tests/test_route_security.py
git commit -m "fix(security): enforce permissions across CollectIt routers and secure uploads (C-2, C-3, C-7)"
```

---

#### Task 2.3: Fix C-4, C-5, C-6 — Migration 017 Scope Alignment & Conftest Patcher Leak Fix
**Files:**
- Modify: `C:/Dev/CollectIt/migrations/017_domain_security_seed.sql`
- Modify: `C:/Dev/CollectIt/frontend/src/components/navigation.test.ts`
- Modify: `C:/Dev/CollectIt/api/tests/test_migration_017.py`
- Modify: `C:/Dev/CollectIt/api/tests/conftest.py`

**Defect (C-4, C-5, C-6):** Migration 017 over-granted delete on listings to members and omitted dashboard/anon seeds. `navigation.test.ts` widened visible array. `conftest.py` leaked unclosed patchers.

- [ ] **Step 1: Correct `017_domain_security_seed.sql` to align with catalog §5**
- `member`: `listings` (1,1,0,1 — view/update/execute, NO delete), `photos` (1,1,1,1), `vault` (1,0,0,1), `export` (1,0,0,1), `dashboard` (1,0,0,0).
- `viewer`: `listings` (1,0,0,0), `photos` (1,0,0,0), `vault` (1,0,0,0), `export` (1,0,0,0), `dashboard` (1,0,0,0).
- `anon`: `dashboard` (1,0,0,0).
- `admin`: all permissions on all modules.

- [ ] **Step 2: Clean up `conftest.py` patchers and restore `navigation.test.ts` assertions**
Fix `conftest.py` `viewer_auth` fixture to stop all patchers upon teardown. Restore `isNavItemVisible` security assertion in `navigation.test.ts` verifying `/templates` is hidden from viewers.

- [ ] **Step 3: Run full backend and frontend test suites in CollectIt**
Run: `pytest api/tests/ && npm run test:run` in `C:/Dev/CollectIt`
Expected: 100% PASS

- [ ] **Step 4: Commit**
```bash
git add migrations/017_domain_security_seed.sql api/tests/ frontend/src/components/navigation.test.ts
git commit -m "fix(security): align Migration 017 with catalog spec and fix conftest patcher leak (C-4, C-5, C-6)"
```

---

### Stage 3: MLBTracker Downstream Remediation

#### Task 3.1: Revert Local Vite Aliases & Bump Bedrock Pin to `v0.9.0`
**Files:**
- Modify: `C:/Dev/MLBTracker/frontend/vite.config.ts`
- Modify: `C:/Dev/MLBTracker/requirements.txt` (bump to `v0.9.0`)
- Modify: `C:/Dev/MLBTracker/frontend/package.json` (bump to `v0.9.0`)

**Defect (M-9):** `frontend/vite.config.ts` had local alias pointing to `../../bedrock/...`.

- [ ] **Step 1: Revert `vite.config.ts` alias and update package dependencies**
Remove local relative alias from `vite.config.ts`. Bump `requirements.txt` and `package.json` to `v0.9.0`.

- [ ] **Step 2: Clean install**
```bash
cd C:/Dev/MLBTracker
pip install -r requirements.txt
cd frontend && npm install
```

- [ ] **Step 3: Verify build**
Run: `npm run build` in `C:/Dev/MLBTracker/frontend`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add frontend/vite.config.ts requirements.txt frontend/package.json frontend/package-lock.json
git commit -m "fix(build): revert local bedrock alias in vite.config.ts and pin v0.9.0 (M-9)"
```

---

#### Task 3.2: Fix M-1 & M-2 — `rankings.py` Authentication & Catalog Approval Restriction
**Files:**
- Modify: `C:/Dev/MLBTracker/api/routes/rankings.py`
- Modify: `C:/Dev/MLBTracker/api/routes/catalog.py`
- Test: `C:/Dev/MLBTracker/api/tests/test_security_audit.py`

**Defect (M-1, M-2):** `rankings.py` lacked authentication (sync triggers & config writers open to anonymous). `catalog.py:84` approval endpoint allowed members to approve submissions.

- [ ] **Step 1: Write integration tests for rankings auth and catalog approval restriction**
```python
# C:/Dev/MLBTracker/api/tests/test_security_audit.py
def test_rankings_sync_requires_admin_execute(client, member_token, anon_client):
    assert anon_client.post("/api/v1/rankings/sync/trigger").status_code in (401, 403)
    assert client.post("/api/v1/rankings/sync/trigger", headers={"Authorization": f"Bearer {member_token}"}).status_code == 403

def test_catalog_approval_requires_admin(client, member_token):
    assert client.post("/api/v1/catalog/sets/1/approve", headers={"Authorization": f"Bearer {member_token}"}).status_code == 403
```

- [ ] **Step 2: Apply `require_permission` in `rankings.py` & restrict `catalog.py` approval**
- `rankings.py`: `require_permission("rankings", "view", allow_anon=True)` on GET, `require_permission("admin", "execute")` on sync triggers, `require_permission("admin", "update")` on config writers.
- `catalog.py`: Set approval route to `require_permission("admin", "update")`.

- [ ] **Step 3: Run pytest suite**
Run: `pytest api/tests/test_security_audit.py -v` in `C:/Dev/MLBTracker`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add api/routes/rankings.py api/routes/catalog.py api/tests/test_security_audit.py
git commit -m "fix(security): secure rankings endpoints and restrict catalog approvals to admin (M-1, M-2)"
```

---

#### Task 3.3: Fix M-3 & M-5 — Mutating Endpoint Write Gates & Shadowed Database Route
**Files:**
- Modify: `C:/Dev/MLBTracker/api/routes/collection.py`
- Modify: `C:/Dev/MLBTracker/api/routes/transactions.py`
- Modify: `C:/Dev/MLBTracker/api/routes/admin_domain.py`
- Modify: `C:/Dev/MLBTracker/api/main.py`
- Test: `C:/Dev/MLBTracker/api/tests/test_security_audit.py`

**Defect (M-3, M-5):** 13 mutating endpoints in `collection.py`/`transactions.py` only had `inventory:view`. `/database/summary` in `admin_domain.py` was shadowed by bedrock's `admin_platform.py`.

- [ ] **Step 1: Write integration tests for per-endpoint update and delete gates**
Verify that a user with `inventory:view=1` but `inventory:update=0` receives 403 on `/api/v1/transactions` POST/PATCH and `inventory:delete=0` receives 403 on DELETE.

- [ ] **Step 2: Add fine-grained `require_permission` across all 13 mutating routes**
- `collection.py`: `require_permission("inventory", "update")` on add/edit/grade; `require_permission("inventory", "delete")` on remove.
- `transactions.py`: `require_permission("inventory", "update")` on record/update transaction; `require_permission("inventory", "delete")` on void/delete.
- `admin_domain.py`: Remove redundant shadowed `/database/summary` route.

- [ ] **Step 3: Run tests and verify**
Run: `pytest api/tests/test_security_audit.py -v`
Expected: PASS

- [ ] **Step 4: Commit**
```bash
git add api/routes/collection.py api/routes/transactions.py api/routes/admin_domain.py api/tests/test_security_audit.py
git commit -m "fix(security): enforce update/delete permissions across collection and transaction routes (M-3, M-5)"
```

---

#### Task 3.4: Fix M-4, M-6, M-7, M-8, M-10, M-11 — Migration 067 DDL Ordering, Anon Seeds, S1 Twin Removal & Regression Reverts
**Files:**
- Modify: `C:/Dev/MLBTracker/migrations/067_domain_security_seed.sql`
- Modify: `C:/Dev/MLBTracker/frontend/src/pages/AdminPage.tsx`
- Modify: `C:/Dev/MLBTracker/frontend/src/components/domain/navigation.ts`
- Remove: `C:/Dev/MLBTracker/frontend/src/components/admin/UserRolesPanel.tsx`
- Modify: `C:/Dev/MLBTracker/frontend/src/pages/MyCollectionPage.tsx` (revert logger to Pino)
- Modify: `C:/Dev/MLBTracker/frontend/src/pages/PartiesPage.tsx` (restore nulls-last sort)
- Modify: `C:/Dev/MLBTracker/docs/guide/api_reference.md`
- Modify: `C:/Dev/MLBTracker/api/tests/test_migration_067.py`

**Defect (M-4, M-6, M-7, M-8, M-10, M-11):** Migration 067 failed on clean checkouts due to 038 rename sequencing. Anon grants missing. Parent nav items deleted. Duplicate `UserRolesPanel.tsx` mounted (§S1 violation). Logger and sort regressions introduced.

- [ ] **Step 1: Update Migration 067 with safety DDL checks & seed anon capabilities**
In `067_domain_security_seed.sql`: Add idempotent column creation checks (`can_view`, `can_update`, `can_delete`, `can_execute`) if running on legacy schemas. Seed `anon` role with `dashboard`, `leaderboards`, `rankings`, `trends`, `players`, `health`.

- [ ] **Step 2: Remove `UserRolesPanel.tsx` and clean up `AdminPage.tsx`**
Remove duplicate `UserRolesPanel.tsx` and ensure `AdminPage.tsx` uses only `@djntechnic/bedrock-ui`'s `UsersPanel` and `RoleMatrixPanel`.

- [ ] **Step 3: Restore `/collection`, `/transactions`, `/catalog/sets` in `navigation.ts`**
Tag parent and child items with appropriate `module` and `action: "view"` properties.

- [ ] **Step 4: Revert regressions in `MyCollectionPage.tsx` and `PartiesPage.tsx` & update API docs**
Restore Pino logger in `MyCollectionPage.tsx` and nulls-last sort branch in `PartiesPage.tsx`. Run `python -m bedrock.tools.audit_api_docs` to update `docs/guide/api_reference.md`.

- [ ] **Step 5: Run full MLBTracker test suite and S1/S7 audits**
Run: `pytest api/tests/ -v && npm test && python -m bedrock.tools.audit_s1_duplicates && python scripts/maintenance/audit_schema_names.py`
Expected: 100% PASS

- [ ] **Step 6: Commit**
```bash
git add migrations/067_domain_security_seed.sql frontend/src/pages/AdminPage.tsx frontend/src/components/domain/navigation.ts frontend/src/pages/MyCollectionPage.tsx frontend/src/pages/PartiesPage.tsx docs/guide/api_reference.md api/tests/test_migration_067.py
git rm frontend/src/components/admin/UserRolesPanel.tsx
git commit -m "fix(security): resolve Migration 067 sequencing, seed anon grants, remove S1 twin, and revert regressions (M-4, M-6, M-7, M-8, M-10, M-11)"
```

---

### Stage 4: Multi-Repo Verification & GitHub Actions CI

#### Task 4.1: Clean Multi-Repo CI Validation & Sign-Off Gate (X-1, X-2, X-3)
**Files:**
- Modify: `docs/superpowers/specs/module-screen-catalog.md` (Update Status: Approved)
- Execute: `pytest packages/bedrock-api/tests/` in `bedrock`
- Execute: `npm run test` & `npm run build` in `bedrock`
- Execute: `pytest api/tests/` & `npm run test:run` in `CollectIt`
- Execute: `pytest api/tests/` & `npm run test` in `MLBTracker`
- Execute: `python -m bedrock.tools.audit_s1_duplicates` in consumers
- Execute: `python scripts/maintenance/audit_schema_names.py` in consumers

- [ ] **Step 1: Run full automated multi-persona positive/negative test suites**
Run: `python scripts/test_multipersona_collectit.py` and `python scripts/test_multipersona_mlbtracker.py`
Expected: `[SUCCESS] ALL PERSONAS VALIDATED WITH 0 ERRORS`

- [ ] **Step 2: Push branches to GitHub and watch GitHub Actions CI**
```bash
cd C:/Dev/bedrock && git push origin feature/granular-security-model
cd C:/Dev/CollectIt && git push origin feature/granular-security-model
cd C:/Dev/MLBTracker && git push origin feature/granular-security-model
```
Watch checks:
```bash
gh pr checks 62
gh pr checks 73
gh pr checks 392
```
Expected: All GitHub Actions jobs report **PASS (Green)**.

- [ ] **Step 3: Update `module-screen-catalog.md` status to Approved**
Update header status to `Status: Approved & Validated`. Commit documentation update.
