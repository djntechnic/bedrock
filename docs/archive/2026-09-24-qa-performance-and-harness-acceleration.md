# QA Performance and Harness Acceleration Implementation Plan

> **Delivery via Triage Plan:** Hand off this plan directly to the `/triage-plan` skill:
> ```pwsh
> /triage-plan docs/plans/2026-09-24-qa-performance-and-harness-acceleration.md
> ```
> This ingests discrete tasks, maps domain-to-agent delegations, injects runtime invariants
> (active virtualenv/python, direct exit status, lockstep pins, <30s delta testing), and supervises execution.

**Goal:** Implement platform-level SQLite pragma configuration, granular test execution performance telemetry, pruned filesystem traversal for audits, and test logger controls in Bedrock, cutting consumer test harness overhead by >60%.

**Architecture:** In `bedrock-api`, introduce a safe, whitelist-validated SQLite pragma injection hook in `DatabaseManager` and `config`, plus a high-precision `pytest_timings` telemetry plugin. In `bedrock.tools`, implement pruned in-place `os.walk` directory traversal (`iter_source_files`) and memoized manifest caching across audits. In `@djntechnic/bedrock-ui`, add test-environment awareness and a public `setLogLevel` control for the Pino logger.

**Tech Stack:** Python 3.11, FastAPI, SQLite3, Pytest, TypeScript, Vite, Pino, Loguru.

**Spec:** `docs/specs/2026-09-24-qa-performance-and-harness-acceleration-design.md`

## Global Constraints

- **Python Floor:** Python 3.11+; no bare string formatting into SQL queries (§S007).
- **Pragma Whitelist:** Pragma keys must be strictly validated against `ALLOWED_SQLITE_PRAGMAS` (`journal_mode`, `synchronous`, `cache_size`, `temp_store`, `mmap_size`, `locking_mode`, `wal_autocheckpoint`); pragma values must match `^[A-Za-z0-9_-]+$`.
- **Platform Invariants:** In `_create_sqlite_connection`, `PRAGMA foreign_keys = ON;` and `PRAGMA busy_timeout = ...;` remain unconditionally enforced.
- **Audit Parity (§S001–§S015, §S100):** Audits migrated to `iter_source_files` must produce identical violation outputs to baseline runs on the same tree.
- **Dual-Pin Version Agreement (§S012, §S015):** `bedrock-api` (`pyproject.toml`) and `@djntechnic/bedrock-ui` (`package.json`) bump versions in unison (`0.10.3` -> `0.10.4`) with audited changelog headings.
- **Logging Standards (§S003):** No raw `console.*` or `print()` calls in production packages; Pino and Loguru only.

## Review Focus

1. **Pragma Injection Attack Surface:** An untrusted or malformed pragma setting injected via environment variables must be rejected cleanly without executing arbitrary SQL. (Pinned to Task 1: `test_sqlite_pragmas_injection_rejection`)
2. **Missing Sidecar Teardown Leaks:** WAL mode generates `-wal` and `-shm` sidecars next to temporary databases. Database teardown and close routines must handle sidecar existence without leaving orphaned locked files or attempting to delete non-temp paths. (Pinned to Task 1: `test_sqlite_wal_sidecars_cleanup`)
3. **Audit Directory False-Positive Pruning:** `iter_source_files` must prune only defined ignored directories (`.venv`, `node_modules`, `.git`, etc.) and data asset directories when configured, never accidentally skipping legitimate source packages like `packages/bedrock-api`. (Pinned to Task 3: `test_iter_source_files_preserves_nested_sources`)
4. **Telemetry Timing Clock Skew:** Pytest telemetry must use monotonic high-resolution counters (`time.perf_counter_ns()`) to calculate durations, avoiding negative or skewed phase times if system clock synchronizes during test execution. (Pinned to Task 2: `test_pytest_timings_monotonic_durations`)
5. **Logger Test Auto-Detection Failure:** When imported in Vitest or Node test workers without explicit browser `window`, the logger must automatically default to silent mode without throwing `ReferenceError` on missing browser globals. (Pinned to Task 5: `packages/bedrock-ui/src/utils/logger.test.ts`)

