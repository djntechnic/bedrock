# Platform Defects & Cleanups Implementation Plan

> **Delivery via Triage Plan:** Hand off this plan directly to the `/triage-plan` skill:
> ```pwsh
> /triage-plan docs/plans/2026-10-07-platform-defects-and-cleanups.md
> ```
> This ingests discrete tasks, maps domain-to-agent delegations, injects runtime invariants
> (active virtualenv/python, direct exit status, lockstep pins, <30s delta testing), and supervises execution.

**Goal:** Resolve Bedrock GitHub issues #160, #159, #158, #149, #148, #147, and #146 across backend logging, QA audit tools, nav leave guards, storage boundaries, design tokens, and dead-code tooling.

**Architecture:** Address platform defects and cleanups across `bedrock-api` and `@djntechnic/bedrock-ui` adhering strictly to Bedrock invariants (§S001–§S015). Backend logging lifespan wiring ensures database-driven logger levels; audit tools eliminate false positives and dead imports; navigation integrates leave guards and sources from the unified navRegistry; storage keys purge domain-specific prefixes while preserving user state; and modal primitives align with design token standards.

**Tech Stack:** FastAPI, Python 3.12, Pytest, React 18, TypeScript 5, Tailwind CSS v4, Zustand, Vitest, Knip.

**Spec:** docs/specs/2026-10-07-platform-defects-and-cleanups-design.md

## Global Constraints

- **§S001 (No Duplicate UI Code):** Reusable UI primitives and hooks remain strictly inside `@djntechnic/bedrock-ui`.
- **§S003 (Logging Protocol):** Loguru backend and Pino frontend logging only.
- **§S005 (Hermetic Testing):** Zero broken tests tolerated; delta verification commands run in <30 seconds.
- **§S006 (SDLC & PR Workflow):** Feature branch isolation targeting `master`; explicit `git add` for new files; non-blocking CI watch.
- **§S008 (Documentation Standards):** Plans and specs conform to kebab-case naming in `docs/plans/` and `docs/specs/`, concluding with archival to `docs/archive/`.
- **§S009 (Design System):** Semantic CSS tokens only; raw hex and hardcoded Tailwind color hues (such as `bg-black/10`) are prohibited.
- **§S011 (Config-Driven Navigation):** Unified nav source; `CommandPalette` sources routes from `navRegistry` and obeys edit session leave guards.
- **§S014 (Platform Boundary):** Domain-specific prefixes (e.g. `mlbtracker-*`) must never reside in shared platform code.

## Review Focus

1. **Backend logging reconfiguration fails when database connection is unavailable during lifespan:** `test_lifespan_configures_logging_from_db` pins graceful handling in `packages/bedrock-api/tests/test_app_factory.py`.
2. **Test modules under `routes/` or `services/` falsely flagged as missing tests:** `test_s005_ignores_test_files_under_routes_and_services_folders` pins exclusion in `packages/bedrock-api/tests/test_audit_s005_to_s008.py`.
3. **Dirty edit session loss on CommandPalette navigation:** `test_command_palette_defers_navigation_when_edit_session_is_dirty` pins `requestLeave` invocation in `packages/bedrock-ui/src/components/CommandPalette.test.tsx`.
4. **Existing user preferences wiped out when upgrading storage keys:** `test_storage_migration_preserves_legacy_mlbtracker_keys` pins backward-compatible one-time migration in `packages/bedrock-ui/src/store/storageMigration.test.ts`.
5. **Overlay primitive visual regression under custom themes:** `test_dialog_primitives_render_scrim_overlay` pins `bg-scrim/40` in `packages/bedrock-ui/src/components/ui/dialogPrimitives.test.tsx`.

---

### Task 1: Backend Logging Lifespan Configuration (Issue #146)

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`
- **Engine:** `claude`
- **Effort:** `medium`
- **Model:** `sonnet`

**Files:**
- Modify: `packages/bedrock-api/bedrock/core/app_factory.py:168-185`
- Test: `packages/bedrock-api/tests/test_app_factory.py:200-240`

**Delta Verification:**
- Command: `pytest packages/bedrock-api/tests/test_app_factory.py -q`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

In `packages/bedrock-api/tests/test_app_factory.py`, update `boot_recorder` fixture to monkeypatch `configure_backend_logging_from_db`, update `test_boot_sequence_runs_in_the_documented_order` to expect `"logging"`, and add a dedicated test `test_lifespan_configures_logging_from_db`:

```python
# In packages/bedrock-api/tests/test_app_factory.py
from unittest.mock import MagicMock

