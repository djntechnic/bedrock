# Platform Remediation & Stability Specification (`bedrock v0.10.0`)

- **Author:** Antigravity (Pair Programming with djntechnic)
- **Date:** 2026-09-13
- **Status:** Approved for Implementation
- **Target Release:** `bedrock v0.10.0`
- **Impacted Repositories:** `djntechnic/bedrock`, `djntechnic/CollectIt`, `djntechnic/MLBTracker`

---

## 1. Executive Summary

This specification consolidates and resolves all 5 open issues in `djntechnic/bedrock` along with 2 cross-repository dependencies identified in `djntechnic/CollectIt` and `djntechnic/MLBTracker`:

1. **Bedrock #74**: `load_dotenv(override=True)` silently overwrites injected database environment variables (`SQLITE_DB_PATH`).
2. **CollectIt #60**: Concurrent SQLite operations in test suites flake on `database is locked` due to absent / low default busy timeout in `DatabaseManager`.
3. **Bedrock #51**: Path resolution produces mixed separators on Windows developer environments, and test assertions hardcode consumer domain strings (`data/mlbtracker.db`).
4. **Bedrock #50**: 11 platform-level configuration keys read via `db.get_config()` are never seeded in `app_config_settings`, rendering them invisible to host admin consoles.
5. **Bedrock #55**: `<GridHeader>`'s Discard action on bulk drafts is destructive, unconfirmed, and cannot be intercepted or replaced by consumers.
6. **Bedrock #49**: The core `<DataGrid>` component lacks a dedicated render-level test harness in `bedrock-ui`, forcing consumer repositories (MLBTracker) to maintain 588 lines of platform engine tests.
7. **MLBTracker #387**: MLBTracker carries 15 in-tree platform-destined files and orphaned tests that belong upstream in Bedrock.

Following implementation, Bedrock will be released as `v0.10.0`, followed by issue creation in CollectIt and MLBTracker to track their respective adoption and local clean-up.

---

## 2. Technical Architecture & Component Changes

### 2.1 Backend Foundations (`packages/bedrock-api`)

#### 2.1.1 Environment Precedence & Injected DB Protection (Bedrock #74)
- **Problem:** `config.py`, `logging.py`, and `oauth_service.py` invoke `load_dotenv(..., override=True)`. This discards explicit caller injections such as `SQLITE_DB_PATH=/tmp/scratch.db`, causing alternate-DB boots or tests to silently execute against production databases.
- **Solution:**
  - Before invoking `load_dotenv`, snapshot critical database environment variables:
    - `SQLITE_DB_PATH`
    - `DATABASE_URL`
    - `BEDROCK_DATA_DIR`
  - After `load_dotenv(..., override=True)`, if any of the above variables were explicitly present in `os.environ` prior to the call and were overwritten by `.env`, restore the pre-existing environment variable and log an informational notice:
    ```python
    logger.info("Preserving explicitly injected environment override: %s=%s", key, original_val)
    ```
  - This preserves developer convenience for local `.env` authoring while guaranteeing that explicit process-level overrides are never silently clobbered.

