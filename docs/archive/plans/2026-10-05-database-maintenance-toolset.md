# Database Maintenance, Diagnostics & Admin Toolset Implementation Plan

> **Delivery via Triage Plan:** Hand off this plan directly to the `/triage-plan` skill:
> ```pwsh
> /triage-plan docs/plans/2026-10-05-database-maintenance-toolset.md
> ```
> This ingests discrete tasks, maps domain-to-agent delegations, injects runtime invariants
> (active virtualenv/python, direct exit status, lockstep pins, <30s delta testing), and supervises execution.

**Goal:** Build a standardized, bedrock-owned toolset for database maintenance, safe hot backups, disaster recovery restoration, standalone diagnostics execution, file forensics watching, administrative API routes, and reusable frontend admin reporting panels for all consumer repositories.

**Architecture:** Core database operations are decoupled into importable Python engines under `bedrock.core` and surfaced via a unified CLI dispatcher under `bedrock.tools.db` driven by declarative `bedrock.toml` settings. Dedicated FastAPI admin routes (`bedrock.routes.database` & `diagnostics`) power first-class reusable React panels in `@djntechnic/bedrock-ui` (`<DiagnosticsPanel />`, `<AuditPanel />`, `<DatabaseMaintenancePanel />`), replacing fragile hand-rolled consumer scripts and monolithic admin pages.

**Tech Stack:** Python 3.11, SQLite (online C backup API), FastAPI, Loguru (§S003), React 18, TanStack Query, Tailwind CSS v4, Lucide Icons, Vitest, Pytest.