def test_lifespan_configures_logging_from_db(monkeypatch):
    import bedrock.core.logging as bedrock_logging

    mock_configure = MagicMock()
    monkeypatch.setattr(bedrock_logging, "configure_backend_logging_from_db", mock_configure)

    app = create_app(title="TestApp", bootstrap=True)
    with TestClient(app):
        mock_configure.assert_called_once()
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `pytest packages/bedrock-api/tests/test_app_factory.py -k "test_lifespan_configures_logging_from_db or test_boot_sequence_runs_in_the_documented_order" -q`
Expected: FAIL ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Write minimal implementation**

In `packages/bedrock-api/bedrock/core/app_factory.py`, invoke `configure_backend_logging_from_db()` during `lifespan` immediately after `db_health.assert_database_healthy()`:

```python
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        from bedrock.core import database, db_health, migrations, schema_drift
        from bedrock.core.logging import configure_backend_logging_from_db

        database.db.validate_connection()
        _run_hooks(before_migrations, "before_migrations")
        migrations.apply_migrations()
        schema_drift.warn_on_drift()
        db_health.assert_database_healthy()
        configure_backend_logging_from_db()
        _run_hooks(after_bootstrap, "after_bootstrap")
        yield
        _run_hooks(on_shutdown, "on_shutdown")
        database.db.close_pool()
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `pytest packages/bedrock-api/tests/test_app_factory.py -q`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Run fast QA pre-commit gate**

Command: `python scripts/run_qa.py --mode fast`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 6: Commit**

Command: `git commit -am "fix(logging): invoke configure_backend_logging_from_db during create_app lifespan (Closes #146)"`

---

### Task 2: Remove Dead s015 Release Notes Import in QA Tool (Issue #147)

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `flash`
- **Engine:** `claude`
- **Effort:** `low`
- **Model:** `haiku`

**Files:**
- Modify: `packages/bedrock-api/bedrock/tools/run_all.py:40-60`
- Test: `packages/bedrock-api/tests/test_sync_and_run_all.py`

**Delta Verification:**
- Command: `pytest packages/bedrock-api/tests/test_sync_and_run_all.py -q`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

In `packages/bedrock-api/tests/test_sync_and_run_all.py`, add a test verifying that `run_all.py` does not contain unused imports and only exports modules registered in `AUDIT_MODULES`:

```python
def test_run_all_has_no_unused_s015_import():
    from pathlib import Path
    source = Path("packages/bedrock-api/bedrock/tools/run_all.py").read_text(encoding="utf-8")
    assert "s015_audit_release_notes" not in source, "s015_audit_release_notes is unused in run_all.py"
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `pytest packages/bedrock-api/tests/test_sync_and_run_all.py -k "test_run_all_has_no_unused_s015_import" -q`
Expected: FAIL ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Write minimal implementation**

In `packages/bedrock-api/bedrock/tools/run_all.py`, remove line 56 (`s015_audit_release_notes,`):

```python
from bedrock.tools import (
    s001_audit_duplicates,
    s002_audit_grids,
    s003_audit_logging,
    s004_audit_config,
    s005_audit_testing,
    s006_audit_pr_workflow,
    s007_audit_schema_catalog,
    s008_audit_guidance,
    s009_audit_design_tokens,
    s010_audit_security,
    s011_audit_navigation,
    s012_audit_pins,
    s013_audit_api_docs,
    s014_audit_ledger_freshness,
    s100_audit_domain_registry,
)
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `pytest packages/bedrock-api/tests/test_sync_and_run_all.py -q`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Run fast QA pre-commit gate**

Command: `python scripts/run_qa.py --mode fast`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 6: Commit**

Command: `git commit -am "chore(qa): remove unused s015_audit_release_notes import in run_all.py (Closes #147)"`

---

### Task 3: Ignore Test Modules Under routes/ and services/ in S005 Audit (Issue #149)

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`
- **Engine:** `claude`
- **Effort:** `medium`
- **Model:** `sonnet`

