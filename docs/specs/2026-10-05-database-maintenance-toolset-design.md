# Architectural Design Spec: Unified Database Maintenance & Diagnostics Toolset

**Date:** 2026-10-05  
**Status:** Approved  
**Related Issues:** Bedrock #128, MLBTracker #448, MLBTracker #449  
**Platform Compliance:** Bedrock Standards §S001–§S015  

---

## 1. Executive Summary & Intent

Domain applications across the Bedrock ecosystem (MLBTracker, CollectIt, and future services) currently maintain duplicated, divergent, or legacy maintenance scripts for database backups, restorations, integrity verification, diagnostics execution, and file monitoring.

This specification unifies database operations under a Bedrock-owned platform toolset in `packages/bedrock-api`:
1. **Core Platform Engines (`bedrock.core`)**: Decoupled, reusable Python services for hot online backups (`sqlite3.backup`), safe dual-mode restoration (snapshot with safety backup or column-intersection salvage), standalone diagnostics execution with run ledger persistence, and live SQLite database watching.
2. **Unified CLI Suite (`bedrock.tools.db`)**: A single CLI entrypoint (`python -m bedrock.tools.db <subcommand>`) driven by `bedrock.toml` configuration and explicit CLI flags.
3. **Consumer Decoupling & Legacy Cleanup**: Enables retiring legacy and fragile scripts in consumer repositories (resolving MLBTracker #448 and #449, and fulfilling Bedrock #128), while giving all consumers uniform ops capabilities.

---

## 2. Platform Architectural Invariants

The design adheres strictly to Bedrock Platform Standards:
- **§S001 (No Duplicate UI / Code):** Database maintenance logic resides in Bedrock platform packages; consumers do not maintain parallel backup/restore implementations.
- **§S003 (Logging Protocol):** All backend logging uses Loguru; raw `print()` statements are prohibited in core services.
- **§S004 (No Hardcoded Config Settings):** Database paths, backup directories, retention quotas, and canary tables are declared in `bedrock.toml` (`[db]`) with graceful defaults and CLI flag overrides.
- **§S005 (Hermetic Testing):** All core routines and CLI commands have 100% unit test coverage using temporary SQLite databases and mock filesystems.
- **§S006 (SDLC & PR Workflow):** Feature branches targeting `master`, non-blocking CI watch, atomic squash merges.
- **§S007 (Schema Catalog & Query Parameterization):** All queries use `%s` parameter formatting and schema catalog identifiers (`T.DIAG_TEST_RUNS`, etc.).
- **§S008 (Documentation Layout):** Spec saved in `docs/specs/` using lowercase kebab-case naming.
- **§S013 (API Standards & Admin Interactivity):** Diagnostic test runs record atomically to `diag_test_runs` and `diag_test_results`. Web API and CLI share the exact same execution engine.

---

## 3. Directory & Module Architecture

### 3.1 New & Modified Files in `packages/bedrock-api`

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
│   └── diagnostics.py         # MODIFIED: Thin FastAPI route wrapper around diagnostics_runner
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

---

## 4. Configuration Contract (`bedrock.toml`)

The declarative configuration loader in `bedrock.tools._config` is extended with a typed `DbConfig` dataclass reading the `[db]` table:

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

### Fallback Defaults:
- `path`: Checks `DATABASE_PATH` env var; if unset, searches `data/*.db`; falls back to `data/app.db`.
- `backup_dir`: Defaults to `data/backups`.
- `backup_retention_count`: Defaults to `14`.
- `diagnostics_module`: Defaults to `None` (executes only platform registered checks).
- `canary_tables`: Defaults to `[]`.
- `watch_log_file`: Defaults to `None` (logs to console only).

CLI arguments (`--db-path`, `--dest-dir`, `--keep`, `--module`, `--canaries`, `--log-file`) always take precedence over `bedrock.toml`.

---

## 5. Core Platform Services Detail

### 5.1 `bedrock.core.backup`
- **`backup_database(source_path: Path, dest_dir: Path, keep: int = 14, prefix: str | None = None) -> BackupResult`**:
  - Opens `file:<source_path>?mode=ro` (URI connection) to obtain a shared read lock safe for live concurrent applications.
  - Initializes destination connection at `dest_dir / f"{prefix or source_path.stem}-{YYYYMMDD-HHMMSS}.db"`.
  - Executes `source_conn.backup(dest_conn)`.
  - Runs `PRAGMA integrity_check` on the completed destination file. If integrity check fails, tags file as `.corrupted.db` and raises `BackupIntegrityError`.
  - Prunes untagged backups: identifies files matching `^{prefix}-\d{8}-\d{6}\.db$`, retains the `keep` newest files sorted by mtime, and unlinks older files. Tagged files (e.g. `*.pre-restore.db`, `*.corrupted.db`, `*.<tag>.db`) are preserved permanently as incident artifacts.
- **`list_backups(dest_dir: Path, prefix: str | None = None) -> list[BackupMetadata]`**:
  - Returns structured metadata for each backup file: filename, path, size_bytes, mtime, is_tagged, and tag_label.

### 5.2 `bedrock.core.restore`
- **`restore_snapshot(source_backup: Path, target_db: Path, safety_backup: bool = True) -> RestoreResult`**:
  - Verifies `source_backup` exists and passes `PRAGMA integrity_check`.
  - If `safety_backup=True` and `target_db` exists, takes an immediate online backup of `target_db` to `target_db.parent / f"{target_db.stem}-{YYYYMMDD-HHMMSS}.pre-restore.db"`.
  - Performs atomic restore: streams pages from `source_backup` into `target_db` using SQLite backup API.
  - Re-verifies `PRAGMA integrity_check` on `target_db`. If check fails, restores from `.pre-restore.db` and raises `RestoreError`.
- **`salvage_tables(source_backup: Path, target_db: Path, tables: Sequence[str] | None = None, table_renames: dict[str, str] | None = None, skip_tables: set[str] | None = None, dry_run: bool = False) -> SalvageReport`**:
  - Connects to source backup and target database.
  - For each requested table (applying `table_renames` if mapped):
    - Skips tables in `skip_tables` (e.g. auth tables, schema migration ledgers).
    - Queries source and target column definitions via `PRAGMA table_info`.
    - Determines column intersection.
    - If `dry_run=False`, executes parameterized `INSERT OR IGNORE INTO <target_table> (<common_cols>) VALUES (...)` in batches. Target records win on conflict.
  - Returns `SalvageReport` detailing rows scanned, rows inserted, and skipped tables.

### 5.3 `bedrock.core.diagnostics_runner`
- **`execute_diagnostics_run(triggered_by: str = "cli", on_test_complete: Callable[[TestResult], None] | None = None) -> DiagnosticRunSummary`**:
  - Atomic run tracking: inserts initial record into `diag_test_runs` with `status="running"` and UTC timestamp.
  - Retrieves registered checks from `bedrock.core.diagnostics_registry.registered_checks()`.
  - Iterates through checks in deterministic `(order, seq)` sequence.
  - For each check:
    - Retries up to `check.max_retries` on exception, with backoff sleep.
    - Records start time, end time, and duration in milliseconds.
    - Inserts atomic result row into `diag_test_results` (`run_id`, `name`, `group`, `status`, `duration_ms`, `error_message`, `detail`).
    - Invokes optional `on_test_complete` callback with `TestResult` for live CLI feedback.
  - Updates `diag_test_runs` record with final status (`completed` or `failed`), pass/fail counts, total duration, and completion timestamp.
  - Enforces retention policy on `diag_test_runs` and `diag_test_results` (pruning runs older than configured retention days).
- **Refactoring `bedrock.routes.diagnostics`**:
  - Replaces internal private functions in `routes/diagnostics.py` with direct calls to `execute_diagnostics_run(triggered_by="admin_api")` inside FastAPI `BackgroundTasks`.

### 5.4 `bedrock.core.db_watcher`
- **`DatabaseWatcher` class**:
  - Polls target SQLite file at configured interval (default 2.0s).
  - Detects size and mtime deltas.
  - On delta:
    - Executes canary queries: `SELECT COUNT(*) FROM <table>` for each table in `canary_tables`.
    - Scans active OS process handles touching the DB file using `psutil.process_iter()`.
    - Queries recent rows from `_wipe_audit` trigger table if present.
    - Emits structured Loguru audit log entries and appends to `watch_log_file` if configured.

---

## 6. Unified CLI Suite (`bedrock.tools.db`)

### 6.1 Subcommands & Invocation

```bash
# General help
python -m bedrock.tools.db --help

# Backup
python -m bedrock.tools.db backup [--db-path PATH] [--dest-dir PATH] [--keep N] [--prefix NAME]

# List backups
python -m bedrock.tools.db list-backups [--dest-dir PATH] [--prefix NAME]

# Restore
python -m bedrock.tools.db restore --snapshot PATH [--target PATH] [--no-safety-backup] [--yes]
python -m bedrock.tools.db restore --salvage PATH [--target PATH] [--tables T1,T2] [--dry-run] [--yes]

# Diagnostics
python -m bedrock.tools.db diagnostics [--module MODULE] [--db-path PATH]

# Quick integrity check
python -m bedrock.tools.db integrity [--db-path PATH]

# Watch
python -m bedrock.tools.db watch [--db-path PATH] [--interval SECS] [--canaries T1,T2] [--log-file PATH]
```

### 6.2 Exit Codes
- `0`: Operation succeeded cleanly (or all diagnostic checks passed).
- `1`: Operation failed (backup error, integrity failure, restore rollback, or one or more diagnostic tests failed).
- `2`: Invalid CLI arguments or configuration error.

---

## 7. Consumer Integration & Migration Plan

### 7.1 MLBTracker (Issues #448 & #449)
1. **Bedrock Pin Bump**: Update MLBTracker's Bedrock dependencies to the release containing this toolset (§S012).
2. **`bedrock.toml` Configuration**: Add `[db]` section specifying `path = "data/MLBTracker.db"`, `diagnostics_module = "api.domain.diagnostic_checks"`, and `canary_tables`.
3. **Issue #449 Resolution**:
   - Provide `scripts/maintenance/jobs/run_diagnostics.bat` wrapping `python -m bedrock.tools.db diagnostics`.
   - Purged old broken script runners; clean module execution eliminates `sys.path` failures.
4. **Issue #448 Resolution**:
   - Move `find_query_usages.py` and `find_table_usages.py` to `docs/archive/` with deprecation notices.
   - Delete `validate_inventory.py`.
   - Convert `seed_log_event_types.py` into a formal idempotent Alembic/SQL schema migration in `api/schema/migrations/` using `T.LOG_EVENT_TYPES`.
   - Replace `backup_database.py`, `restore_from_backup.py`, `list_backups.py`, and `watch_db.py` with batch job wrappers invoking `python -m bedrock.tools.db`.

### 7.2 CollectIt
1. Configure `[db]` in `bedrock.toml` (`path = "data/CollectIt.db"`).
2. Gain standardized hot backup, integrity verification, diagnostics, and DB watch commands with zero custom script authoring.

---

## 8. Verification & Test Plan

1. **Unit Tests in `packages/bedrock-api/tests/test_db_tools.py`**:
   - `test_backup_hot_online()`: Verifies page streaming and PRAGMA integrity on temporary SQLite DB.
   - `test_backup_retention_prune()`: Tests that untagged files are pruned at the quota while tagged files are preserved.
   - `test_restore_snapshot_with_safety_backup()`: Verifies `.pre-restore.db` generation and atomic replacement.
   - `test_restore_salvage_column_intersection()`: Tests table salvage across differing schemas with `INSERT OR IGNORE`.
   - `test_diagnostics_runner_execution()`: Asserts tests execute, callbacks trigger, and records write to `diag_test_runs` / `diag_test_results`.
   - `test_cli_dispatch()`: Verifies argument parsing, `bedrock.toml` fallbacks, and exit codes for all subcommands.
2. **Gate Audit**: Run Bedrock audit suite (`python -m bedrock.tools.run_all`) ensuring zero regressions.
