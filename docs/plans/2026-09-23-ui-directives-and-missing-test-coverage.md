# UI Directives Cleanup & Missing Upstream Test Coverage Implementation Plan

> **Delivery via Triage Plan:** Hand off this plan directly to the `/triage-plan` skill:
> ```pwsh
> /triage-plan docs/plans/2026-09-23-ui-directives-and-missing-test-coverage.md
> ```
> This ingests discrete tasks, maps domain-to-agent delegations, injects runtime invariants
> (.venv, direct exit status, lockstep pins, <30s delta testing), and supervises execution.

**Goal:** Resolve Bedrock GitHub issues #98 and #101 by stripping extraneous `"use client"` directives from `@djntechnic/bedrock-ui`, hardening Rollup build warning suppression, and adding comprehensive upstream unit test suites for `<GridHeader>`, `<PresentationalTableChrome>`, and `<StatBadge>`.

**Architecture:** Five discrete, contract-driven tasks: first remove the `"use client"` directives and harden the build config to eliminate Rollup module directive and sourcemap errors (Task 1); then build isolated upstream test suites bottom-up for `<StatBadge>` (Task 2), `<PresentationalTableChrome>` (Task 3), and `<GridHeader>` (Task 4); concluding with end-to-end package verification (`npm run build`, `npm run build:types`, and full `npm test`) to guarantee downstream consumers (`MLBTracker#434`, `CollectIt`) can safely retire their duplicate test suites (Task 5).

**Tech Stack:** React 18, TypeScript 5.6, Vite 6 / Rollup, Vitest 2.1, `@testing-library/react`, `@testing-library/jest-dom`, TanStack Table v8, Pino (`packages/bedrock-ui/src/utils/logger.ts`).

**Spec:**
- GitHub Issue #98: `GridHeader, PresentationalTableChrome, and StatBadge lack full/any upstream test coverage` (djntechnic/bedrock#98, unblocking djntechnic/MLBTracker#434)
- GitHub Issue #101: `[UI] Remove extraneous 'use client' directives causing Rollup module directive and sourcemap errors in bedrock-ui build` (djntechnic/bedrock#101)

## Global Constraints

- §S001 (No Duplicate UI Code): reusable components and their authoritative test suites belong strictly in `@djntechnic/bedrock-ui` (`packages/bedrock-ui`). Downstream consumer workarounds must be unblocked to delete in-tree duplicate test suites.
- §S002 (All Grids Wired to Admin Config): `<GridHeader>` consumes merged `GridConfig` and the live TanStack `Table` instance (`table.getFilteredRowModel().rows.length`).
- §S003 (Logging Protocol): structured Pino logger (`log.info`) only. Raw `console.*` is strictly banned. Interaction and lifecycle events (`mount`, `search`, `density`, `export`, `print`, `bulk-save`, `bulk-discard`, `dashboard_pin`) must emit structured JSON payloads.
- §S005 (Test Coverage Mandatory): zero broken tests tolerated. Every task ends with an independently passing delta test targeting `<30s` execution.
- §S006 (SDLC & PR Workflow): feature branch isolation targeting `master`. Direct exit codes (`$LASTEXITCODE -eq 0`) verified on every command.
- §S009 (Design System): semantic CSS tokens and CSS variables only. `<StatBadge>` consumes `hsl(var(--<variant>) / 0.15)` tokens.
- Execution Invariant: scratch exploration must reside strictly in `scratch/`. Never mask shell status via pipes.

## Review Focus

- `<GridHeader>` with `dashboardPin=undefined` vs `dashboardPin=false`: `dashboardPin=false` renders an unpinned toggle button, while `dashboardPin=undefined` must completely omit the button (preventing anonymous visitors and synthetic dashboard grids from pinning). Pinned to Task 4.
- `<GridHeader>` with `config.showSearch=true` but `onSearchChange` not supplied: must safely evaluate `showSearch = config.showSearch && !!onSearchChange` and render no input, avoiding broken uncontrolled states. Pinned to Task 4.
- `<PresentationalTableChrome>` with both `isLoading=true` and `isEmpty=true`: `isLoading` must take precedence over `isEmpty`, rendering the spinner and preventing flash-of-empty-content during queries. Pinned to Task 3.
- `<StatBadge>` custom `className` prop merging: passing arbitrary Tailwind utilities (e.g. `ml-2`) must merge onto the `<span>` element without dropping the baseline pill styles (`inline-flex`, `rounded-full`, `tabular-nums`) or overwriting variant inline styles. Pinned to Task 2.
- Rollup build warning handler in `vite.config.ts`: `onwarn` must specifically suppress `MODULE_LEVEL_DIRECTIVE` without masking unrelated warnings or true compilation syntax errors. Pinned to Task 1.

