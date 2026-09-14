# Platform Remediation & Stability Implementation Plan (`bedrock v0.10.0`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 5 open bedrock GitHub issues and 2 consumer-identified cross-repository issues across `bedrock-api` and `bedrock-ui`, release `v0.10.0`, submit a GitHub PR, and create tracking issues in CollectIt and MLBTracker for their local adoptions.

**Architecture:** Implement targeted foundation fixes in `bedrock-api` (path normalization, environment override protection, SQLite busy timeout, and config key seeding), add bulk discard confirmation and interception to `bedrock-ui`'s `<GridHeader>`, establish a full `<DataGrid>` render testing harness upstream, and verify the full platform suite before cutting the unified release.

**Tech Stack:** Python 3.11+, FastAPI, SQLite/PostgreSQL, TypeScript 5+, React 18, TanStack Table v8, Vitest, Testing Library, Pytest.

**Spec:** [`docs/specs/2026-09-13-platform-remediation-v0-10-0-design.md`](file:///c:/Dev/bedrock/docs/specs/2026-09-13-platform-remediation-v0-10-0-design.md)

## Global Constraints

- Never commit directly to `master`; all changes land on a feature branch and merge via GitHub PR.
- Maintain zero broken tests across `packages/bedrock-api` and `packages/bedrock-ui`.
- Cross-platform path handling must use `os.path.normpath()` or `pathlib.Path` to prevent Windows/Linux separator divergence.
- Reusable platform code belongs in `bedrock`; domain-specific baseball or collectibles logic must never enter platform files.
- Package versions in `package.json` and `pyproject.toml` move together (`0.9.2` -> `0.10.0`).

---

## Tasks

### Task 1: Path Normalization & Domain Vocabulary Sanitization (Bedrock #51)

**Files:**
- Modify: `packages/bedrock-api/bedrock/core/paths.py:41-57`
- Modify: `packages/bedrock-api/tests/test_paths.py:106-112`

**Interfaces:**
- Consumes: `bedrock.core.paths.resolve_app_path(value, *default_parts)`
- Produces: Normalized absolute path string with OS-native path separators (`\` on Windows, `/` on POSIX).

- [x] **Step 1: Write the failing test**

Update `packages/bedrock-api/tests/test_paths.py` to assert that `resolve_app_path` yields normalized OS separators on relative paths containing forward slashes, and replace `"data/mlbtracker.db"` with `"data/test.db"`:

```python
    def test_env_override_is_honoured(self, monkeypatch, tmp_path):
        _, config = _reload(monkeypatch, str(tmp_path),
                            SQLITE_DB_PATH="data/test.db")
        expected = os.path.normpath(os.path.join(str(tmp_path), "data", "test.db"))
        assert config.config.SQLITE_DB_PATH == expected
```

- [x] **Step 2: Run test to verify failure / separator behavior**

Run: `pytest packages/bedrock-api/tests/test_paths.py::TestSqlitePath::test_env_override_is_honoured -v`
Expected: Passes or fails depending on slash matching, but confirms whether forward slashes survive unnormalized.

- [x] **Step 3: Write minimal implementation**

In `packages/bedrock-api/bedrock/core/paths.py`, wrap `resolve_app_path` in `os.path.normpath`:

```python
def resolve_app_path(value: str | None, *default_parts: str) -> str:
    """Resolve a configured path, treating a relative one as app-root-relative.

    Configured paths land here from `.env` files, where writing
    `data/app.db` is far more natural than an absolute path — and where a
    relative path resolved against the working directory would mean something
    different depending on where the process was started.

    :param value: The configured path, or None/empty to use the default.
    :param default_parts: Path segments, relative to the app root, used when
        `value` is not set.
    :returns: An absolute path.
    """
    if not value:
        return os.path.normpath(app_path(*default_parts))
    return os.path.normpath(value if os.path.isabs(value) else app_path(value))
```

- [x] **Step 4: Run tests to verify they pass**

Run: `pytest packages/bedrock-api/tests/test_paths.py -v`
Expected: 18 passed.

- [x] **Step 5: Commit**

```bash
git add packages/bedrock-api/bedrock/core/paths.py packages/bedrock-api/tests/test_paths.py
git commit -m "fix(paths): normalize separators on Windows and purge domain fixture string (bedrock#51)"
```

---

### Task 2: Preserve Injected DB Environment Across `load_dotenv` (Bedrock #74)

**Files:**
- Modify: `packages/bedrock-api/bedrock/core/config.py:21-29`
- Modify: `packages/bedrock-api/bedrock/core/logging.py:14-21`
- Modify: `packages/bedrock-api/bedrock/services/oauth_service.py:38-46`
- Test: `packages/bedrock-api/tests/test_paths.py`

**Interfaces:**
- Consumes: `os.environ.get("SQLITE_DB_PATH")`, `os.environ.get("DATABASE_URL")`, `os.environ.get("BEDROCK_DATA_DIR")`
- Produces: Guaranteed retention of command-line/test-injected database target over `.env` default.

- [x] **Step 1: Write the failing test**

Add `test_injected_sqlite_path_survives_dotenv_override` in `packages/bedrock-api/tests/test_paths.py`:

```python
    def test_injected_sqlite_path_survives_dotenv_override(self, monkeypatch, tmp_path):
        """When an application has a .env setting SQLITE_DB_PATH, an explicit
        SQLITE_DB_PATH in the environment must not be clobbered by load_dotenv."""
        env_file = tmp_path / ".env"
        env_file.write_text("SQLITE_DB_PATH=data/production_app.db\n", encoding="utf-8")

        # Explicit override injected into environment before module reload:
        monkeypatch.setenv("SQLITE_DB_PATH", "data/test_injected.db")
        _, config = _reload(monkeypatch, str(tmp_path))

        expected = os.path.normpath(os.path.join(str(tmp_path), "data", "test_injected.db"))
        assert config.config.SQLITE_DB_PATH == expected
```

- [x] **Step 2: Run test to verify it fails**

Run: `pytest packages/bedrock-api/tests/test_paths.py::TestSqlitePath::test_injected_sqlite_path_survives_dotenv_override -v`
Expected: FAIL with `AssertionError: .../data/production_app.db != .../data/test_injected.db`

- [x] **Step 3: Write minimal implementation**

In `packages/bedrock-api/bedrock/core/config.py`:
Capture injected variables before `load_dotenv(override=True)` and restore if overridden:

```python
_PRESERVED_ENV_KEYS = ("SQLITE_DB_PATH", "DATABASE_URL", "BEDROCK_DATA_DIR")
_pre_env = {k: os.environ[k] for k in _PRESERVED_ENV_KEYS if k in os.environ}

load_dotenv(app_path(".env"), override=True)

for k, val in _pre_env.items():
    if os.environ.get(k) != val:
        os.environ[k] = val

_DATA_DIR = resolve_app_path(os.environ.get("BEDROCK_DATA_DIR"), "data")
_SQLITE_ENV = os.environ.get("SQLITE_DB_PATH")
```

Apply the same environment protection in `packages/bedrock-api/bedrock/core/logging.py` and `packages/bedrock-api/bedrock/services/oauth_service.py`.

- [x] **Step 4: Run test to verify it passes**

Run: `pytest packages/bedrock-api/tests/test_paths.py::TestSqlitePath::test_injected_sqlite_path_survives_dotenv_override -v`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add packages/bedrock-api/bedrock/core/config.py packages/bedrock-api/bedrock/core/logging.py packages/bedrock-api/bedrock/services/oauth_service.py packages/bedrock-api/tests/test_paths.py
git commit -m "fix(config): preserve injected db environment variables across load_dotenv (bedrock#74)"
```

---

### Task 3: SQLite Connection Concurrency & Busy Timeout (CollectIt #60)

**Files:**
- Modify: `packages/bedrock-api/bedrock/core/database.py:174-192`
- Create: `packages/bedrock-api/tests/test_sqlite_busy_timeout.py`

**Interfaces:**
- Consumes: `os.environ.get("SQLITE_BUSY_TIMEOUT", "30.0")`
- Produces: SQLite connections configured with timeout and `PRAGMA busy_timeout = <ms>`.

- [ ] **Step 1: Write the failing test**

Create `packages/bedrock-api/tests/test_sqlite_busy_timeout.py`:

```python
from __future__ import annotations
import sqlite3
from bedrock.core.database import db

def test_sqlite_connection_has_busy_timeout_configured():
    with db.get_connection() as conn:
        if isinstance(conn, sqlite3.Connection):
            cur = conn.execute("PRAGMA busy_timeout;")
            row = cur.fetchone()
            # Default busy_timeout should be at least 30000 ms (30s)
            assert row[0] >= 30000
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest packages/bedrock-api/tests/test_sqlite_busy_timeout.py -v`
Expected: FAIL (default SQLite PRAGMA busy_timeout is 0 or 5000).

- [ ] **Step 3: Write minimal implementation**

In `packages/bedrock-api/bedrock/core/database.py`, update `_create_sqlite_connection`:

```python
    def _create_sqlite_connection(self, *, explicit_transactions: bool = False
                                  ) -> sqlite3.Connection:
        timeout_sec = float(os.environ.get("SQLITE_BUSY_TIMEOUT", 30.0))
        conn = sqlite3.connect(
            self.sqlite_path,
            timeout=timeout_sec,
            isolation_level=None if explicit_transactions else "",
        )
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute(f"PRAGMA busy_timeout = {int(timeout_sec * 1000)};")
        return conn
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest packages/bedrock-api/tests/test_sqlite_busy_timeout.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bedrock-api/bedrock/core/database.py packages/bedrock-api/tests/test_sqlite_busy_timeout.py
git commit -m "fix(database): configure sqlite busy timeout to eliminate concurrency contention (CollectIt#60)"
```

---

### Task 4: Platform Config Keys Seeding (Bedrock #50)

**Files:**
- Modify: `packages/bedrock-api/bedrock/schema/baseline.sql:98-100`
- Create: `packages/bedrock-api/bedrock/schema/migrations/008_seed_platform_config_keys.sql`
- Modify: `packages/bedrock-api/tests/test_admin_config_service.py`

**Interfaces:**
- Consumes: `app_config_settings` table
- Produces: 11 seeded platform settings rows discoverable in Admin UI (`category='system'`, `'diagnostics'`).

- [ ] **Step 1: Write the failing test**

In `packages/bedrock-api/tests/test_admin_config_service.py`, add a test verifying platform config keys exist:

```python
def test_platform_default_config_keys_are_seeded():
    expected_keys = [
        "rate_limit_login",
        "rate_limit_register",
        "rate_limit_oauth_callback",
        "rate_limit_password_reset",
        "mail_from_address",
        "mail_from_name",
        "system_base_url",
        "seo_allow_indexing",
        "diagnostics_retention_days",
        "diagnostics_schedule_enabled",
        "diagnostics_schedule_time",
    ]
    df = db.query("SELECT key FROM app_config_settings WHERE key IN (" + ",".join([f"'{k}'" for k in expected_keys]) + ")")
    found = set(df["key"].tolist()) if not df.empty else set()
    missing = set(expected_keys) - found
    assert not missing, f"Missing seeded config keys: {missing}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest packages/bedrock-api/tests/test_admin_config_service.py -k test_platform_default_config_keys_are_seeded -v`
Expected: FAIL with missing seeded keys.

- [ ] **Step 3: Write minimal implementation**

Create `packages/bedrock-api/bedrock/schema/migrations/008_seed_platform_config_keys.sql`:

```sql
-- Migration 008: Seed platform configuration keys
-- Resolves bedrock#50: platform keys read via db.get_config must be discoverable in admin console.

INSERT OR IGNORE INTO app_config_settings (key, value, value_type, description, category) VALUES
    ('rate_limit_login', '10/minute', 'string', 'Rate limit for user login attempts', 'system'),
    ('rate_limit_register', '5/minute', 'string', 'Rate limit for account registration', 'system'),
    ('rate_limit_oauth_callback', '10/minute', 'string', 'Rate limit for OAuth callback handshakes', 'system'),
    ('rate_limit_password_reset', '5/hour', 'string', 'Rate limit for password reset requests', 'system'),
    ('mail_from_address', '', 'string', 'Default From email address for transactional emails', 'system'),
    ('mail_from_name', '', 'string', 'Default From display name for transactional emails', 'system'),
    ('system_base_url', '', 'string', 'Public base URL of the application for link generation', 'system'),
    ('seo_allow_indexing', 'true', 'boolean', 'Allow search engine web crawlers to index public pages', 'system'),
    ('diagnostics_retention_days', '60', 'integer', 'Number of days to retain diagnostic test execution history', 'diagnostics'),
    ('diagnostics_schedule_enabled', 'false', 'boolean', 'Whether daily automated diagnostic checks are enabled', 'diagnostics'),
    ('diagnostics_schedule_time', '02:00', 'string', 'Daily scheduled time (HH:MM UTC) for automated diagnostic checks', 'diagnostics');
```

Add these same `INSERT OR IGNORE` seed rows to `packages/bedrock-api/bedrock/schema/baseline.sql` right after `CREATE TABLE IF NOT EXISTS app_config_settings`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest packages/bedrock-api/tests/test_admin_config_service.py -k test_platform_default_config_keys_are_seeded -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/bedrock-api/bedrock/schema/baseline.sql packages/bedrock-api/bedrock/schema/migrations/008_seed_platform_config_keys.sql packages/bedrock-api/tests/test_admin_config_service.py
git commit -m "feat(schema): seed platform config keys in baseline and migration 008 (bedrock#50)"
```

---

### Task 5: `<GridHeader>` Guarded Discard & Custom Interception (Bedrock #55)

**Files:**
- Modify: `packages/bedrock-ui/src/components/grids/GridHeader.tsx`
- Modify: `packages/bedrock-ui/src/components/grids/DataGrid.tsx`
- Create: `packages/bedrock-ui/src/components/grids/GridHeaderDiscard.test.tsx`

**Interfaces:**
- Consumes: `onBulkDiscard?: () => void | Promise<void>`, `confirmBulkDiscard?: boolean`, `onBeforeBulkDiscard?: () => boolean | Promise<boolean>`
- Produces: Guarded Discard button in `<GridHeader>` opening an `AlertDialog` before destroying staged edits.

- [ ] **Step 1: Write the failing test**

Create `packages/bedrock-ui/src/components/grids/GridHeaderDiscard.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GridHeader from "./GridHeader";

describe("GridHeader Discard Guarding", () => {
  it("opens confirmation dialog when clicking discard and executes on confirm", async () => {
    const onDiscard = vi.fn();
    render(
      <GridHeader
        gridId="test-grid"
        bulkDraftCount={5}
        onBulkDiscard={onDiscard}
        confirmBulkDiscard={true}
      />
    );

    const discardBtn = screen.getByRole("button", { name: /discard/i });
    fireEvent.click(discardBtn);

    expect(screen.getByText(/discard unsaved changes\?/i)).toBeInTheDocument();
    expect(onDiscard).not.toHaveBeenCalled();

    const confirmBtn = screen.getByRole("button", { name: /discard changes/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onDiscard).toHaveBeenCalledTimes(1);
    });
  });

  it("bypasses confirmation dialog when confirmBulkDiscard is false", () => {
    const onDiscard = vi.fn();
    render(
      <GridHeader
        gridId="test-grid"
        bulkDraftCount={5}
        onBulkDiscard={onDiscard}
        confirmBulkDiscard={false}
      />
    );

    const discardBtn = screen.getByRole("button", { name: /discard/i });
    fireEvent.click(discardBtn);

    expect(screen.queryByText(/discard unsaved changes\?/i)).not.toBeInTheDocument();
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/bedrock-ui/src/components/grids/GridHeaderDiscard.test.tsx`
Expected: FAIL (`confirmBulkDiscard` prop not implemented and dialog does not open).

- [ ] **Step 3: Write minimal implementation**

1. In `packages/bedrock-ui/src/components/grids/GridHeader.tsx`:
   - Import `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction` from `../ui/alert-dialog`.
   - Add props `onBulkDiscard`, `confirmBulkDiscard = true`, `onBeforeBulkDiscard`.
   - Manage `const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);`.
   - On Discard click: if `confirmBulkDiscard` is true, set dialog open. Otherwise execute discard logic.
   - On dialog confirm: call `onBeforeBulkDiscard?.()`; if true or undefined, call `onBulkDiscard?.()`.

2. In `packages/bedrock-ui/src/components/grids/DataGrid.tsx`:
   - Add `onBulkDiscard`, `confirmBulkDiscard`, `onBeforeBulkDiscard` to `DataGridProps`.
   - Forward `onBulkDiscard={props.onBulkDiscard ?? (bulkMode ? discardBulkDrafts : undefined)}`.
   - Forward `confirmBulkDiscard={props.confirmBulkDiscard ?? true}`.
   - Forward `onBeforeBulkDiscard={props.onBeforeBulkDiscard}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/bedrock-ui/src/components/grids/GridHeaderDiscard.test.tsx`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add packages/bedrock-ui/src/components/grids/GridHeader.tsx packages/bedrock-ui/src/components/grids/DataGrid.tsx packages/bedrock-ui/src/components/grids/GridHeaderDiscard.test.tsx
git commit -m "feat(grids): add discard confirmation dialog and custom interception to GridHeader (bedrock#55)"
```

---

### Task 6: `<DataGrid>` Render-Level Test Harness & Test Migration (Bedrock #49 / MLBTracker #387)

**Files:**
- Create: `packages/bedrock-ui/src/test/gridMocks.ts`
- Create: `packages/bedrock-ui/src/test/test-utils.tsx`
- Modify: `packages/bedrock-ui/src/components/grids/DataGrid.test.tsx`

**Interfaces:**
- Consumes: `DataGrid`, `useGridConfig`, `buildGridConfig`
- Produces: Complete upstream test coverage for `<DataGrid>` rendering, row key enforcement, column selection, pagination, and sorting.

- [ ] **Step 1: Create test utilities and mock factories**

In `packages/bedrock-ui/src/test/gridMocks.ts`:
- Create `makeGridConfig(overrides: Partial<GridConfig>): GridConfig`
- Create `makeColumnSetting(overrides: Partial<GridColumnSetting>): GridColumnSetting`

In `packages/bedrock-ui/src/test/test-utils.tsx`:
- Create `renderWithGridProviders(ui: React.ReactElement)` wrapping `QueryClientProvider` and `MemoryRouter`, and polyfilling `ResizeObserver`, `offsetHeight`, `offsetWidth`.

- [ ] **Step 2: Add engine tests to `DataGrid.test.tsx`**

Port the engine test suites from MLBTracker into `packages/bedrock-ui/src/components/grids/DataGrid.test.tsx`:
- Throws error if `rowKeyColumn` is missing/null.
- Renders selection checkbox column and respects `selectionOptions.max`.
- Selection positioning (`start` vs `end`).
- Page size change updates rendered row slice.
- Density toggle switches table padding.
- Column visibility toggling hides/shows headers and cells.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx vitest run packages/bedrock-ui/src/components/grids/DataGrid.test.tsx`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/bedrock-ui/src/test/gridMocks.ts packages/bedrock-ui/src/test/test-utils.tsx packages/bedrock-ui/src/components/grids/DataGrid.test.tsx
git commit -m "test(grids): establish DataGrid render-level test harness and migrate engine test suite (bedrock#49)"
```

---

### Task 7: Full Platform Verification, Version Bump to `v0.10.0`, PR Creation, & Consumer Issue Tracking

**Files:**
- Modify: `package.json` (version `0.9.2` -> `0.10.0`)
- Modify: `packages/bedrock-api/pyproject.toml` (version `0.9.2` -> `0.10.0`)

- [ ] **Step 1: Bump version numbers**

Update `version` to `"0.10.0"` in `package.json` and `packages/bedrock-api/pyproject.toml`.

- [ ] **Step 2: Run full verification suites**

Run:
```bash
pytest packages/bedrock-api/tests/
npm run build
npm run test:run
```
Confirm all pass with exit code 0.

- [ ] **Step 3: Commit version bump**

```bash
git add package.json packages/bedrock-api/pyproject.toml
git commit -m "chore(release): bump bedrock packages to v0.10.0 for platform remediation"
```

- [ ] **Step 4: Push branch and create Pull Request**

Push the feature branch and open a GitHub PR against `master`:
```bash
git push -u origin feat/v0.10.0-platform-remediation
gh pr create --title "feat: platform remediation v0.10.0" --body "Consolidates and resolves bedrock issues #49, #50, #51, #55, #74, CollectIt #60, and MLBTracker #387."
```

- [ ] **Step 5: Create adoption issues in CollectIt and MLBTracker**

Create adoption tracking issue in `djntechnic/CollectIt`:
```bash
gh issue create --repo djntechnic/CollectIt --title "[Adoption] Adopt bedrock v0.10.0: resolve entry 13 (GridHeader discard) and entry 15 (load_dotenv override)" --body "Adopt bedrock v0.10.0 to eliminate local workarounds for Bedrock #55 and Bedrock #74, and verify SQLite busy timeout resolves test_reserve_seq flakes (CollectIt #60)."
```

Create adoption tracking issue in `djntechnic/MLBTracker`:
```bash
gh issue create --repo djntechnic/MLBTracker --title "[Adoption] Adopt bedrock v0.10.0: retire in-tree DataGrid tests and adopt config seeds" --body "Adopt bedrock v0.10.0 to delete in-tree DataGrid.test.tsx (Bedrock #49), resolve MLBTracker #387, and delete resolved entries from bedrock_issues_to_file.md."
```