#### 2.1.2 SQLite Concurrency & Busy Timeout (CollectIt #60)
- **Problem:** Multi-threaded test runs (e.g., CollectIt's `test_reserve_seq`) contend on SQLite file locks. Because Python's `sqlite3.connect` defaults to a 5.0-second timeout and does not configure `PRAGMA busy_timeout`, worker threads fail with `sqlite3.OperationalError: database is locked`.
- **Solution:**
  - In `DatabaseManager._create_sqlite_connection`:
    1. Read `SQLITE_BUSY_TIMEOUT` from environment, defaulting to `30.0` seconds.
    2. Pass `timeout=timeout_sec` to `sqlite3.connect()`.
    3. Execute `PRAGMA busy_timeout = <ms>;` upon connection creation alongside `PRAGMA foreign_keys = ON;`.
  - Transaction connections created via `transaction()` inherit this configuration, eliminating writer lock flakes across all consumer concurrency suites.

#### 2.1.3 Path Normalization & Domain Sanitization (Bedrock #51)
- **Problem:** `resolve_app_path(value)` joins `APP_ROOT` with relative paths without normalization. On Windows, this creates mixed-separator paths (`C:\repo/data/app.db`). `test_paths.py` also hardcodes `data/mlbtracker.db`.
- **Solution:**
  - In `bedrock/core/paths.py`:
    ```python
    def resolve_app_path(value: str | None, *default_parts: str) -> str:
        if not value:
            return os.path.normpath(app_path(*default_parts))
        return os.path.normpath(value if os.path.isabs(value) else app_path(value))
    ```
  - In `tests/test_paths.py`:
    - Replace `"data/mlbtracker.db"` with `"data/test.db"`.
    - Use `os.path.normpath` in test assertions to ensure platform-independent comparisons.

#### 2.1.4 Platform Config Keys Seeding (Bedrock #50)
- **Problem:** 11 keys read by `bedrock-api` are absent from `app_config_settings` seeds:
  - `rate_limit_login` (`10/minute`, system)
  - `rate_limit_register` (`5/minute`, system)
  - `rate_limit_oauth_callback` (`10/minute`, system)
  - `rate_limit_password_reset` (`5/hour`, system)
  - `mail_from_address` (`""`, system)
  - `mail_from_name` (`""`, system)
  - `system_base_url` (`""`, system)
  - `seo_allow_indexing` (`"true"`, system)
  - `diagnostics_retention_days` (`"60"`, diagnostics)
  - `diagnostics_schedule_enabled` (`"false"`, diagnostics)
  - `diagnostics_schedule_time` (`"02:00"`, diagnostics)
- **Solution:**
  - Update `bedrock/schema/baseline.sql` with `INSERT OR IGNORE INTO app_config_settings` for all 11 keys.
  - Create migration `packages/bedrock-api/bedrock/schema/migrations/008_seed_platform_config_keys.sql` applying identical seeds for existing installations.
  - Document that `jwt_secret` is deliberately excluded from `app_config_settings` because secrets must never reside in editable UI configuration.

---

## 2.2 Frontend Grid Engine & UI (`packages/bedrock-ui`)

#### 2.2.1 Guarded Discard & Custom Interception (Bedrock #55)
- **Problem:** `<GridHeader>` renders "Discard unsaved edits" as a plain button calling `discardBulkDrafts` directly. Supplying `draftsOverride` forces this button to appear without confirmation or interception, risking immediate loss of hundreds of staged draft rows.
- **Solution:**
  - Extend `DataGridProps` and `GridHeaderProps`:
    ```typescript
    onBulkDiscard?: () => void | Promise<void>;
    confirmBulkDiscard?: boolean;
    onBeforeBulkDiscard?: () => boolean | Promise<boolean>;
    ```
  - Default `confirmBulkDiscard` to `true`.
  - When the user clicks Discard:
    - If `confirmBulkDiscard` is true: display an `<AlertDialog>` prompting the user to confirm discarding unsaved edits.
    - If confirmed (and `onBeforeBulkDiscard` passes): execute `onBulkDiscard ?? discardBulkDrafts`.
    - If `confirmBulkDiscard` is explicitly false: bypass the dialog and execute immediately.

#### 2.2.2 DataGrid Render-Level Test Harness & Test Migration (Bedrock #49 / MLBTracker #387)
- **Problem:** Bedrock's unit suite only tested grid utility helpers and the `gridRef` handle, leaving `<DataGrid>`'s rendering, selection, pagination, and bulk wiring unverified upstream. MLBTracker maintained a 588-line test file (`DataGrid.test.tsx`) asserting platform behavior.
- **Solution:**
  - Create `packages/bedrock-ui/src/test/gridMocks.ts` and `renderWithGridProviders` in `packages/bedrock-ui/src/test/test-utils.tsx`.
  - Port all engine test cases from MLBTracker to `packages/bedrock-ui/src/components/grids/DataGrid.test.tsx`:
    1. Runtime enforcement that `rowKeyColumn` is present.
    2. Selection position (`start` vs `end`) and selection cap (`selectionOptions.max`).
    3. Pagination controls and density toggle.
    4. Bulk mode discard confirmation dialog and custom `onBulkDiscard` delegation.
  - Establish complete upstream verification for `<DataGrid>`.

---

## 3. Verification Plan

### Automated Tests
1. **Backend (`packages/bedrock-api`):**
   ```bash
   pytest packages/bedrock-api/tests/test_paths.py
   pytest packages/bedrock-api/tests/test_admin_config_service.py
   pytest packages/bedrock-api/tests/
   python -m bedrock.tools.run_all
   ```
2. **Frontend (`packages/bedrock-ui`):**
   ```bash
   cd packages/bedrock-ui
   npm run test:run
   npm run build
   ```

---

## 4. Post-Release Consumer Action Items

Following the merge of this PR in `bedrock` and tag release (`v0.10.0`), open dedicated GitHub tracking issues in consumer repos:

### CollectIt Issue
- **Title:** `[Adoption] Adopt bedrock v0.10.0: resolve entry 13 (GridHeader discard) and entry 15 (load_dotenv override)`
- **Scope:**
  - Bump `@djntechnic/bedrock-ui` and `bedrock-api` to `v0.10.0`.
  - Remove workaround from `useBulkDrafts.ts` and rely on Bedrock's native confirmation dialog or custom `onBulkDiscard`.
  - Verify `test_reserve_seq.py` passes reliably under high thread contention with SQLite busy timeout.
  - Delete entries 13 and 15 from `docs/reference/bedrock_issues_to_file.md`.

### MLBTracker Issue
- **Title:** `[Adoption] Adopt bedrock v0.10.0: retire in-tree DataGrid tests and adopt config seeds`
- **Scope:**
  - Bump `@djntechnic/bedrock-ui` and `bedrock-api` to `v0.10.0`.
  - Delete `frontend/src/components/grids/DataGrid.test.tsx` and `EditableCell.test.tsx` (now fully asserted in Bedrock).
  - Clean up boundary tracking in `audit_framework_boundary.py` (closing #387).
  - Delete entries 1, 2, 3, 4, 5, 6, 7, 8, 9 from `docs/reference/bedrock_issues_to_file.md`.