---

### Task 1: Strip extraneous `"use client"` directives & harden Vite build warning handler (Issue #101)

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Files:**
- Modify: `packages/bedrock-ui/src/components/ui/alert-dialog.tsx:6`
- Modify: `packages/bedrock-ui/src/components/ui/collapsible.tsx:8`
- Modify: `packages/bedrock-ui/src/components/ui/sheet.tsx:6`
- Modify: `packages/bedrock-ui/vite.config.ts:103-120`
- Modify: `packages/bedrock-ui/src/packaging.test.ts:125-136`

**Interface Contract:**
- Consumes: `packages/bedrock-ui/src/components/ui/{alert-dialog,collapsible,sheet}.tsx`
- Produces:
  - Clean ESM library build with zero Rollup `MODULE_LEVEL_DIRECTIVE` warnings and zero sourcemap resolution errors.
  - Hardened `rollupOptions.onwarn` rule in `vite.config.ts`:
    ```ts
    onwarn(warning, defaultHandler) {
      if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
      defaultHandler(warning);
    }
    ```
  - Packaging regression assertion in `packages/bedrock-ui/src/packaging.test.ts`:
    ```ts
    it("contains zero extraneous 'use client' directives in source files", () => {
      // scans packages/bedrock-ui/src/**/*.tsx? and asserts zero files contain 'use client'
    });
    ```
- Platform standards touched: §S005, §S006.

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/packaging.test.ts -q`
- Target runtime: `<10s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [x] Write the failing packaging test asserting zero `"use client"` directives in `packages/bedrock-ui/src`
- [x] Run delta verification command: `npx vitest run packages/bedrock-ui/src/packaging.test.ts -q`; confirm FAIL
- [x] Remove `"use client"` directive from `packages/bedrock-ui/src/components/ui/alert-dialog.tsx`
- [x] Remove `"use client"` directive from `packages/bedrock-ui/src/components/ui/collapsible.tsx`
- [x] Remove `"use client"` directive from `packages/bedrock-ui/src/components/ui/sheet.tsx`
- [x] Add `onwarn` warning handler in `packages/bedrock-ui/vite.config.ts`
- [x] Run delta verification command: `npx vitest run packages/bedrock-ui/src/packaging.test.ts -q`; confirm PASS with `$LASTEXITCODE -eq 0`
- [x] Verify clean build output: `npm run build`; confirm zero sourcemap errors or directive warnings
- [x] Commit (`git commit -m "fix(ui): remove extraneous use client directives and harden rollup onwarn"`)

---

### Task 2: Upstream unit test suite for `<StatBadge>` (Issue #98)

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Files:**
- Create: `packages/bedrock-ui/src/components/ui/stat-badge.test.tsx`
- Test: `packages/bedrock-ui/src/components/ui/stat-badge.test.tsx`

**Interface Contract:**
- Consumes:
  ```ts
  import { StatBadge, type StatBadgeVariant } from "./stat-badge";
  ```
- Produces: Comprehensive test assertions verifying:
  1. Value text rendering: renders string `value` passed as prop (`"+0.045"`, `"-12"`, `"Neutral"`).
  2. Semantic variant color styles:
     - `positive`: `{ backgroundColor: "hsl(var(--positive) / 0.15)", color: "hsl(var(--positive))" }`
     - `negative`: `{ backgroundColor: "hsl(var(--negative) / 0.15)", color: "hsl(var(--negative))" }`
     - `warning`: `{ backgroundColor: "hsl(var(--warning) / 0.15)", color: "hsl(var(--warning))" }`
     - `neutral`: `{ backgroundColor: "hsl(var(--neutral) / 0.15)", color: "hsl(var(--neutral))" }`
  3. Class name merging: merges custom `className` prop onto the root `<span>` while preserving default classes (`inline-flex`, `rounded-full`, `tabular-nums`).