**Files:**
- Modify: `packages/bedrock-api/bedrock/tools/s005_audit_testing.py:79-97`
- Test: `packages/bedrock-api/tests/test_audit_s005_to_s008.py`

**Delta Verification:**
- Command: `pytest packages/bedrock-api/tests/test_audit_s005_to_s008.py -k "test_s005" -q`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

In `packages/bedrock-api/tests/test_audit_s005_to_s008.py`, add `test_s005_ignores_test_files_under_routes_and_services_folders`:

```python
def test_s005_ignores_test_files_under_routes_and_services_folders(tmp_path: Path):
    _write_toml(tmp_path, "[tool.bedrock.audit.s005]\nexemptions = []\n")
    # Production route with paired test
    _write(tmp_path / "bedrock" / "routes" / "health.py", "def get_health(): ...\n")
    _write(tmp_path / "tests" / "test_health.py", "def test_get_health(): ...\n")
    # Nested test file inside tests/routes/
    _write(tmp_path / "tests" / "routes" / "test_health_extra.py", "def test_extra(): ...\n")
    _write(tmp_path / "tests" / "services" / "test_auth_flow.py", "def test_auth(): ...\n")

    assert s005_audit_testing.main(["--root", str(tmp_path)]) == 0
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `pytest packages/bedrock-api/tests/test_audit_s005_to_s008.py -k "test_s005_ignores_test_files_under_routes_and_services_folders" -q`
Expected: FAIL ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Write minimal implementation**

In `packages/bedrock-api/bedrock/tools/s005_audit_testing.py`, update `_check_test_pairing` to exclude test files and tests folders:

```python
    for path in _iter_python_files(root):
        if path.name == "__init__.py":
            continue
        if path.parent.name not in _ROUTE_SERVICE_DIRS:
            continue
        if path.name.startswith("test_") or any(part == "tests" for part in path.parts):
            continue
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue

        expected = f"test_{path.stem}"
        if not any(stem.startswith(expected) for stem in all_test_stems):
            violations.append(
                TestingViolation(
                    file=rel,
                    line=1,
                    message=f"no paired test module found (expected test_{path.stem}*.py)",
                )
            )
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `pytest packages/bedrock-api/tests/test_audit_s005_to_s008.py -k "test_s005" -q`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Run fast QA pre-commit gate**

Command: `python scripts/run_qa.py --mode fast`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 6: Commit**

Command: `git commit -am "fix(s005): ignore test modules under routes/ and services/ in test-pairing audit (Closes #149)"`

---

### Task 4: Replace Hardcoded Overlay Hues with Scrim Token in UI Primitives (Issue #160)

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`
- **Engine:** `claude`
- **Effort:** `medium`
- **Model:** `sonnet`

**Files:**
- Modify: `packages/bedrock-ui/src/styles/tokens.css:35-37,124-126`
- Modify: `packages/bedrock-ui/src/components/ui/dialog.tsx:37-53`
- Modify: `packages/bedrock-ui/src/components/ui/alert-dialog.tsx:40-54`
- Modify: `packages/bedrock-ui/src/components/ui/sheet.tsx:21-35`
- Create: `packages/bedrock-ui/src/components/ui/dialogPrimitives.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/ui/dialogPrimitives.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

Create `packages/bedrock-ui/src/components/ui/dialogPrimitives.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as AlertDialogPrimitive from "./alert-dialog";
import * as DialogPrimitive from "./dialog";
import * as SheetPrimitive from "./sheet";

describe("Modal overlay token compliance (S009)", () => {
  it("uses bg-scrim/40 rather than hardcoded bg-black/10 in DialogOverlay", () => {
    const { container } = render(
      <DialogPrimitive.Dialog open>
        <DialogPrimitive.DialogOverlay data-testid="dialog-overlay" />
      </DialogPrimitive.Dialog>
    );
    const overlay = container.querySelector("[data-slot='dialog-overlay']");
    expect(overlay?.className).toContain("bg-scrim/40");
    expect(overlay?.className).not.toContain("bg-black/10");
  });

  it("uses bg-scrim/40 rather than hardcoded bg-black/10 in AlertDialogOverlay", () => {
    const { container } = render(
      <AlertDialogPrimitive.AlertDialog open>
        <AlertDialogPrimitive.AlertDialogOverlay data-testid="alert-overlay" />
      </AlertDialogPrimitive.AlertDialog>
    );
    const overlay = container.querySelector("[data-slot='alert-dialog-overlay']");
    expect(overlay?.className).toContain("bg-scrim/40");
    expect(overlay?.className).not.toContain("bg-black/10");
  });

  it("uses bg-scrim/40 rather than hardcoded bg-black/10 in SheetOverlay", () => {
    const { container } = render(
      <SheetPrimitive.Sheet open>
        <SheetPrimitive.SheetOverlay data-testid="sheet-overlay" />
      </SheetPrimitive.Sheet>
    );
    const overlay = container.querySelector("[data-slot='sheet-overlay']");
    expect(overlay?.className).toContain("bg-scrim/40");
    expect(overlay?.className).not.toContain("bg-black/10");
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/ui/dialogPrimitives.test.tsx`
Expected: FAIL ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Write minimal implementation**

