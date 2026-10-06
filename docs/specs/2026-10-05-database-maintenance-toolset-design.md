# Architectural Design Spec: Unified Database Maintenance, Diagnostics & Admin Toolset

**Date:** 2026-10-05  
**Status:** Approved  
**Related Issues:** Bedrock #128, MLBTracker #448, MLBTracker #449  
**Platform Compliance:** Bedrock Standards §S001–§S015  

---

## 1. Executive Summary & Intent

Domain applications across the Bedrock ecosystem (MLBTracker, CollectIt, and future services) currently maintain duplicated, divergent, or legacy maintenance scripts and UI implementations for database backups, restorations, integrity verification, diagnostics execution, and file monitoring.

In particular:
- **CLI & Backend**: Applications hand-roll one-off scripts (`backup_database.py`, `restore_from_backup.py`, `run_diagnostics.py`, `watch_db.py`). MLBTracker #449 noted that the CLI diagnostic runner broke due to `sys.path` resolution after ecosystem standardization, and Bedrock #128 called for standardizing database snapshotting and backup rotation.
- **Frontend & Admin UI**: MLBTracker maintains a monolithic 123KB `AdminPage.tsx` (~2,800 lines) containing hand-rolled panels for Diagnostics, Audits, and Database inspection. Conversely, CollectIt lacks diagnostics and database backup capabilities entirely because `@djntechnic/bedrock-ui` never packaged reusable components for them.

This specification unifies the entire stack into Bedrock:
1. **Core Platform Engines (`bedrock.core`)**: Decoupled, reusable Python services for hot online backups (`sqlite3.backup`), safe dual-mode restoration, standalone diagnostics execution with run ledger persistence, and live SQLite database watching.
2. **Unified CLI Suite (`bedrock.tools.db`)**: A single CLI entrypoint (`python -m bedrock.tools.db <subcommand>`) driven by `bedrock.toml` configuration and explicit CLI flags.
3. **Backend Admin Routes (`bedrock.routes.database` & `diagnostics`)**: Standardized API endpoints for triggering backups, listing backup files, running integrity checks, and executing diagnostic test suites.
4. **Reusable Frontend Components (`@djntechnic/bedrock-ui`)**: First-class `<DiagnosticsPanel />`, `<AuditPanel />`, and `<DatabaseMaintenancePanel />` components with live polling, reporting, and export capabilities.
5. **Hermetic Automated Tests**: Full migration and expansion of automated tests across backend (`packages/bedrock-api/tests`) and frontend (`packages/bedrock-ui/src/components/admin/__tests__`).

---

## 2. Platform Architectural Invariants

The design adheres strictly to Bedrock Platform Standards:
- **§S001 (No Duplicate UI / Code):** Reusable admin panels and maintenance logic live strictly in `@djntechnic/bedrock-ui` and `bedrock-api`. Consumer applications compose these components and never hand-roll parallel implementations.
- **§S003 (Logging Protocol):** All backend logging uses Loguru; frontend uses Pino. Raw `print()` and `console.*` statements are prohibited in production paths.
- **§S004 (No Hardcoded Config Settings):** Database paths, backup directories, retention quotas, and canary tables are declared in `bedrock.toml` (`[db]`) with graceful defaults and CLI flag overrides.
- **§S005 (Hermetic Testing):** All core routines, CLI commands, API routes, and React components have 100% unit and component test coverage. Zero broken tests.
- **§S006 (SDLC & PR Workflow):** Feature branch isolation targeting `master`, non-blocking CI watch, atomic squash merges.
- **§S007 (Schema Catalog & Query Parameterization):** All queries use `%s` parameter formatting and schema catalog identifiers (`T.DIAG_TEST_RUNS`, etc.).
- **§S008 (Documentation Layout):** Spec saved in `docs/specs/` using lowercase kebab-case naming.
- **§S009 (Design System):** All UI panels consume Bedrock semantic design tokens, Tailwind v4, and standard Bedrock UI primitives (`<Button>`, `<Badge>`, `<Card>`, `<Tabs>`).
- **§S010 (Granular Security Model):** All mutating database routes (`/api/v1/admin/db/*`) enforce `admin` role authorization.
- **§S013 (API Standards & Admin Interactivity):** Uniform `/api/v1` prefix, canonical `ApiResponse[T]` envelope, and interactive admin diagnostics.

---

## 3. Directory & Module Architecture

### 3.1 Backend Architecture (`packages/bedrock-api`)