- Platform standards touched: §S001, §S005, §S009.

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/ui/stat-badge.test.tsx -q`
- Target runtime: `<10s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [x] Create failing test in `packages/bedrock-ui/src/components/ui/stat-badge.test.tsx` exercising all four variants, DOM structure, and custom class merging
- [x] Run delta verification command: `npx vitest run packages/bedrock-ui/src/components/ui/stat-badge.test.tsx -q`; confirm initial execution
- [x] Ensure all assertions pass against existing implementation
- [x] Run delta verification command: `npx vitest run packages/bedrock-ui/src/components/ui/stat-badge.test.tsx -q`; confirm PASS with `$LASTEXITCODE -eq 0`
- [x] Commit (`git commit -m "test(ui): add comprehensive upstream unit tests for StatBadge"`)

---

### Task 3: Upstream unit test suite for `<PresentationalTableChrome>` (Issue #98)

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Files:**
- Create: `packages/bedrock-ui/src/components/grids/PresentationalTableChrome.test.tsx`
- Test: `packages/bedrock-ui/src/components/grids/PresentationalTableChrome.test.tsx`

**Interface Contract:**
- Consumes:
  ```ts
  import {
    PresentationalTableChrome,
    chromeClasses,
    type PresentationalTableChromeProps,
  } from "./PresentationalTableChrome";
  ```
- Produces: Comprehensive test assertions verifying:
  1. Base DOM layout & class forward: wraps `children` inside `<table>` with `chromeClasses.table` and container with `chromeClasses.container`. Applies optional `className` and `tableClassName`.
  2. Row count formatting & pluralization:
     - `rowCount={5}` renders `"5 rows"`
     - `rowCount={1}` renders `"1 row"`
     - `rowCount={0}` renders `"0 rows"`
     - `rowCount={3}` with `countLabel="batches"` renders `"3 batches"`
     - `rowCount={1}` with `countLabel="batches"` renders `"1 row"` (default fallback when plural) or custom singular
     - Large counts format with commas: `rowCount={1234}` renders `"1,234 rows"`
  3. Caption visibility: caption container is omitted when both `rowCount` and `toolbar` are undefined.
  4. Toolbar slot rendering: renders `toolbar` JSX node in the top action cluster.
  5. Loading state (`isLoading=true`): renders `GridStatusContent` loading state inside `<tbody>`, does not render `children`, applies `colSpan` (default 1 or custom).
  6. Empty state (`isEmpty=true`): renders `GridStatusContent` empty state with default or custom `emptyMessage`, does not render `children`, applies `colSpan`.
  7. Loading priority: `isLoading={true}` takes precedence over `isEmpty={true}` when both flags are enabled.
  8. Static export contract: validates that `chromeClasses` exports contain expected constants (`container`, `table`, `headerRow`, `headerCell`, `body`, `row`, `cell`).
- Platform standards touched: §S001, §S002, §S005.

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/grids/PresentationalTableChrome.test.tsx -q`
- Target runtime: `<10s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [x] Create test file `packages/bedrock-ui/src/components/grids/PresentationalTableChrome.test.tsx`
- [x] Run delta verification command: `npx vitest run packages/bedrock-ui/src/components/grids/PresentationalTableChrome.test.tsx -q`
- [x] Ensure all assertions pass against existing implementation
- [x] Run delta verification command: `npx vitest run packages/bedrock-ui/src/components/grids/PresentationalTableChrome.test.tsx -q`; confirm PASS with `$LASTEXITCODE -eq 0`
- [x] Commit (`git commit -m "test(ui): add comprehensive upstream unit tests for PresentationalTableChrome"`)

---