---

### Task 1: Configurable SQLite Pragmas Hook in `bedrock-api`

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-api/bedrock/core/config.py`
- Modify: `packages/bedrock-api/bedrock/core/database.py`
- Test: `packages/bedrock-api/tests/test_database.py`

**Interface Contract:**
- Consumes: `bedrock.core.config`
- Produces:
  ```python
  # bedrock.core.config
  SQLITE_PRAGMAS: dict[str, str | int]

  # bedrock.core.database
  ALLOWED_SQLITE_PRAGMAS: frozenset[str] = frozenset({
      "journal_mode",
      "synchronous",
      "cache_size",
      "temp_store",
      "mmap_size",
      "locking_mode",
      "wal_autocheckpoint",
  })

  def parse_sqlite_pragmas(raw: str | dict[str, Any] | None) -> dict[str, str | int]: ...

  class DatabaseManager:
      def __init__(self, ..., sqlite_pragmas: dict[str, str | int] | None = None) -> None: ...
      def configure_sqlite_pragmas(self, pragmas: dict[str, str | int]) -> None: ...
  ```
- Platform standards touched: §S004 (no hardcoded config settings), §S007 (secure SQL execution).

**Delta Verification:**
- Command: `pytest packages/bedrock-api/tests/test_database.py -k "pragma" -q`
- Target runtime: `<15s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Write the failing tests in `test_database.py`:
  - `test_sqlite_pragmas_applied_on_connection`: verify WAL and NORMAL pragmas are set on newly acquired connections.
  - `test_sqlite_pragmas_injection_rejection`: verify disallowed pragmas and non-alphanumeric values raise `ValueError` or are safely rejected.
  - `test_sqlite_pragmas_env_parsing`: verify `BEDROCK_SQLITE_PRAGMAS` environment variable parsing.
- [ ] Run delta verification command; confirm FAIL
- [ ] Implement `SQLITE_PRAGMAS` in `config.py` with `BEDROCK_SQLITE_PRAGMAS` parsing.
- [ ] Implement `ALLOWED_SQLITE_PRAGMAS`, `parse_sqlite_pragmas`, and update `_create_sqlite_connection` and `DatabaseManager` in `database.py`.
- [ ] Run delta verification command; confirm PASS with `$LASTEXITCODE -eq 0`
- [ ] Commit (`git commit -m "feat(bedrock-api): add configurable SQLite pragmas hook"`)

---

### Task 2: Granular Test Execution Performance Telemetry Plugin

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-api/bedrock/tools/pytest_timings.py`
- Test: `packages/bedrock-api/tests/test_pytest_timings.py`

**Interface Contract:**
- Consumes: `pytest` hook specifications (`pytest_runtest_protocol`, `pytest_runtest_makereport`, `pytest_sessionfinish`)
- Produces:
  ```python
  # bedrock.tools.pytest_timings
  class TestTimingRecord(TypedDict):
      id: str
      suite: str
      file: str
      status: str
      start_epoch_ms: int
      end_epoch_ms: int
      duration_ms: float
      phases: dict[str, float]  # setup_ms, call_ms, teardown_ms

  def pytest_runtest_protocol(item, nextitem) -> None: ...
  def pytest_runtest_makereport(item, call) -> None: ...
  def pytest_sessionfinish(session, exitstatus) -> None: ...
  ```
- Writes structured raw telemetry to `.qa-perf/backend-raw.json` (or path configured via `QA_PERF_OUTPUT`).

**Delta Verification:**
- Command: `pytest packages/bedrock-api/tests/test_pytest_timings.py -q`
- Target runtime: `<15s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Write failing test in `test_pytest_timings.py`:
  - `test_pytest_timings_captures_granular_phases`: execute a dummy test via `pytest.main(["-p", "bedrock.tools.pytest_timings"])` and verify `.qa-perf/backend-raw.json` contains test id, timestamps, monotonic durations, and phase breakdown.