```
packages/bedrock-api/bedrock/
├── core/
│   ├── backup.py              # NEW: Hot backup, retention pruning, listing
│   ├── restore.py             # NEW: Snapshot restore (.pre-restore safety) & selective salvage
│   ├── diagnostics_runner.py  # NEW: Standalone diagnostic execution engine & DB persistence
│   ├── db_watcher.py          # NEW: Polling file watcher, process handle & canary tracking
│   ├── db_health.py           # EXISTING: Boot-time health check & PRAGMA integrity
│   └── database.py            # EXISTING: DatabaseManager connection & query execution
├── routes/
│   ├── diagnostics.py         # MODIFIED: Thin FastAPI route wrapper around diagnostics_runner
│   └── database.py            # NEW: Admin endpoints for backup, restore, list, integrity
└── tools/
    ├── _config.py             # MODIFIED: Add parsing for [db] section in bedrock.toml
    └── db/
        ├── __init__.py        # NEW: Module marker
        ├── __main__.py        # NEW: CLI dispatcher: python -m bedrock.tools.db <subcommand>
        ├── cli_backup.py      # NEW: backup, list-backups, prune subcommands
        ├── cli_restore.py     # NEW: restore subcommand (--snapshot / --salvage)
        ├── cli_diagnostics.py # NEW: diagnostics subcommand
        ├── cli_integrity.py   # NEW: integrity subcommand
        └── cli_watch.py       # NEW: watch subcommand
```

### 3.2 Frontend Architecture (`packages/bedrock-ui`)

```
packages/bedrock-ui/src/
├── components/admin/
│   ├── DiagnosticsPanel.tsx        # NEW: Test execution feed, schedule editor, run history & export
│   ├── AuditPanel.tsx              # NEW: Project & DB audit findings, severity filters, CSV export
│   ├── DatabaseMaintenancePanel.tsx# NEW: Table storage, hot backup trigger, backup catalog, integrity inspector
│   ├── PlatformHealthPanel.tsx     # MODIFIED: Option to embed Diagnostics & Database maintenance tabs
│   └── __tests__/
│       ├── DiagnosticsPanel.test.tsx
│       ├── AuditPanel.test.tsx
│       └── DatabaseMaintenancePanel.test.tsx
└── hooks/
    └── useAdminPlatform.ts         # MODIFIED: Add useDbBackups, useCreateDbBackup, useCheckDbIntegrity, useRestoreDb
```

---

## 4. Configuration Contract (`bedrock.toml`)

Declarative configuration loader (`bedrock.tools._config`) parses the `[db]` table:

```toml
[db]
# Path to application SQLite database (defaults to first .db in data/ or DATABASE_PATH env)
path = "data/MLBTracker.db"

# Backup directory and retention count for untagged backups
backup_dir = "data/backups"
backup_retention_count = 14

# Application module exporting registered diagnostic checks (imported before running)
diagnostics_module = "api.domain.diagnostic_checks"

# Canary tables to monitor during watch polling
canary_tables = ["mlb_seasons", "players", "stats_batting", "stats_pitching"]

# Optional log file for database watcher output
watch_log_file = "data/db_watch.log"
```

CLI arguments (`--db-path`, `--dest-dir`, `--keep`, `--module`, `--canaries`, `--log-file`) always take precedence over `bedrock.toml`.

---

## 5. Core Platform Services Detail

### 5.1 `bedrock.core.backup`
- **`backup_database(source_path: Path, dest_dir: Path, keep: int = 14, prefix: str | None = None) -> BackupResult`**:
  - Connects to SQLite via `file:<source_path>?mode=ro` (shared read lock, safe for live apps).
  - Uses `source_conn.backup(dest_conn)` to stream database pages safely.
  - Runs `PRAGMA integrity_check` on the newly written backup file immediately.
  - Names files deterministically: `<prefix or source_stem>-YYYYMMDD-HHMMSS.db`.
  - Prunes untagged backups matching `^{prefix}-\d{8}-\d{6}\.db$` exceeding `keep`. Tagged files (`*.pre-restore.db`, `*.corrupted.db`, `*.<tag>.db`) are preserved permanently as incident artifacts.
- **`list_backups(dest_dir: Path, prefix: str | None = None) -> list[BackupMetadata]`**:
  - Returns structured metadata: filename, path, size_bytes, mtime, is_tagged, and tag_label.

### 5.2 `bedrock.core.restore`
- **`restore_snapshot(source_backup: Path, target_db: Path, safety_backup: bool = True) -> RestoreResult`**:
  - Validates `source_backup` integrity before proceeding.
  - If `safety_backup=True`, creates `.pre-restore.db` safety backup of `target_db`.
  - Restores pages atomically from `source_backup` to `target_db`.
  - Verifies `PRAGMA integrity_check` on `target_db`; automatically rolls back to `.pre-restore.db` if corrupt.