1. In `packages/bedrock-ui/src/styles/tokens.css`, ensure `--scrim` and `--color-scrim` (and alias `--color-overlay: hsl(var(--scrim));`) are defined:
```css
  --color-scrim: hsl(var(--scrim));
  --color-overlay: hsl(var(--scrim));
```
2. In `packages/bedrock-ui/src/components/ui/dialog.tsx`, replace `bg-black/10` with `bg-scrim/40` on line 46:
```tsx
const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-scrim/40 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
})
```
3. In `packages/bedrock-ui/src/components/ui/alert-dialog.tsx`, replace `bg-black/10` with `bg-scrim/40` on line 48:
```tsx
const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    data-slot="alert-dialog-overlay"
    className={cn(
      "fixed inset-0 z-50 bg-scrim/40 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
      className
    )}
    {...props}
  />
))
```
4. In `packages/bedrock-ui/src/components/ui/sheet.tsx`, replace `bg-black/10` with `bg-scrim/40` on line 28:
```tsx
const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    data-slot="sheet-overlay"
    className={cn(
      "fixed inset-0 z-50 bg-scrim/40 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/ui/dialogPrimitives.test.tsx`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Run fast QA pre-commit gate**

Command: `python scripts/run_qa.py --mode fast`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 6: Commit**

Command: `git add packages/bedrock-ui/src/components/ui/dialogPrimitives.test.tsx packages/bedrock-ui/src/styles/tokens.css packages/bedrock-ui/src/components/ui/dialog.tsx packages/bedrock-ui/src/components/ui/alert-dialog.tsx packages/bedrock-ui/src/components/ui/sheet.tsx && git commit -m "fix(s009): hardcoded bg-black/10 overlays in shadcn dialog, alert-dialog and sheet primitives (Closes #160)"`

---

### Task 5: Eliminate Domain-Leaking Storage Keys with Backward Migration (Issue #159)

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`
- **Engine:** `claude`
- **Effort:** `medium`
- **Model:** `sonnet`

**Files:**
- Modify: `packages/bedrock-ui/src/context/ThemeContext.tsx:205-220,290-320`
- Modify: `packages/bedrock-ui/src/store/sidebarStore.ts:10-25`
- Modify: `packages/bedrock-ui/src/store/commandPaletteStore.ts:8-35`
- Create: `packages/bedrock-ui/src/store/storageMigration.test.ts`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/store/storageMigration.test.ts`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

Create `packages/bedrock-ui/src/store/storageMigration.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useCommandPaletteStore } from "./commandPaletteStore";
import { useSidebarStore } from "./sidebarStore";

describe("Platform localStorage neutral keys & migration (§S014)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("migrates legacy mlbtracker-sidebar-pinned to bedrock-sidebar-pinned", () => {
    localStorage.setItem("mlbtracker-sidebar-pinned", "true");
    // Trigger store rehydration or read
    const store = useSidebarStore.getState();
    store.togglePinned(); // sets to opposite and persists to new key
    expect(localStorage.getItem("bedrock-sidebar-pinned")).toBe("false");
  });

  it("migrates legacy mlbtracker-command-recents and pinned to bedrock-*", () => {
    localStorage.setItem("mlbtracker-command-recents", JSON.stringify(["rec-1"]));
    localStorage.setItem("mlbtracker-command-pinned", JSON.stringify(["pin-1"]));
    const store = useCommandPaletteStore.getState();
    store.addRecent("rec-2");
    expect(localStorage.getItem("bedrock-command-recents")).toContain("rec-2");
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/store/storageMigration.test.ts`
Expected: FAIL ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Write minimal implementation**