- [ ] Run delta verification command; confirm FAIL
- [ ] Implement `packages/bedrock-api/bedrock/tools/pytest_timings.py` using `time.perf_counter_ns()` and `time.time()`.
- [ ] Run delta verification command; confirm PASS with `$LASTEXITCODE -eq 0`
- [ ] Commit (`git commit -m "feat(bedrock-tools): add granular pytest execution timing plugin"`)

---

### Task 3: Pruned File Traversal & Memoized Manifest Cache in `bedrock.tools`

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-api/bedrock/tools/_config.py`
- Modify: `packages/bedrock-api/bedrock/tools/run_all.py`
- Test: `packages/bedrock-api/tests/test_tools_config.py`

**Interface Contract:**
- Consumes: `DEFAULT_IGNORED_DIRS`, `DATA_ASSET_DIRS`
- Produces:
  ```python
  # bedrock.tools._config
  def iter_source_files(
      root: Path,
      suffixes: tuple[str, ...],
      include_assets: bool = False,
  ) -> list[Path]: ...

  def clear_source_cache() -> None: ...
  ```
- Platform standards touched: §S001–§S015 (ensures consistent file discovery across all platform audit gates).

**Delta Verification:**
- Command: `pytest packages/bedrock-api/tests/test_tools_config.py -q`
- Target runtime: `<15s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Write failing tests in `test_tools_config.py`:
  - `test_iter_source_files_prunes_ignored_directories`: create dummy tree containing `.venv/a.py`, `node_modules/b.js`, `src/app.py` and verify `.venv` and `node_modules` are never traversed.
  - `test_iter_source_files_preserves_nested_sources`: verify valid nested source directories are matched.
  - `test_iter_source_files_handles_data_assets`: verify `DATA_ASSET_DIRS` are excluded by default and included when `include_assets=True`.
- [ ] Run delta verification command; confirm FAIL
- [ ] Implement `iter_source_files` in `_config.py` using in-place `dirnames[:] = [d for d in dirnames if d not in ignored]` via `os.walk`.
- [ ] Add `@functools.lru_cache` memoization to `load_config` in `_config.py` and inventory caching in `run_all.py`.
- [ ] Run delta verification command; confirm PASS with `$LASTEXITCODE -eq 0`
- [ ] Commit (`git commit -m "feat(bedrock-tools): implement pruned directory traversal in _config"`)

---

### Task 4: Refactor Platform Audits S001–S015 to `iter_source_files`

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-api/bedrock/tools/s001_audit_duplicates.py`
- Modify: `packages/bedrock-api/bedrock/tools/s002_audit_grids.py`
- Modify: `packages/bedrock-api/bedrock/tools/s003_audit_logging.py`
- Modify: `packages/bedrock-api/bedrock/tools/s004_audit_config.py`
- Modify: `packages/bedrock-api/bedrock/tools/s005_audit_testing.py`
- Modify: `packages/bedrock-api/bedrock/tools/s007_audit_schema_catalog.py`
- Modify: `packages/bedrock-api/bedrock/tools/s008_audit_guidance.py`
- Modify: `packages/bedrock-api/bedrock/tools/s009_audit_design_tokens.py`
- Modify: `packages/bedrock-api/bedrock/tools/s010_audit_security.py`
- Modify: `packages/bedrock-api/bedrock/tools/s011_audit_navigation.py`
- Test: `packages/bedrock-api/tests/test_audit_s001_to_s004.py`
- Test: `packages/bedrock-api/tests/test_audit_s005_to_s008.py`
- Test: `packages/bedrock-api/tests/test_audit_s009_to_s012.py`

**Interface Contract:**
- Consumes: `from bedrock.tools._config import iter_source_files`
- Replaces: Direct `root.rglob(...)` calls in each audit module with `iter_source_files(root, suffixes=...)`.
- Platform standards touched: §S001–§S015 audit suites.

**Delta Verification:**
- Command: `pytest packages/bedrock-api/tests/test_audit_s001_to_s004.py -q`
- Target runtime: `<20s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Inspect existing `rglob` usage across `s001` through `s011`.
- [ ] Replace `rglob` invocations with `iter_source_files(root, ...)`.
- [ ] Run delta verification commands across audit tests; confirm all pass with `$LASTEXITCODE -eq 0`.
- [ ] Execute `python -m bedrock.tools.run_all` before and after on `C:\Dev\bedrock` and verify violation output remains identical.
- [ ] Commit (`git commit -m "refactor(bedrock-tools): migrate audits S001-S011 to iter_source_files"`)