- **`salvage_tables(source_backup: Path, target_db: Path, tables: Sequence[str] | None = None, table_renames: dict[str, str] | None = None, skip_tables: set[str] | None = None, dry_run: bool = False) -> SalvageReport`**:
  - Reads schemas via `PRAGMA table_info`, calculates column intersections.
  - Performs parameterized `INSERT OR IGNORE` so target primary keys are preserved.
  - Supports table name mapping for legacy schema recovery.

### 5.3 `bedrock.core.diagnostics_runner`
- **`execute_diagnostics_run(triggered_by: str = "cli", on_test_complete: Callable[[TestResult], None] | None = None) -> DiagnosticRunSummary`**:
  - Inserts run header into `diag_test_runs` with `status="running"`.
  - Executes registered checks from `bedrock.core.diagnostics_registry.registered_checks()`.
  - Handles retries, timings, and atomic persistence into `diag_test_results`.
  - Emits real-time progress callbacks for CLI and web notification.
  - Updates `diag_test_runs` with final status, pass/fail counts, and finish timestamp.
  - Prunes historical runs older than `retention_days`.

### 5.4 `bedrock.core.db_watcher`
- **`DatabaseWatcher` class**:
  - Polls target file stat (`st_size`, `st_mtime`).
  - On delta: queries canary table row counts, scans active OS process file handles (`psutil.process_iter`), and reads recent rows from `_wipe_audit` trigger table.
  - Emits structured Loguru logs to console and optional append-only `db_watch.log`.

---

## 6. Backend API Routes (`bedrock.routes.database`)

All routes require `admin` role (`dependencies=[require_role("admin")]`):
- **`POST /api/v1/admin/db/backup`**:
  - Triggers hot backup using `bedrock.core.backup.backup_database()`.
  - Returns `ApiResponse[BackupResult]` with filename, size, and integrity status.
- **`GET /api/v1/admin/db/backups`**:
  - Returns `ApiResponse[list[BackupMetadata]]` listing all files in the backup directory.
- **`POST /api/v1/admin/db/integrity`**:
  - Executes `PRAGMA integrity_check` on the active application database.
  - Returns `ApiResponse[DbIntegrityReport]` (`ok: bool`, `details: list[str]`).
- **`POST /api/v1/admin/db/restore`**:
  - Accepts payload: `{ snapshot_path: str, confirm_text: str }`.
  - Requires `confirm_text == "RESTORE"`.
  - Executes `bedrock.core.restore.restore_snapshot()` with automatic `.pre-restore.db` safety backup.

---

## 7. Frontend Components & Reporting (`packages/bedrock-ui`)

### 7.1 `<DiagnosticsPanel />`
- Extracted and enhanced from MLBTracker's `AdminPage.tsx`.
- **Run Trigger & Live Polling**: "Run Tests" button triggers execution and polls until completed.
- **Schedule Management**: Inline daily schedule editor (enable toggle, time picker, retention days).
- **Run History Table**: Displays past runs with pass rate %, trigger source, and status badges.
- **Expandable Test Details**: Groups tests by category (`Database`, `Config`, `Schema`), displays duration in ms, detail messages, and full error tracebacks.
- **Reporting & Export**: Added "Export Run as JSON" and "Export Run as CSV" buttons for incident postmortems.

### 7.2 `<AuditPanel />`
- Extracted and enhanced from MLBTracker's `AdminPage.tsx`.
- **Run Audit Trigger**: Interactive button with execution spinner.
- **Filtering**: Live search bar filtering by check name, file, or finding detail.
- **Severity Groups**: Accordion groups by check name with color-coded severity badges (`error`, `warning`, `info`).
- **Audit History**: Sub-tab browsing historical runs from `sys_audit_runs`.
- **Reporting**: Direct CSV export of all findings with file and line metadata.

### 7.3 `<DatabaseMaintenancePanel />`
- Replaces read-only database tabs with full maintenance controls:
- **Storage Overview**: Reuses `useDbSummary()` for overall file size and filterable table breakdown.
- **Backup Toolbar**: "Create Hot Backup" button with immediate toast feedback.
- **Backup Catalog**: Interactive grid listing backups, file sizes, creation timestamps, and retention status.
- **Integrity Inspector**: "Run Integrity Check" button with visual pass/fail indicator.
- **Protected Restore Modal**: High-friction dialog requiring typing `RESTORE` to execute snapshot restoration.

