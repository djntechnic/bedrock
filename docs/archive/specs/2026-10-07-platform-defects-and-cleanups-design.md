# Platform Defects & Cleanups Design Spec (Issues 160, 159, 158, 149, 148, 147, 146)

**Date:** 2026-10-07  
**Author:** Antigravity  
**Status:** Approved  
**Target:** `djntechnic/bedrock`  

## Executive Summary

This design specification details the root causes, architecture, invariants, and implementation contracts for seven defect and maintenance issues in the Bedrock platform:
1. **#146 (Backend Logging Lifespan):** `create_app` lifespan never calls `configure_backend_logging_from_db()`.
2. **#147 (QA Orchestrator Cleanup):** Dead import `s015_audit_release_notes` in `packages/bedrock-api/bedrock/tools/run_all.py`.
3. **#148 (Knip Dead-Code False Positives):** Unregistered admin barrel entry, duplicate named export in `ImageAnnotatorModal.tsx`, unpinned knip devDependency.
4. **#149 (S005 Test-Pairing False Violation):** Test files nested under `routes/` or `services/` (e.g. `tests/routes/test_vault_files_q.py`) flagged as missing paired tests.
5. **#158 (S011 CommandPalette Navigation & Guard):** `CommandPalette` navigation bypasses `requestLeave` and sources routes from `registerCommandRoutes` instead of `navRegistry`.
6. **#159 (Platform Storage Boundary Leaks):** Hardcoded `mlbtracker-*` localStorage keys in `ThemeContext.tsx`, `sidebarStore.ts`, and `commandPaletteStore.ts`.
7. **#160 (S009 Dialog/Sheet Overlays):** Hardcoded `bg-black/10` in `dialog.tsx`, `alert-dialog.tsx`, and `sheet.tsx` bypassing `--scrim` tokens.

---

## Architectural Breakdown & Root Causes

### 1. #146 — Backend Logging Lifespan
- **Origin:** `packages/bedrock-api/bedrock/core/app_factory.py:168-185`.
- **Root Cause:** When `configure_backend_logging_from_db()` was decoupled from module import in v0.12.0 (#114), `create_app()` lifespan was never updated to invoke it. As a result, consumer apps using `create_app` never load dynamic log levels or source location settings from `app_config_settings`.
- **Contract:** In `lifespan()`, immediately after `db_health.assert_database_healthy()` and before `_run_hooks(after_bootstrap, "after_bootstrap")`, invoke `configure_backend_logging_from_db()`.

### 2. #147 — QA Orchestrator Cleanup
- **Origin:** `packages/bedrock-api/bedrock/tools/run_all.py:56`.
- **Root Cause:** `s015_audit_release_notes` was imported when authoring S015, but since S015 requires a version argument (`vX.Y.Z`), it was never included in parameterless `AUDIT_MODULES`. The unused import causes vulture / dead-code warnings.
- **Contract:** Delete the unused import from `run_all.py`.

### 3. #148 — Knip Dead-Code False Positives
- **Origin:** `knip.json`, `packages/bedrock-ui/src/components/media/ImageAnnotatorModal.tsx:360`, `package.json`.
- **Root Cause:**
  - `knip.json` does not list `packages/bedrock-ui/src/components/admin/index.ts` in `entry`.
  - `ImageAnnotatorModal.tsx` exports both default and named `ImageAnnotatorModal`, while `src/index.ts` only consumes the default.
  - `knip` is missing from `package.json devDependencies`.
- **Contract:** Add admin barrel to `knip.json` entries, remove unreferenced named export `export { ImageAnnotatorModal };`, and add `"knip": "^5.45.0"` to `devDependencies`.

### 4. #149 — S005 Test-Pairing False Violations
- **Origin:** `packages/bedrock-api/bedrock/tools/s005_audit_testing.py:79-97`.
- **Root Cause:** `_check_test_pairing` checks if `path.parent.name in ("routes", "services")`. When a consumer places a test file in `api/tests/routes/test_vault.py`, `path.parent.name` is `"routes"`, causing the tool to expect a test named `test_test_vault.py`.
- **Contract:** Exclude any path where `path.name.startswith("test_")` or `"tests" in path.parts`.

### 5. #158 — S011 CommandPalette Navigation & Guard
- **Origin:** `packages/bedrock-ui/src/components/CommandPalette.tsx:227-245`.
- **Root Cause:**
  - Palette executes direct `navigate(item.to)`, bypassing `useEditSessionStore.getState().requestLeave()`, thus navigating away while dirty edits are uncommitted without triggering `UnsavedChangesDialog`.
  - Palette only reads `getCommandRoutes()`. Consumers like CollectIt that register only `navRegistry` (`registerNavItems`) have an empty command palette, violating S011 ("one nav source").
- **Contract:**
  - All navigation in `CommandPalette` calls `useEditSessionStore.getState().requestLeave(() => navigate(dest))`.
  - Sourcing routes maps `getNavItems()` into flat command routes and merges with `getCommandRoutes()` (deduplicated by `to`/`id`).

### 6. #159 — Platform Storage Boundary Leaks
- **Origin:** `ThemeContext.tsx:208-209`, `sidebarStore.ts:11`, `commandPaletteStore.ts:10-11`.
- **Root Cause:** Platform stores hardcode `mlbtracker-*` keys, leaking domain vocabulary into the domain-agnostic platform.
- **Contract:**
  - Use `bedrock-*` prefixes: `bedrock-theme`, `bedrock-custom-palettes`, `bedrock-sidebar-pinned`, `bedrock-command-recents`, `bedrock-command-pinned`.
  - Read helper checks the new key first; if missing and the legacy `mlbtracker-*` key exists, migrate value to the new key so existing user state is preserved.

### 7. #160 — S009 Dialog/Sheet Overlays
- **Origin:** `packages/bedrock-ui/src/components/ui/dialog.tsx:46`, `alert-dialog.tsx:48`, `sheet.tsx:28`.
- **Root Cause:** Overlays hardcode `bg-black/10` rather than consuming `--scrim` / `--color-scrim`.
- **Contract:**
  - Consume `bg-scrim/40` in `DialogOverlay`, `AlertDialogOverlay`, and `SheetOverlay`.
  - Ensure `--scrim` and `--color-scrim` (and alias `--color-overlay`) are defined and tested in `tokens.css`.

---

## Verification Matrix

| Issue | Target Layer | Verification Command | Expected Output |
|-------|--------------|----------------------|-----------------|
| 146 | backend | `pytest packages/bedrock-api/tests/test_app_factory.py -q` | PASS ($LASTEXITCODE -eq 0) |
| 147 | backend | `pytest packages/bedrock-api/tests/test_sync_and_run_all.py -q` | PASS ($LASTEXITCODE -eq 0) |
| 148 | tooling | `npx knip --no-progress` | Exit 0, 0 unused files/exports |
| 149 | backend | `pytest packages/bedrock-api/tests/test_audit_s005_to_s008.py -q` | PASS ($LASTEXITCODE -eq 0) |
| 158 | frontend | `npx vitest run packages/bedrock-ui/src/components/CommandPalette.test.tsx` | PASS ($LASTEXITCODE -eq 0) |
| 159 | frontend | `npx vitest run packages/bedrock-ui/src/store/storageMigration.test.ts` | PASS ($LASTEXITCODE -eq 0) |
| 160 | frontend | `npx vitest run packages/bedrock-ui/src/components/ui/dialogPrimitives.test.tsx` | PASS ($LASTEXITCODE -eq 0) |