### Task 4: Upstream unit test suite for `<GridHeader>` (Issue #98)

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-ui/src/components/grids/GridHeader.test.tsx`
- Test: `packages/bedrock-ui/src/components/grids/GridHeader.test.tsx`

**Interface Contract:**
- Consumes:
  ```ts
  import GridHeader from "./GridHeader";
  import type { GridConfig } from "../../hooks/useGridConfig";
  import type { Table } from "@tanstack/react-table";
  import { log } from "../../utils/logger";
  ```
- Produces: Comprehensive unit test harness for `<GridHeader>` verifying:
  1. Lifecycle telemetry: emits `log.info({ gridId, action: "mount", recordCount }, "GridHeader: mounted")` exactly once on mount.
  2. Record count display:
     - Derives count from `table.getFilteredRowModel().rows.length` (or `table.getRowModel()`).
     - `config.showRowCount=true`: renders `"0 rows"`, `"1 row"`, `"1,234 rows"`.
     - `config.showRowCount=false`: suppresses row count text.
  3. Header title & subHeader block:
     - Renders `<h2>{config.title}</h2>` and `<p>{config.subHeader}</p>` when defined.
     - Entire block is omitted when neither is present.
  4. Search input wiring & interactions:
     - Renders search input when `config.showSearch=true` and `onSearchChange` is provided.
     - Displays `searchPlaceholder` (default `"Search…"` or custom).
     - Typing invokes `onSearchChange` and emits structured log `{ gridId, action: "search", query, recordCount }`.
     - When `search` value is non-empty, renders clear button (`X`); clicking calls `onSearchChange("")`.
     - Input omitted when `config.showSearch=false` or `onSearchChange` is undefined.
  5. Filters slot injection:
     - Renders `filtersSlot` node inside `data-slot="grid-header-filters"`.
  6. Row density toggle:
     - Renders when `config.showDensityToggle=true`, `density` is provided, and `onDensityChange` is provided.
     - Reflects active density label in tooltip and aria-label (`Row density · Compact`, etc.).
     - Clicking calls `onDensityChange` and emits structured log `{ gridId, action: "density", recordCount }`.
  7. CSV export:
     - Renders when `config.allowExport=true` and `onExport` is provided.
     - Clicking calls `onExport` and emits structured log `{ gridId, action: "export", recordCount }`.
  8. Print layout trigger:
     - Renders when `config.allowPrintView=true`.
     - Clicking triggers `window.print()` and emits structured log `{ gridId, action: "print", recordCount }`.
  9. Dashboard pin button:
     - Renders button when `dashboardPin` is boolean (`true` or `false`).
     - Clicking calls `onDashboardPinToggle` and emits structured log `{ gridId, action: "dashboard_pin", pinned }`.
     - Completely omitted when `dashboardPin` is `undefined`.
  10. Bulk save controls:
      - When `bulkDirty=true` and `onBulkSave` is provided, renders Save button.
      - Clicking Save calls `onBulkSave` and emits structured log `{ gridId, action: "bulk-save", recordCount }`.
- Platform standards touched: §S001, §S002, §S003, §S005.

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/grids/GridHeader.test.tsx -q`
- Target runtime: `<15s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [x] Create test file `packages/bedrock-ui/src/components/grids/GridHeader.test.tsx` with mocked `log` and TanStack `table` fixtures
- [x] Run delta verification command: `npx vitest run packages/bedrock-ui/src/components/grids/GridHeader.test.tsx -q`
- [x] Ensure all assertions pass against existing implementation
- [x] Run delta verification command: `npx vitest run packages/bedrock-ui/src/components/grids/GridHeader.test.tsx -q`; confirm PASS with `$LASTEXITCODE -eq 0`
- [x] Commit (`git commit -m "test(ui): add comprehensive upstream unit tests for GridHeader"`)

---

### Task 5: End-to-end package validation & downstream unblock verification

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `docs/plans/2026-09-23-ui-directives-and-missing-test-coverage.md` (mark all tasks complete)

**Interface Contract:**
- Consumes: All deliverables from Tasks 1 through 4.
- Produces:
  - Clean `npm run build` output with zero sourcemap errors and zero Rollup module directive warnings.
  - Successful `npm run build:types` declaration emission.
  - 100% green `npm test` across all 49+ Vitest test files in `@djntechnic/bedrock-ui`.
  - Upstream coverage unblocking downstream issues (djntechnic/MLBTracker#434 and CollectIt).
- Platform standards touched: §S005, §S006, §S012, §S014.

**Delta Verification:**
- Command: `npm run prepare && npm test`
- Target runtime: `<90s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [x] Execute `npm run build` and confirm exit code 0 with zero warnings/errors
- [x] Execute `npm run build:types` and confirm exit code 0
- [x] Execute `npm test` and confirm exit code 0 with all test suites passing
- [x] Mark all task checkboxes complete in `docs/plans/2026-09-23-ui-directives-and-missing-test-coverage.md`
- [x] Commit (`git commit -m "chore(ui): complete issues 98 and 101 verification"`)