---

### Task 5: Frontend Pino Logger Test Silence Hook in `@djntechnic/bedrock-ui`

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-ui/src/utils/logger.ts`
- Modify: `packages/bedrock-ui/src/index.ts`
- Test: `packages/bedrock-ui/src/utils/logger.test.ts`

**Interface Contract:**
- Consumes: `pino`, `appSettings`
- Produces:
  ```typescript
  // packages/bedrock-ui/src/utils/logger.ts
  export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  export function setLogLevel(level: LogLevel): void;
  export function getLogLevel(): LogLevel;
  ```
- Automatically detects `process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST)` and sets default level to `'silent'`.
- Platform standards touched: §S001 (reusable frontend library), §S003 (logging protocol).

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/utils/logger.test.ts`
- Target runtime: `<15s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Write failing test in `packages/bedrock-ui/src/utils/logger.test.ts` asserting `setLogLevel` alters `log.level` and test environment defaults to `silent`.
- [ ] Run delta verification command; confirm FAIL
- [ ] Implement `setLogLevel`, `getLogLevel`, and test environment auto-detection in `packages/bedrock-ui/src/utils/logger.ts`.
- [ ] Export `setLogLevel`, `getLogLevel`, `LogLevel` from `packages/bedrock-ui/src/index.ts`.
- [ ] Run delta verification command; confirm PASS with `$LASTEXITCODE -eq 0`.
- [ ] Rebuild `@djntechnic/bedrock-ui` (`npm run build`).
- [ ] Commit (`git commit -m "feat(bedrock-ui): add test silence mode and setLogLevel to logger"`)

---

### Task 6: Platform Verification, Version Bump & Release Preparation

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-api/pyproject.toml`
- Modify: `package.json`
- Modify: `CHANGELOG.md`

**Interface Contract:**
- Bumps `bedrock-api` version: `0.10.3` -> `0.10.4`.
- Bumps `@djntechnic/bedrock-ui` version: `0.10.3` -> `0.10.4`.
- Updates `CHANGELOG.md` with sections following §S015 order:
  - `Added / Changed`
  - `Platform Maintenance`
  - `For consumers` (detailing `/bump-bedrock-pin` guidance for WAL/NORMAL and telemetry).

**Delta Verification:**
- Command: `pytest packages/bedrock-api/tests/test_audit_release_version.py packages/bedrock-api/tests/test_audit_s015_release_notes.py -q`
- Target runtime: `<15s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Run complete platform audit gate: `python -m bedrock.tools.run_all`.
- [ ] Bump versions in `pyproject.toml` and `package.json` to `0.10.4`.
- [ ] Add changelog entry for `0.10.4` adhering to §S015.
- [ ] Run delta verification commands; confirm PASS with `$LASTEXITCODE -eq 0`.
- [ ] Commit (`git commit -m "chore(release): prepare Bedrock v0.10.4 release artifacts"`)

---

## Execution Handoff

Spec and plan are now committed on this feature branch (`feat/qa-performance-platform-acceleration`).

**1. Open a PR to check in the spec and plan to master:**
```pwsh
gh pr create --title "docs(perf): QA performance and harness acceleration spec and plan" --body "Architectural specification and discrete implementation plan for Bedrock platform acceleration (SQLite pragma hooks, test telemetry, pruned audit traversal, logger silence controls)." --draft
```

**2. Switch to updated master and create a fresh feature implementation branch:**
```pwsh
git checkout master && git pull origin master && git checkout -b feat/qa-performance-platform-acceleration-impl
```

**3. Execute implementation tasks via `/triage-plan`:**
```pwsh
/triage-plan docs/plans/2026-09-24-qa-performance-and-harness-acceleration.md
```

Triage-plan will resolve tasks to registered specialist agents, enforce runtime invariants (active virtualenv/python, direct exit status, lockstep pins, <30s delta testing), and supervise execution via `/deliver-task`.