---

## 8. CLI Suite (`bedrock.tools.db`)

Command dispatcher `python -m bedrock.tools.db <subcommand>`:
```bash
# Backup & listing
python -m bedrock.tools.db backup [--dest-dir PATH] [--keep N] [--prefix NAME]
python -m bedrock.tools.db list-backups [--dest-dir PATH] [--prefix NAME]

# Restore
python -m bedrock.tools.db restore --snapshot PATH [--target PATH] [--no-safety-backup] [--yes]
python -m bedrock.tools.db restore --salvage PATH [--target PATH] [--tables T1,T2] [--dry-run] [--yes]

# Diagnostics & integrity
python -m bedrock.tools.db diagnostics [--module MODULE] [--db-path PATH]
python -m bedrock.tools.db integrity [--db-path PATH]

# Watcher
python -m bedrock.tools.db watch [--db-path PATH] [--interval SECS] [--canaries T1,T2] [--log-file PATH]
```

### Exit Codes:
- `0`: Success (or all diagnostic checks passed).
- `1`: Operation failed (integrity failure, test failure, backup error).
- `2`: Configuration or argument error.

---

## 9. Automated Testing Strategy & Migration

All tests migrate into Bedrock platform test suites:

### 9.1 Backend Tests (`packages/bedrock-api/tests/`)
- **`test_db_backup.py`**:
  - Hot online backup streaming on live SQLite DB.
  - Integrity check validation.
  - Quota pruning (untagged pruned, tagged `.pre-restore.db` / `.corrupted.db` preserved).
- **`test_db_restore.py`**:
  - Snapshot replacement with `.pre-restore.db` safety backup.
  - Rollback on corrupted snapshot.
  - Selective salvage with table rename mapping and column intersection.
- **`test_diagnostics_runner.py`**:
  - Execution of registered checks in `(order, seq)` sequence.
  - Retry logic and timing calculation.
  - Atomic persistence to `diag_test_runs` and `diag_test_results`.
  - Pruning of historical runs.
- **`test_routes_database.py`**:
  - Route tests for `/api/v1/admin/db/*` (auth guards, successful backup, listing, integrity check).
- **`test_db_tools_cli.py`**:
  - CLI argument parsing, `bedrock.toml` fallback resolution, and unmasked exit codes (`0`, `1`, `2`).

### 9.2 Frontend Tests (`packages/bedrock-ui/src/components/admin/__tests__/`)
- **`DiagnosticsPanel.test.tsx`**: Tests run triggering, schedule updating, run history rendering, and CSV/JSON export.
- **`AuditPanel.test.tsx`**: Tests audit triggering, severity filtering, accordion toggles, and CSV download.
- **`DatabaseMaintenancePanel.test.tsx`**: Tests backup button click, backup catalog table rendering, integrity check trigger, and guarded restore modal.

---

## 10. Consumer Repositories Migration Plan

### 10.1 MLBTracker (Issues #448 & #449)
1. **Bump Bedrock Pin**: Update `requirements.txt` and `package.json` to the release containing this toolset (§S012).
2. **Refactor `AdminPage.tsx`**:
   - Delete ~1,200 lines of hand-rolled UI (`DiagnosticsPanel`, `AuditTab`, `AuditHistoryTab`, `DatabaseTab`).
   - Import `<DiagnosticsPanel>`, `<AuditPanel>`, and `<DatabaseMaintenancePanel>` directly from `@djntechnic/bedrock-ui`.
3. **Resolve Issue #449 (CLI Diagnostic Runner)**:
   - Provide `scripts/maintenance/jobs/run_diagnostics.bat` wrapping `python -m bedrock.tools.db diagnostics`.
4. **Resolve Issue #448 (Audit Legacy Scripts)**:
   - Move `find_query_usages.py` and `find_table_usages.py` to `docs/archive/`.
   - Delete `validate_inventory.py`.
   - Convert `seed_log_event_types.py` into a formal migration in `api/schema/migrations/`.
   - Replace `backup_database.py`, `restore_from_backup.py`, `list_backups.py`, and `watch_db.py` with batch job wrappers invoking `python -m bedrock.tools.db`.

### 10.2 CollectIt
1. Configure `[db]` in `bedrock.toml`.
2. Add `<DiagnosticsPanel />` and `<DatabaseMaintenancePanel />` to CollectIt's `AdminPage.tsx`.
3. Gain full database maintenance, automated hot backups, diagnostics, and DB watching with zero custom maintenance code.