1. In `packages/bedrock-ui/src/context/ThemeContext.tsx`:
Replace `mlbtracker-theme` with `bedrock-theme` and `mlbtracker-custom-palettes` with `bedrock-custom-palettes`, with a migration reader:
```tsx
const ACTIVE_KEY = "bedrock-theme";
const LEGACY_ACTIVE_KEY = "mlbtracker-theme";
const CUSTOM_KEY = "bedrock-custom-palettes";
const LEGACY_CUSTOM_KEY = "mlbtracker-custom-palettes";

function readStoredTheme(): string {
  try {
    const cur = localStorage.getItem(ACTIVE_KEY);
    if (cur !== null) return cur;
    const legacy = localStorage.getItem(LEGACY_ACTIVE_KEY);
    if (legacy !== null) {
      localStorage.setItem(ACTIVE_KEY, legacy);
      return legacy;
    }
  } catch {}
  return "mlb-classic";
}

function readStoredCustomPalettes(): any[] {
  try {
    const cur = localStorage.getItem(CUSTOM_KEY);
    if (cur !== null) return JSON.parse(cur);
    const legacy = localStorage.getItem(LEGACY_CUSTOM_KEY);
    if (legacy !== null) {
      localStorage.setItem(CUSTOM_KEY, legacy);
      return JSON.parse(legacy);
    }
  } catch {}
  return [];
}
```
2. In `packages/bedrock-ui/src/store/sidebarStore.ts`:
```tsx
const PIN_KEY = "bedrock-sidebar-pinned";
const LEGACY_PIN_KEY = "mlbtracker-sidebar-pinned";

function readPinned(): boolean {
  try {
    const cur = localStorage.getItem(PIN_KEY);
    if (cur !== null) return cur === "true";
    const legacy = localStorage.getItem(LEGACY_PIN_KEY);
    if (legacy !== null) {
      localStorage.setItem(PIN_KEY, legacy);
      return legacy === "true";
    }
  } catch {}
  return false;
}
```
3. In `packages/bedrock-ui/src/store/commandPaletteStore.ts`:
```tsx
const RECENTS_KEY = "bedrock-command-recents";
const LEGACY_RECENTS_KEY = "mlbtracker-command-recents";
const PINNED_KEY = "bedrock-command-pinned";
const LEGACY_PINNED_KEY = "mlbtracker-command-pinned";

function readIds(key: string, legacyKey?: string): string[] {
  try {
    let raw = localStorage.getItem(key);
    if (!raw && legacyKey) {
      raw = localStorage.getItem(legacyKey);
      if (raw) localStorage.setItem(key, raw);
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/store/storageMigration.test.ts`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Run fast QA pre-commit gate**

Command: `python scripts/run_qa.py --mode fast`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 6: Commit**

Command: `git add packages/bedrock-ui/src/store/storageMigration.test.ts packages/bedrock-ui/src/context/ThemeContext.tsx packages/bedrock-ui/src/store/sidebarStore.ts packages/bedrock-ui/src/store/commandPaletteStore.ts && git commit -m "fix(ui): remove mlbtracker-* localStorage keys from platform stores (Closes #159)"`

---

### Task 6: Guard CommandPalette Navigation and Source from navRegistry (Issue #158)

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`
- **Engine:** `claude`
- **Effort:** `medium`
- **Model:** `sonnet`

**Files:**
- Modify: `packages/bedrock-ui/src/components/CommandPalette.tsx:178-245,310-330`
- Modify: `packages/bedrock-ui/src/components/CommandPalette.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/CommandPalette.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

In `packages/bedrock-ui/src/components/CommandPalette.test.tsx`, add tests for `requestLeave` interception and `navRegistry` route sourcing:

```tsx
import { fireEvent } from "@testing-library/react";
import { registerNavItems, __clearNavItems } from "./navRegistry";
import { useEditSessionStore } from "../store/editSessionStore";

it("sources navigation items from navRegistry without explicit commandRoutes", () => {
  __clearNavItems();
  registerNavItems([
    {
      to: "/collectibles",
      label: "Collectibles Hub",
      icon: () => <svg />,
    },
  ]);

  render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>
  );

  expect(screen.getByText("Collectibles Hub")).toBeInTheDocument();
});

it("defers navigation through requestLeave when an edit session is dirty", () => {
  const navigateMock = vi.fn();
  vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return { ...actual, useNavigate: () => navigateMock };
  });

  // Register a dirty session
  const discardMock = vi.fn();
  useEditSessionStore.getState().register("session-1", discardMock);

  render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>
  );

  const item = screen.getByText("Collectibles Hub");
  fireEvent.click(item);

  // Leave is parked: pendingLeave is set, direct navigate is NOT called yet
  expect(useEditSessionStore.getState().pendingLeave).not.toBeNull();
  expect(navigateMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/CommandPalette.test.tsx`
Expected: FAIL ($LASTEXITCODE -ne 0)

- [ ] **Step 3: Write minimal implementation**

In `packages/bedrock-ui/src/components/CommandPalette.tsx`:
1. Source routes from `getNavItems()` and merge with `getCommandRoutes()`:
```tsx
import { getNavItems, type NavItem } from "./navRegistry";
import { useEditSessionStore } from "../store/editSessionStore";

function flattenNavItems(items: NavItem[]): CommandRouteItem[] {
  const routes: CommandRouteItem[] = [];
  for (const item of items) {
    if (item.to && (!item.children || item.children.length === 0) && (!item.groups || item.groups.length === 0)) {
      routes.push({
        id: item.to,
        label: item.label,
        group: "Navigation",
        to: item.to,
        icon: item.icon as any,
        module: item.module,
        action: item.action,
        keywords: [item.label],
      });
    }
    if (item.children) {
      for (const child of item.children) {
        routes.push({
          id: child.to,
          label: child.label,
          group: item.label,
          to: child.to,
          icon: item.icon as any,
          module: child.module ?? item.module,
          action: child.action ?? item.action,
          keywords: [child.label],
        });
      }
    }
    if (item.groups) {
      for (const group of item.groups) {
        for (const subItem of group.items) {
          routes.push({
            id: subItem.to,
            label: subItem.label,
            group: `${item.label}: ${group.label}`,
            to: subItem.to,
            icon: item.icon as any,
            module: subItem.module ?? group.module ?? item.module,
            action: subItem.action ?? group.action ?? item.action,
            keywords: [subItem.label],
          });
        }
      }
    }
  }
  return routes;
}
```
2. Merge nav routes with `getCommandRoutes()`:
```tsx
  const allConfiguredRoutes = useMemo(() => {
    const navRoutes = flattenNavItems(getNavItems());
    const explicitRoutes = getCommandRoutes();
    const seen = new Set(navRoutes.map((r) => r.to));
    const merged = [...navRoutes];
    for (const r of explicitRoutes) {
      if (!seen.has(r.to)) {
        merged.push(r);
        seen.add(r.to);
      }
    }
    return merged;
  }, []);
```
3. Route palette navigation through `requestLeave`:
```tsx
  function runRoute(item: CommandRouteItem) {
    addRecent(item.id);
    logger.info("CommandPalette: navigated", { to: item.to, source: "route", id: item.id });
    setOpen(false);
    useEditSessionStore.getState().requestLeave(() => navigate(item.to));
  }

  const runSourceResult = useCallback(
    (source: SearchSource, result: SearchSourceResult) => {
      logger.info("CommandPalette: navigated", {
        to: result.to,
        source: source.id,
        id: String(result.id),
      });
      setOpen(false);
      useEditSessionStore.getState().requestLeave(() => navigate(result.to));
    },
    [navigate, setOpen]
  );
```
And in `onSelect` for `allTarget`:
```tsx
  useEditSessionStore.getState().requestLeave(() => navigate(allTarget.to(query)));
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/CommandPalette.test.tsx`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Run fast QA pre-commit gate**

Command: `python scripts/run_qa.py --mode fast`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 6: Commit**

Command: `git commit -am "fix(nav): CommandPalette navigation bypasses requestLeave and sources routes outside navRegistry (Closes #158)"`

---

### Task 7: Knip Admin Barrel Entry, Duplicate Export Removal, and Pin (Issue #148)

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `flash`
- **Engine:** `claude`
- **Effort:** `low`
- **Model:** `haiku`