**Spec:** [`docs/specs/2026-10-05-database-maintenance-toolset-design.md`](file:///c:/Dev/bedrock/docs/specs/2026-10-05-database-maintenance-toolset-design.md)

## Global Constraints

- Backend logging must use Loguru exclusively; raw `print()` statements are banned (§S003).
- Frontend logging must use Pino; raw `console.*` is banned (§S003).
- SQL statements must use `%s` parameter formatting and schema catalog references (§S007).
- Bare table string literals are prohibited in application logic; use `bedrock.core.schema_catalog.Tables` (§S007).
- Mutating API endpoints require `admin` role authorization (§S010, §S013).
- Every data table/grid must compose `<DataGrid>` and consume `useGridConfig` where applicable (§S002).
- Zero broken tests allowed across backend (`pytest`) and frontend (`npm run test:run`) suites (§S005).
- Delta verification commands must evaluate `$LASTEXITCODE -eq 0` directly without pipe masking.

## Review Focus

1. **Concurrent SQLite Lock Conflicts:** Taking an online backup while application threads write to the database must never deadlock or fail with `database is locked`. Test: `test_backup_under_concurrent_transactions` in Task 1.
2. **Post-Restore Integrity Corruption:** A restored snapshot file containing corrupt B-tree pages must be caught by `PRAGMA integrity_check` and rolled back to `.pre-restore.db`. Test: `test_restore_corrupted_snapshot_rolls_back` in Task 2.
3. **Diagnostics Runner Persistence Reliability:** If an individual diagnostic check raises an unhandled exception, the runner must catch it, record `status="failed"` with error detail in `diag_test_results`, and finalize `diag_test_runs` rather than crashing the whole run. Test: `test_diagnostics_runner_exception_isolation` in Task 3.
4. **Accidental Production Database Overwrite:** The Web API restore endpoint must refuse to execute unless the explicit safety confirmation token (`"RESTORE"`) is supplied in the request body. Test: `test_restore_route_requires_explicit_confirmation` in Task 5.
5. **CLI Discovery When Domain Module Absent:** `python -m bedrock.tools.db diagnostics` must gracefully fall back to executing only platform registered checks if no consumer `diagnostics_module` is configured in `bedrock.toml`. Test: `test_cli_diagnostics_without_domain_module` in Task 6.

---

### Task 1: Core Backup Engine & Retention Pruning

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-api/bedrock/core/backup.py`
- Test: `packages/bedrock-api/tests/test_db_backup.py`

**Delta Verification:**
- Command: `python -m pytest packages/bedrock-api/tests/test_db_backup.py -q`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

```python
# packages/bedrock-api/tests/test_db_backup.py
import sqlite3
from pathlib import Path
import pytest
from bedrock.core.backup import backup_database, list_backups, BackupResult, BackupMetadata

def test_backup_creates_valid_file_and_prunes(tmp_path: Path):
    db_file = tmp_path / "test.db"
    conn = sqlite3.connect(str(db_file))
    conn.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
    conn.execute("INSERT INTO users VALUES (1, 'Alice')")
    conn.commit()
    conn.close()

    backup_dir = tmp_path / "backups"
    res = backup_database(db_file, backup_dir, keep=2, prefix="testapp")
    assert res.ok is True
    assert res.path.exists()
    assert res.path.name.startswith("testapp-")

    # Verify backup integrity
    b_conn = sqlite3.connect(f"file:{res.path}?mode=ro", uri=True)
    rows = b_conn.execute("SELECT name FROM users").fetchall()
    b_conn.close()
    assert rows == [("Alice",)]

    backups = list_backups(backup_dir, prefix="testapp")
    assert len(backups) == 1
    assert backups[0].size_bytes > 0
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `python -m pytest packages/bedrock-api/tests/test_db_backup.py -q`  
Expected: ModuleNotFoundError / ImportError ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Implement `bedrock.core.backup`**

```python
# packages/bedrock-api/bedrock/core/backup.py
from __future__ import annotations
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from loguru import logger

UNTAGGED_RE = re.compile(r"^[a-zA-Z0-9_-]+-\d{8}-\d{6}\.db$", re.IGNORECASE)

@dataclass(frozen=True)
class BackupResult:
    ok: bool
    path: Path
    size_bytes: int
    duration_ms: int
    detail: str

@dataclass(frozen=True)
class BackupMetadata:
    name: str
    path: Path
    size_bytes: int
    modified_at: str
    is_tagged: bool
    tag: str | None

def integrity_check(path: Path) -> tuple[bool, str]:
    conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        rows = conn.execute("PRAGMA integrity_check").fetchall()
    finally:
        conn.close()
    if not rows:
        return False, "no rows returned from PRAGMA integrity_check"
    first = rows[0][0]
    ok = str(first).lower() == "ok"
    return ok, "ok" if ok else "; ".join(str(r[0]) for r in rows[:5])

def prune_backups(dest_dir: Path, keep: int, prefix: str | None = None) -> list[Path]:
    if not dest_dir.exists():
        return []
    pattern = f"{prefix}-*.db" if prefix else "*.db"
    candidates = sorted(
        (p for p in dest_dir.glob(pattern) if UNTAGGED_RE.match(p.name)),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    to_delete = candidates[keep:]
    for p in to_delete:
        p.unlink()
    return to_delete

def backup_database(source_path: Path, dest_dir: Path, keep: int = 14, prefix: str | None = None) -> BackupResult:
    import time
    t0 = time.monotonic()
    if not source_path.exists():
        raise FileNotFoundError(f"Source database does not exist: {source_path}")
    
    dest_dir.mkdir(parents=True, exist_ok=True)
    stem = prefix or source_path.stem
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    dest_path = dest_dir / f"{stem}-{ts}.db"

    src_conn = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True, timeout=30.0)
    dst_conn = sqlite3.connect(str(dest_path))
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()

    ok, detail = integrity_check(dest_path)
    if not ok:
        corrupted_path = dest_path.with_suffix(".corrupted.db")
        dest_path.rename(corrupted_path)
        return BackupResult(
            ok=False,
            path=corrupted_path,
            size_bytes=corrupted_path.stat().st_size,
            duration_ms=round((time.monotonic() - t0) * 1000),
            detail=f"Integrity check failed: {detail}",
        )

    prune_backups(dest_dir, keep=keep, prefix=stem)
    duration_ms = round((time.monotonic() - t0) * 1000)
    logger.info(f"Database backup completed: {dest_path} ({dest_path.stat().st_size} bytes, {duration_ms}ms)")
    return BackupResult(
        ok=True,
        path=dest_path,
        size_bytes=dest_path.stat().st_size,
        duration_ms=duration_ms,
        detail="ok",
    )

def list_backups(dest_dir: Path, prefix: str | None = None) -> list[BackupMetadata]:
    if not dest_dir.exists():
        return []
    pattern = f"{prefix}-*.db" if prefix else "*.db"
    results = []
    for p in sorted(dest_dir.glob(pattern), key=lambda x: x.stat().st_mtime, reverse=True):
        st = p.stat()
        is_untagged = bool(UNTAGGED_RE.match(p.name))
        tag = None
        if not is_untagged and "." in p.stem:
            tag = p.stem.split(".", 1)[1]
        results.append(
            BackupMetadata(
                name=p.name,
                path=p,
                size_bytes=st.st_size,
                modified_at=datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
                is_tagged=not is_untagged,
                tag=tag,
            )
        )
    return results
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `python -m pytest packages/bedrock-api/tests/test_db_backup.py -q`  
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Commit**

Command: `git commit -m "feat(bedrock-api): implement core backup engine and retention pruner"`

---

### Task 2: Core Restore Engine & Disaster Recovery

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-api/bedrock/core/restore.py`
- Test: `packages/bedrock-api/tests/test_db_restore.py`

**Delta Verification:**
- Command: `python -m pytest packages/bedrock-api/tests/test_db_restore.py -q`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

```python
# packages/bedrock-api/tests/test_db_restore.py
import sqlite3
from pathlib import Path
import pytest
from bedrock.core.restore import restore_snapshot, salvage_tables

def test_restore_snapshot_replaces_and_preserves_safety_copy(tmp_path: Path):
    target = tmp_path / "app.db"
    conn = sqlite3.connect(str(target))
    conn.execute("CREATE TABLE t (v TEXT)")
    conn.execute("INSERT INTO t VALUES ('old')")
    conn.commit()
    conn.close()

    backup = tmp_path / "backup.db"
    b_conn = sqlite3.connect(str(backup))
    b_conn.execute("CREATE TABLE t (v TEXT)")
    b_conn.execute("INSERT INTO t VALUES ('restored')")
    b_conn.commit()
    b_conn.close()

    res = restore_snapshot(backup, target, safety_backup=True)
    assert res.ok is True
    assert res.safety_backup_path is not None
    assert res.safety_backup_path.exists()

    # Target now has restored data
    chk = sqlite3.connect(str(target))
    assert chk.execute("SELECT v FROM t").fetchall() == [("restored",)]
    chk.close()
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `python -m pytest packages/bedrock-api/tests/test_db_restore.py -q`  
Expected: ModuleNotFoundError / ImportError ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Implement `bedrock.core.restore`**

```python
# packages/bedrock-api/bedrock/core/restore.py
from __future__ import annotations
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence
from loguru import logger
from bedrock.core.backup import integrity_check

@dataclass(frozen=True)
class RestoreResult:
    ok: bool
    safety_backup_path: Path | None
    detail: str

@dataclass(frozen=True)
class SalvageReport:
    tables_processed: int
    rows_inserted: int
    skipped_tables: list[str]

def restore_snapshot(source_backup: Path, target_db: Path, safety_backup: bool = True) -> RestoreResult:
    if not source_backup.exists():
        raise FileNotFoundError(f"Source backup file not found: {source_backup}")

    ok, detail = integrity_check(source_backup)
    if not ok:
        raise ValueError(f"Cannot restore: source backup failed integrity check: {detail}")

    safety_path: Path | None = None
    if safety_backup and target_db.exists():
        ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        safety_path = target_db.parent / f"{target_db.stem}-{ts}.pre-restore.db"
        src = sqlite3.connect(f"file:{target_db}?mode=ro", uri=True)
        dst = sqlite3.connect(str(safety_path))
        try:
            src.backup(dst)
        finally:
            dst.close()
            src.close()
        logger.info(f"Created safety pre-restore backup at {safety_path}")

    src_conn = sqlite3.connect(f"file:{source_backup}?mode=ro", uri=True)
    dst_conn = sqlite3.connect(str(target_db))
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()

    target_ok, target_detail = integrity_check(target_db)
    if not target_ok:
        if safety_path and safety_path.exists():
            rollback_src = sqlite3.connect(f"file:{safety_path}?mode=ro", uri=True)
            rollback_dst = sqlite3.connect(str(target_db))
            try:
                rollback_src.backup(rollback_dst)
            finally:
                rollback_dst.close()
                rollback_src.close()
        return RestoreResult(ok=False, safety_backup_path=safety_path, detail=f"Target corrupted, rolled back: {target_detail}")

    return RestoreResult(ok=True, safety_backup_path=safety_path, detail="ok")

def salvage_tables(
    source_backup: Path,
    target_db: Path,
    tables: Sequence[str] | None = None,
    table_renames: dict[str, str] | None = None,
    skip_tables: set[str] | None = None,
    dry_run: bool = False,
) -> SalvageReport:
    renames = table_renames or {}
    skips = skip_tables or set()
    src = sqlite3.connect(f"file:{source_backup}?mode=ro", uri=True)
    dst = sqlite3.connect(str(target_db))
    total_inserted = 0
    tables_count = 0
    skipped = []

    try:
        if tables is None:
            r = src.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
            candidate_tables = [row[0] for row in r if not row[0].startswith("sqlite_")]
        else:
            candidate_tables = list(tables)

        for src_tbl in candidate_tables:
            target_tbl = renames.get(src_tbl, src_tbl)
            if target_tbl in skips or src_tbl in skips:
                skipped.append(src_tbl)
                continue

            src_cols = [r[1] for r in src.execute(f'PRAGMA table_info("{src_tbl}")').fetchall()]
            dst_cols = [r[1] for r in dst.execute(f'PRAGMA table_info("{target_tbl}")').fetchall()]
            common = [c for c in src_cols if c in dst_cols]
            if not common:
                skipped.append(src_tbl)
                continue

            col_names = ", ".join(f'"{c}"' for c in common)
            placeholders = ", ".join("?" for _ in common)
            rows = src.execute(f'SELECT {col_names} FROM "{src_tbl}"').fetchall()
            if not dry_run and rows:
                dst.executemany(
                    f'INSERT OR IGNORE INTO "{target_tbl}" ({col_names}) VALUES ({placeholders})',
                    rows,
                )
                dst.commit()
            total_inserted += len(rows)
            tables_count += 1
    finally:
        dst.close()
        src.close()

    return SalvageReport(tables_processed=tables_count, rows_inserted=total_inserted, skipped_tables=skipped)
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `python -m pytest packages/bedrock-api/tests/test_db_restore.py -q`  
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Commit**

Command: `git commit -m "feat(bedrock-api): implement core restore and selective salvage engine"`

---

### Task 3: Decoupled Diagnostics Runner & Persistence

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-api/bedrock/core/diagnostics_runner.py`
- Modify: `packages/bedrock-api/bedrock/routes/diagnostics.py`
- Test: `packages/bedrock-api/tests/test_diagnostics_runner.py`

**Delta Verification:**
- Command: `python -m pytest packages/bedrock-api/tests/test_diagnostics_runner.py -q`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

```python
# packages/bedrock-api/tests/test_diagnostics_runner.py
import pytest
from bedrock.core.diagnostics_registry import register_diagnostic_check, __clear_diagnostic_checks
from bedrock.core.diagnostics_runner import execute_diagnostics_run, DiagnosticRunSummary

def test_execute_diagnostics_run_records_results(client):
    __clear_diagnostic_checks()
    register_diagnostic_check("Dummy Pass", "Platform", lambda: "all good", order=1)
    register_diagnostic_check("Dummy Fail", "Platform", lambda: (_ for _ in ()).throw(AssertionError("broken")), order=2)

    summary = execute_diagnostics_run(triggered_by="test_suite")
    assert summary.total == 2
    assert summary.passed == 1
    assert summary.failed == 1
    assert summary.status == "failed"
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `python -m pytest packages/bedrock-api/tests/test_diagnostics_runner.py -q`  
Expected: ModuleNotFoundError / ImportError ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Implement `bedrock.core.diagnostics_runner` and refactor `bedrock.routes.diagnostics`**

```python
# packages/bedrock-api/bedrock/core/diagnostics_runner.py
from __future__ import annotations
import time
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Callable
from loguru import logger
from bedrock.core.database import db
from bedrock.core.schema_catalog import Tables as T
from bedrock.core.diagnostics_registry import registered_checks

@dataclass
class TestResult:
    name: str
    group: str
    status: str
    error_message: str | None = None
    detail: str | None = None
    duration_ms: int = 0
    attempt: int = 1

@dataclass
class DiagnosticRunSummary:
    run_id: int
    status: str
    total: int
    passed: int
    failed: int
    duration_ms: int

def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")

def execute_diagnostics_run(
    triggered_by: str = "cli",
    on_test_complete: Callable[[TestResult], None] | None = None,
) -> DiagnosticRunSummary:
    t0 = time.monotonic()
    started_at = _utcnow_iso()
    
    # 1. Start run record
    df = db.query(
        f"INSERT INTO {T.DIAG_TEST_RUNS} (triggered_by, status, started_at) "
        f"VALUES (%s, 'running', %s) RETURNING run_id",
        params=(triggered_by, started_at),
    )
    run_id = int(df.iloc[0]["run_id"])

    checks = registered_checks()
    passed = 0
    failed = 0

    # 2. Execute checks
    for check in checks:
        res = TestResult(check.name, check.group, "passed")
        for attempt in range(1, check.max_retries + 2):
            res.attempt = attempt
            t_start = time.monotonic()
            try:
                detail = check.fn()
                res.duration_ms = round((time.monotonic() - t_start) * 1000)
                res.status = "passed"
                res.detail = str(detail) if detail is not None else "ok"
                res.error_message = None
                break
            except Exception as exc:
                res.duration_ms = round((time.monotonic() - t_start) * 1000)
                res.status = "failed"
                res.error_message = str(exc)
                if attempt <= check.max_retries:
                    time.sleep(0.5)

        if res.status == "passed":
            passed += 1
        else:
            failed += 1

        db.execute(
            f"INSERT INTO {T.DIAG_TEST_RESULTS} "
            f"(run_id, test_name, test_group, status, duration_ms, error_message, detail) "
            f"VALUES (%s, %s, %s, %s, %s, %s, %s)",
            params=(run_id, res.name, res.group, res.status, res.duration_ms, res.error_message, res.detail),
        )

        if on_test_complete:
            on_test_complete(res)

    total_duration_ms = round((time.monotonic() - t0) * 1000)
    final_status = "passed" if failed == 0 else "failed"
    completed_at = _utcnow_iso()

    db.execute(
        f"UPDATE {T.DIAG_TEST_RUNS} "
        f"SET status = %s, total = %s, passed = %s, failed = %s, "
        f"    completed_at = %s, duration_ms = %s "
        f"WHERE run_id = %s",
        params=(final_status, len(checks), passed, failed, completed_at, total_duration_ms, run_id),
    )

    return DiagnosticRunSummary(
        run_id=run_id,
        status=final_status,
        total=len(checks),
        passed=passed,
        failed=failed,
        duration_ms=total_duration_ms,
    )
```

In `packages/bedrock-api/bedrock/routes/diagnostics.py`, replace `_execute_run` implementation with `return execute_diagnostics_run(triggered_by=triggered_by).run_id`.

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `python -m pytest packages/bedrock-api/tests/test_diagnostics_runner.py packages/bedrock-api/tests/test_diagnostics.py -q`  
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Commit**

Command: `git commit -m "feat(bedrock-api): extract diagnostics runner into core platform service"`

---

### Task 4: Database Watcher & Forensics Engine

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-api/bedrock/core/db_watcher.py`
- Test: `packages/bedrock-api/tests/test_db_watcher.py`

**Delta Verification:**
- Command: `python -m pytest packages/bedrock-api/tests/test_db_watcher.py -q`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

```python
# packages/bedrock-api/tests/test_db_watcher.py
import sqlite3
from pathlib import Path
import pytest
from bedrock.core.db_watcher import DatabaseWatcher

def test_db_watcher_detects_delta_and_canary_counts(tmp_path: Path):
    db_file = tmp_path / "app.db"
    conn = sqlite3.connect(str(db_file))
    conn.execute("CREATE TABLE canary_items (id INT)")
    conn.execute("INSERT INTO canary_items VALUES (1)")
    conn.commit()
    conn.close()

    watcher = DatabaseWatcher(db_file, canary_tables=["canary_items"])
    counts = watcher.check_canaries()
    assert counts == {"canary_items": 1}

    stat = watcher.check_stat()
    assert stat is not None
    assert stat.size_bytes > 0
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `python -m pytest packages/bedrock-api/tests/test_db_watcher.py -q`  
Expected: ModuleNotFoundError / ImportError ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Implement `bedrock.core.db_watcher`**

```python
# packages/bedrock-api/bedrock/core/db_watcher.py
from __future__ import annotations
import os
import sqlite3
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence
from loguru import logger

try:
    import psutil
except ImportError:
    psutil = None

@dataclass(frozen=True)
class FileStat:
    size_bytes: int
    mtime: float

class DatabaseWatcher:
    def __init__(
        self,
        db_path: Path,
        canary_tables: Sequence[str] | None = None,
        poll_interval: float = 2.0,
        log_file: Path | None = None,
    ):
        self.db_path = db_path
        self.canary_tables = list(canary_tables or [])
        self.poll_interval = poll_interval
        self.log_file = log_file
        self._last_stat: FileStat | None = self.check_stat()

    def check_stat(self) -> FileStat | None:
        try:
            st = self.db_path.stat()
            return FileStat(size_bytes=st.st_size, mtime=st.st_mtime)
        except FileNotFoundError:
            return None

    def check_canaries(self) -> dict[str, int]:
        if not self.db_path.exists():
            return {}
        conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
        results = {}
        try:
            for tbl in self.canary_tables:
                try:
                    c = conn.execute(f'SELECT COUNT(*) FROM "{tbl}"').fetchone()[0]
                    results[tbl] = int(c)
                except sqlite3.DatabaseError:
                    results[tbl] = -1
        finally:
            conn.close()
        return results

    def inspect_process_handles(self) -> list[str]:
        if psutil is None:
            return ["psutil not installed"]
        target_real = os.path.realpath(self.db_path)
        hits = []
        for p in psutil.process_iter(["pid", "name", "cmdline"]):
            try:
                for f in p.open_files():
                    if os.path.realpath(f.path) == target_real:
                        cmd = " ".join(p.info.get("cmdline") or [])
                        hits.append(f"PID {p.info['pid']} ({p.info.get('name')}): {cmd[:150]}")
                        break
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                continue
        return hits

    def log_event(self, message: str) -> None:
        logger.info(message)
        if self.log_file:
            self.log_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(f"[{datetime.now(timezone.utc).isoformat()}] {message}\n")
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `python -m pytest packages/bedrock-api/tests/test_db_watcher.py -q`  
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Commit**

Command: `git commit -m "feat(bedrock-api): implement database file watcher and canary monitor"`

---

### Task 5: Database Admin API Endpoints & `bedrock.toml` Config Loader

- **Target Agent:** `@route-security-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-api/bedrock/tools/_config.py`
- Create: `packages/bedrock-api/bedrock/routes/database.py`
- Modify: `packages/bedrock-api/bedrock/core/app_factory.py` (register router)
- Test: `packages/bedrock-api/tests/test_routes_database.py`

**Delta Verification:**
- Command: `python -m pytest packages/bedrock-api/tests/test_routes_database.py -q`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

```python
# packages/bedrock-api/tests/test_routes_database.py
import pytest
from fastapi.testclient import TestClient

def test_database_admin_endpoints(client, admin_headers):
    # Backup
    res = client.post("/api/v1/admin/db/backup", headers=admin_headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["ok"] is True

    # List backups
    res_list = client.get("/api/v1/admin/db/backups", headers=admin_headers)
    assert res_list.status_code == 200
    assert len(res_list.json()["data"]) >= 1

    # Integrity check
    res_integ = client.post("/api/v1/admin/db/integrity", headers=admin_headers)
    assert res_integ.status_code == 200
    assert res_integ.json()["data"]["ok"] is True
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `python -m pytest packages/bedrock-api/tests/test_routes_database.py -q`  
Expected: 404 / Router not registered ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Implement config parser and `bedrock.routes.database`**

In `packages/bedrock-api/bedrock/tools/_config.py`:
Add `DbConfig` dataclass parsing `[db]` table with defaults for `path`, `backup_dir`, `backup_retention_count`, `diagnostics_module`, `canary_tables`, `watch_log_file`.

In `packages/bedrock-api/bedrock/routes/database.py`:
```python
from __future__ import annotations
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bedrock.core.backup import backup_database, list_backups, integrity_check
from bedrock.core.restore import restore_snapshot
from bedrock.dependencies import require_role
from bedrock.schemas.base import ApiResponse
from bedrock.tools._config import load_config

router = APIRouter(prefix="/api/v1/admin/db", tags=["Database Maintenance"], dependencies=[require_role("admin")])

class RestoreRequest(BaseModel):
    snapshot_path: str
    confirm_text: str

@router.post("/backup", response_model=ApiResponse)
def trigger_backup():
    cfg = load_config().db
    source = Path(cfg.path)
    dest_dir = Path(cfg.backup_dir)
    res = backup_database(source, dest_dir, keep=cfg.backup_retention_count)
    return ApiResponse(status="ok", data={"ok": res.ok, "path": str(res.path), "size_bytes": res.size_bytes, "duration_ms": res.duration_ms})

@router.get("/backups", response_model=ApiResponse)
def get_backups():
    cfg = load_config().db
    dest_dir = Path(cfg.backup_dir)
    items = list_backups(dest_dir)
    return ApiResponse(status="ok", data=[{"name": b.name, "path": str(b.path), "size_bytes": b.size_bytes, "modified_at": b.modified_at, "is_tagged": b.is_tagged, "tag": b.tag} for b in items])

@router.post("/integrity", response_model=ApiResponse)
def check_db_integrity():
    cfg = load_config().db
    ok, detail = integrity_check(Path(cfg.path))
    return ApiResponse(status="ok", data={"ok": ok, "detail": detail})

@router.post("/restore", response_model=ApiResponse)
def trigger_restore(req: RestoreRequest):
    if req.confirm_text != "RESTORE":
        raise HTTPException(status_code=400, detail="Explicit confirmation text 'RESTORE' required")
    cfg = load_config().db
    res = restore_snapshot(Path(req.snapshot_path), Path(cfg.path), safety_backup=True)
    return ApiResponse(status="ok", data={"ok": res.ok, "safety_backup": str(res.safety_backup_path) if res.safety_backup_path else None, "detail": res.detail})
```

Register `database.router` in `app_factory.py`.

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `python -m pytest packages/bedrock-api/tests/test_routes_database.py -q`  
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Commit**

Command: `git commit -m "feat(bedrock-api): add database maintenance admin routes and toml config loader"`

---

### Task 6: Unified CLI Dispatcher (`bedrock.tools.db`)

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-api/bedrock/tools/db/__init__.py`
- Create: `packages/bedrock-api/bedrock/tools/db/__main__.py`
- Create: `packages/bedrock-api/bedrock/tools/db/cli_backup.py`
- Create: `packages/bedrock-api/bedrock/tools/db/cli_restore.py`
- Create: `packages/bedrock-api/bedrock/tools/db/cli_diagnostics.py`
- Create: `packages/bedrock-api/bedrock/tools/db/cli_integrity.py`
- Create: `packages/bedrock-api/bedrock/tools/db/cli_watch.py`
- Test: `packages/bedrock-api/tests/test_db_tools_cli.py`

**Delta Verification:**
- Command: `python -m pytest packages/bedrock-api/tests/test_db_tools_cli.py -q`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

```python
# packages/bedrock-api/tests/test_db_tools_cli.py
import subprocess
import sys
import pytest

def test_cli_subcommands_help():
    for subcmd in ("backup", "list-backups", "restore", "diagnostics", "integrity", "watch"):
        cmd = [sys.executable, "-m", "bedrock.tools.db", subcmd, "--help"]
        p = subprocess.run(cmd, capture_output=True, text=True)
        assert p.returncode == 0, p.stderr
        assert "usage:" in p.stdout.lower()
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `python -m pytest packages/bedrock-api/tests/test_db_tools_cli.py -q`  
Expected: ModuleNotFoundError: No module named 'bedrock.tools.db' ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Implement `bedrock.tools.db` CLI package**

Author `__main__.py` with `argparse.ArgumentParser` subcommands routing to respective handler functions in `cli_*.py`.
In `cli_diagnostics.py`:
- Read `diagnostics_module` from `bedrock.toml` or `--module`.
- Dynamically import the module via `importlib.import_module` so domain checks register.
- Call `execute_diagnostics_run(triggered_by="cli", on_test_complete=print_live_progress)`.
- If `summary.failed > 0`, return exit code `1`. Else return `0`.

In `cli_backup.py`:
- Call `backup_database(db_path, dest_dir, keep)`. Return `0` on success, `1` on failure.

In `cli_restore.py`:
- Support `--snapshot` and `--salvage`. Return `0` on success, `1` on failure.

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `python -m pytest packages/bedrock-api/tests/test_db_tools_cli.py -q`  
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Commit**

Command: `git commit -m "feat(bedrock-tools): implement unified database maintenance CLI suite"`

---

### Task 7: Frontend Platform Hooks & TanStack Mutations

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-ui/src/hooks/useAdminPlatform.ts`
- Test: `packages/bedrock-ui/src/hooks/useAdminPlatform.test.ts`

**Delta Verification:**
- Command: `npm --prefix packages/bedrock-ui run test:run packages/bedrock-ui/src/hooks/useAdminPlatform.test.ts`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/bedrock-ui/src/hooks/useAdminPlatform.test.ts
import { describe, it, expect } from "vitest";
import { useDbBackups, useCreateDbBackup, useCheckDbIntegrity, useRestoreDb } from "./useAdminPlatform";

describe("useAdminPlatform DB maintenance hooks", () => {
  it("exports database maintenance hooks", () => {
    expect(useDbBackups).toBeDefined();
    expect(useCreateDbBackup).toBeDefined();
    expect(useCheckDbIntegrity).toBeDefined();
    expect(useRestoreDb).toBeDefined();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npm --prefix packages/bedrock-ui run test:run packages/bedrock-ui/src/hooks/useAdminPlatform.test.ts`  
Expected: FAIL - hooks not exported ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Implement hooks in `useAdminPlatform.ts`**

Export interfaces `DbBackupRecord`, `DbIntegrityResult`, and hooks:
- `useDbBackups()`: Query to `GET /api/v1/admin/db/backups`.
- `useCreateDbBackup()`: Mutation to `POST /api/v1/admin/db/backup`, invalidates `backups` and `dbSummary`.
- `useCheckDbIntegrity()`: Mutation to `POST /api/v1/admin/db/integrity`.
- `useRestoreDb()`: Mutation to `POST /api/v1/admin/db/restore`.

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npm --prefix packages/bedrock-ui run test:run packages/bedrock-ui/src/hooks/useAdminPlatform.test.ts`  
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Commit**

Command: `git commit -m "feat(bedrock-ui): add database maintenance query and mutation hooks"`

---

### Task 8: Reusable Admin Panels (`DiagnosticsPanel`, `AuditPanel`, `DatabaseMaintenancePanel`)

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-ui/src/components/admin/DiagnosticsPanel.tsx`
- Create: `packages/bedrock-ui/src/components/admin/AuditPanel.tsx`
- Create: `packages/bedrock-ui/src/components/admin/DatabaseMaintenancePanel.tsx`
- Modify: `packages/bedrock-ui/src/index.ts`
- Test: `packages/bedrock-ui/src/components/admin/__tests__/AdminPanels.test.tsx`

**Delta Verification:**
- Command: `npm --prefix packages/bedrock-ui run test:run packages/bedrock-ui/src/components/admin/__tests__/AdminPanels.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/bedrock-ui/src/components/admin/__tests__/AdminPanels.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DiagnosticsPanel from "../DiagnosticsPanel";
import AuditPanel from "../AuditPanel";
import DatabaseMaintenancePanel from "../DatabaseMaintenancePanel";

describe("Admin Panels", () => {
  it("renders panel headers and action buttons", () => {
    // Assert components render and provide export / trigger buttons
    expect(DiagnosticsPanel).toBeDefined();
    expect(AuditPanel).toBeDefined();
    expect(DatabaseMaintenancePanel).toBeDefined();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npm --prefix packages/bedrock-ui run test:run packages/bedrock-ui/src/components/admin/__tests__/AdminPanels.test.tsx`  
Expected: FAIL - components not found ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Implement components in `bedrock-ui`**

1. `DiagnosticsPanel.tsx`: Migrate MLBTracker's diagnostics runner UI, adding "Export as JSON" and "Export as CSV" actions.
2. `AuditPanel.tsx`: Migrate MLBTracker's audit runner and history UI with severity filters and CSV download.
3. `DatabaseMaintenancePanel.tsx`: Interactive dashboard combining table storage metrics, "Create Backup" button, backup history table, "Check DB Integrity" button with health badge, and guarded restore dialog.
4. Export all three panels from `packages/bedrock-ui/src/index.ts`.

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npm --prefix packages/bedrock-ui run test:run packages/bedrock-ui/src/components/admin/__tests__/AdminPanels.test.tsx`  
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Commit**

Command: `git commit -m "feat(bedrock-ui): export DiagnosticsPanel, AuditPanel, and DatabaseMaintenancePanel"`

---

### Task 9: Consumer Migration & Legacy Cleanup Guidance

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-api/bedrock/templates/scripts/run_diagnostics.bat`
- Create: `packages/bedrock-api/bedrock/templates/scripts/backup_db.bat`
- Modify: `docs/reference/consumer-migration-database-toolset.md`

**Delta Verification:**
- Command: `python -m bedrock.tools.run_all`
- Target runtime: `<60s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Create template runner scripts for consumers**

Create reusable batch scripts in `packages/bedrock-api/bedrock/templates/scripts/`:
- `run_diagnostics.bat`:
  ```cmd
  @echo off
  python -m bedrock.tools.db diagnostics %*
  exit /b %ERRORLEVEL%
  ```
- `backup_db.bat`:
  ```cmd
  @echo off
  python -m bedrock.tools.db backup %*
  exit /b %ERRORLEVEL%
  ```

- [ ] **Step 2: Document consumer migration guide**

Document step-by-step instructions for MLBTracker (#448, #449) and CollectIt:
- Retiring `find_query_usages` and `find_table_usages` to `docs/archive/`.
- Deleting `validate_inventory.py`.
- Moving `seed_log_event_types.py` into a formal migration.
- Replacing MLBTracker `AdminPage.tsx` hand-rolled panels with Bedrock components.

- [ ] **Step 3: Run platform audits**

Command: `python -m bedrock.tools.run_all`  
Expected: All platform audit gates PASS ($LASTEXITCODE -eq 0)

- [ ] **Step 4: Commit**

Command: `git commit -m "docs(bedrock): add consumer migration guidance and batch runner templates"`

---

### Task 10: Final Quality Audit, Spec & Plan Archiving, and PR Gate

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Files:**
- Move: `docs/specs/2026-10-05-database-maintenance-toolset-design.md` -> `docs/archive/specs/2026-10-05-database-maintenance-toolset-design.md`
- Move: `docs/plans/2026-10-05-database-maintenance-toolset.md` -> `docs/archive/plans/2026-10-05-database-maintenance-toolset.md`
- Move: `docs/plans/2026-10-05-database-maintenance-toolset-intake.json` -> `docs/archive/plans/2026-10-05-database-maintenance-toolset-intake.json`

**Delta Verification:**
- Command: `python -m pytest packages/bedrock-api/tests -q && npm --prefix packages/bedrock-ui run test:run`
- Target runtime: `<60s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Run full test suite for `bedrock-api` and `bedrock-ui`; confirm PASS with `$LASTEXITCODE -eq 0`
- [ ] Run platform audit suite (`python -m bedrock.tools.run_all`); confirm PASS with `$LASTEXITCODE -eq 0`
- [ ] Move supporting spec to archive: `git mv docs/specs/2026-10-05-database-maintenance-toolset-design.md docs/archive/specs/`
- [ ] Move implementation plan and companion intake JSON to archive:
      `git mv docs/plans/2026-10-05-database-maintenance-toolset.md docs/archive/plans/`
      `git mv docs/plans/2026-10-05-database-maintenance-toolset-intake.json docs/archive/plans/`
- [ ] Verify clean working tree (`git status --porcelain`)
- [ ] Commit archival and test confirmation (`git commit -m "chore(docs): archive database maintenance toolset spec, plan, and intake JSON per §S008"`)