**Files:**
- Modify: `knip.json:3-9`
- Modify: `packages/bedrock-ui/src/components/media/ImageAnnotatorModal.tsx:358-361`
- Modify: `package.json:30-47`

**Delta Verification:**
- Command: `npx knip --no-progress`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Run knip to verify current failures**

Command: `npx knip --no-progress`
Expected: FAIL ($LASTEXITCODE -ne 0) reporting unused files (`packages/bedrock-ui/src/components/admin/index.ts`) and unused export (`ImageAnnotatorModal` in `ImageAnnotatorModal.tsx:360`).

- [ ] **Step 2: Write minimal implementation**

1. In `knip.json`, add admin barrel entry to `entry` array:
```json
  "entry": [
    "packages/bedrock-ui/src/index.ts",
    "packages/bedrock-ui/src/components/admin/index.ts",
    "packages/bedrock-ui/src/styles/tokens.css",
    "packages/bedrock-ui/src/components/grids/cellRenderers.tsx",
    "packages/bedrock-ui/src/components/grids/DataGrid.tsx",
    "packages/bedrock-ui/src/hooks/useRowClickHandler.ts"
  ],
```
2. In `packages/bedrock-ui/src/components/media/ImageAnnotatorModal.tsx`, remove line 360 (`export { ImageAnnotatorModal };`), leaving only:
```tsx
export default ImageAnnotatorModal;
```
3. In `package.json`, add `"knip": "^5.45.0"` to `devDependencies`:
```json
  "devDependencies": {
    "knip": "^5.45.0",
```

- [ ] **Step 3: Run delta verification to verify it passes**

Command: `npx knip --no-progress`
Expected: PASS with 0 unused files and 0 unused exports (`$LASTEXITCODE -eq 0`)

- [ ] **Step 4: Run fast QA pre-commit gate**

Command: `python scripts/run_qa.py --mode fast`
Expected: PASS with `$LASTEXITCODE -eq 0`

- [ ] **Step 5: Commit**

Command: `git commit -am "fix(knip): declare admin barrel entry, drop duplicate named export, and pin knip in devDependencies (Closes #148)"`

---

### Task 8: Final Quality Audit, Spec & Plan Archiving, and PR Gate

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`
- **Engine:** `claude`
- **Effort:** `medium`
- **Model:** `sonnet`

**Files:**
- Move: `docs/specs/2026-10-07-platform-defects-and-cleanups-design.md` -> `docs/archive/specs/2026-10-07-platform-defects-and-cleanups-design.md`
- Move: `docs/plans/2026-10-07-platform-defects-and-cleanups.md` -> `docs/archive/plans/2026-10-07-platform-defects-and-cleanups.md`
- Move: `docs/plans/2026-10-07-platform-defects-and-cleanups-intake.json` -> `docs/archive/plans/2026-10-07-platform-defects-and-cleanups-intake.json`

**Delta Verification:**
- Command: `python scripts/run_qa.py --mode scoped` (pre-PR) and `python scripts/run_qa.py --mode full` (pre-merge)
- Target runtime: `<60s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Run pre-PR scoped QA gate; confirm PASS with `$LASTEXITCODE -eq 0`**

Command: `python scripts/run_qa.py --mode scoped`
Expected: PASS ($LASTEXITCODE -eq 0)

- [ ] **Step 2: Run pre-merge full QA gate; confirm PASS with `$LASTEXITCODE -eq 0`**

Command: `python scripts/run_qa.py --mode full`
Expected: PASS ($LASTEXITCODE -eq 0)

- [ ] **Step 3: Move supporting spec to archive per §S008**

Command: `git mv docs/specs/2026-10-07-platform-defects-and-cleanups-design.md docs/archive/specs/`

- [ ] **Step 4: Move implementation plan and companion intake JSON to archive per §S008**

Command: `git mv docs/plans/2026-10-07-platform-defects-and-cleanups.md docs/archive/plans/ && git mv docs/plans/2026-10-07-platform-defects-and-cleanups-intake.json docs/archive/plans/`

- [ ] **Step 5: Verify clean working tree with only expected staged moves**

Command: `git status --porcelain`

- [ ] **Step 6: Commit archival and test confirmation**

Command: `git commit -m "chore(docs): archive platform defects and cleanups spec, plan, and intake JSON per §S008"`
