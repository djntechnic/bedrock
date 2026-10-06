# Bedrock v0.13.1 Downstream Adoption — Design Spec

**Date:** 2026-10-06
**Status:** Approved for planning
**Plan:** [`docs/plans/2026-10-06-bedrock-v0-13-1-downstream-adoption.md`](../plans/2026-10-06-bedrock-v0-13-1-downstream-adoption.md)
**Upstream spec:** [`docs/archive/specs/2026-10-06-shell-refresh-design.md`](../archive/specs/2026-10-06-shell-refresh-design.md)
**Upstream plan:** [`docs/archive/plans/2026-10-06-shell-refresh.md`](../archive/plans/2026-10-06-shell-refresh.md)

## 1. Executive Summary & Scope

Bedrock `v0.13.1` ships all seven shell-refresh phases (tokens, `AppSidebar` refresh,
`AppShell` / `AppHeader`, the edit-session engine, `WorkbenchShell` integration, wizard
primitives, bulk-edit helpers). This spec governs how the two consumers adopt it:

| Consumer | Path | Role |
| -------- | ---- | ---- |
| CollectIt | `C:\Dev\CollectIt` | Originated the promoted primitives; goes **first** and proves eviction. |
| MLBTracker | `C:\Dev\MLBTracker` | Simpler shell; goes **second** and consumes the same primitives. |

**Prerequisites**

- `chore/archive-shell-refresh` is merged to `master` (confirmed; HEAD `de07c52`).
- `v0.13.1` is tagged and visible on the remote. **As of authoring it is not:**
  `git ls-remote --tags origin 'v0.13*'` returns only `v0.13.0`. Cutting it is plan Task 2
  and is gated on the user (the push is outward-facing; a 403 means the tag was not created).

**Non-goals**

- No backend schema work. `v0.13.1` carries no migration, DDL, or schema-catalog change; the
  adoption is frontend primitives plus audit tooling plus the dual pin (§S007 untouched).
- No upstream fixes for the accepted navigation limits (§4.3) — they are filed, not patched.
- No edits to `bedrock` source by the consumer PRs, and no edits to a consumer from a bedrock
  branch (§S012). This repo's only change in this effort is the docs and the release cut.

## 2. Release Delivery & Pin Strategy (§S012)

**Upstream cut.** `pwsh -File scripts/maintenance/Cut-BedrockRelease.ps1 -TargetVersion v0.13.1`
on `master`. It moves both package versions, assembles the CHANGELOG entry from the merged PR
changelog sections (§S015), tags, and pushes. Verification is
`git ls-remote --tags origin v0.13.1` returning the tag — both the tag object and its peeled
`^{}` commit. The CHANGELOG entry must list the two breaking items from upstream spec §6
(sidebar loses the baseball mark / "Analytics"; S001 invariant 9 fails a hand-rolled
`<header class="app-header">`).

**Two PRs per consumer (§S006 one-concern).**

| PR | Concern | Content |
| -- | ------- | ------- |
| PR 1 `chore/bump-bedrock-v0131-shell` | Pin and shell frame | Both pins to `v0.13.1` in one commit; lockfile regenerated; `<AppShell>` / `<AppHeader>` replace the hand-built frame; `brand` on `<AppSidebar>`; S001 invariant 9 clean. |
| PR 2 `refactor/adopt-bedrock-v0131-primitives` | Primitive adoption | Local copies of `AdaptiveButton`, `Stepper`, `WizardDialog`, `draftHistory` / `useDraftHistory`, `SelectionDock` evicted; hand-rolled edit/save/cancel moved to `useEditSession` / `useRecordForm` / `<SaveBar>` / `useBulkDrafts`; redundant tests pruned; §S014 ledger reconciled. |

**Ordering.** CollectIt PR 1 → PR 2 merged, then MLBTracker PR 1 → PR 2. A PR 2 starts only
after its own PR 1 is on `master`, because PR 2 imports primitives that only exist once the
pin has moved. Each repo's pin bump runs through `/bump-bedrock-pin v0.13.1`; this repo never
edits a consumer's pins. After every consumer `master` merge, `python -m bedrock.tools.s012_audit_pins --root .`
must report identical tags, both resolving on the remote.

## 3. Application Shell & Branding Model

`AppShell` owns the frame (sidebar margin, header, main column, footer, unsaved-changes
dialog) with `layout: "default" | "workbench" | "fullBleed"`. It mounts no providers and no
router — those stay in each consumer's `App.tsx`. The consumer deletes its hand-built
`<header class="app-header …">`, the `ml-0` / `ml-16` / `ml-60` margin logic, and the per-route
column wrappers, mapping each route onto a `layout`.

`brand` is the only appearance input; there is **no default subtitle** upstream, so a consumer
that passes nothing renders an initial-letter mark and no subtitle.

| Consumer | `<AppSidebar>` |
| -------- | -------------- |
| CollectIt | `<AppSidebar brand={{ subtitle: "Collectibles Studio" }} />` — default mark is the initial `"C"`. |
| MLBTracker | `<AppSidebar brand={{ mark: "⚾", subtitle: "Analytics" }} />` — preserves the prior look explicitly. |

The sidebar keeps rendering `useNavSettings().navItems`; no consumer adds a link list (§S011).

**Deferred platform features (filed, not built — §6):** configurable app branding through
`app_config_settings` (so `brand` stops being a code constant), and promotion of MLBTracker's
Theme Manager into `@djntechnic/bedrock-ui`.

## 4. Edit-Session & Save Architecture

Contract is upstream spec §4.4, unchanged: `useEditSession` (save / cancel / guard state
machine, `beforeunload`, optional Ctrl/Cmd+S), `useRecordForm` (record values + undo/redo +
optional autosave), `<SaveBar>`, `UndoRedoControls`, `UnsavedChangesDialog`, and the
`useDraftHistory` wrapper over `DataGrid`'s bulk-draft engine. `<SaveBar>` takes no permission
prop; a caller without update rights wraps it in `<Can module action="update">` so the control
is unmounted, not disabled (§S010).

**Named scope**

| Repo | Surface | Disposition |
| ---- | ------- | ----------- |
| CollectIt | `frontend/src/components/bulk/useBulkDrafts.ts` | Replace the local history reducer with `useDraftHistory`; keep staged-row, CSV-validation and text-equality logic local. |
| CollectIt | `frontend/src/components/fields/FieldsWorkbench.tsx` | Adopt `useRecordForm` + `<SaveBar>`; drop the local `beforeunload` and Save/Cancel cluster; pass `session` to `WorkbenchShell`. |
| CollectIt | `frontend/src/pages/listing-studio/ListingsPage.tsx` | Adopt `useEditSession` + `<SaveBar>`; drop the local `beforeunload`. |
| MLBTracker | `frontend/src/components/RankingsConfigPanel.tsx` and edit dialogs | Audit, then migrate matching hand-rolled surfaces. |
| MLBTracker | `frontend/src/components/inventory/ImportWizard/*` | Compose `WizardDialog` + `Stepper` where the wizard hand-rolls its frame and progress. |

**Automated discovery.** Named scope is a floor, not a ceiling. Before any migration PR 2
edits code, the plan runs a repeatable scan of both `frontend/src` trees for (a) a local
`beforeunload` listener, (b) an `isDirty` / `dirty` / `hasChanges` state variable paired with a
`Save` and `Cancel` / `Discard` button, (c) a `Ctrl`/`Meta`+`S` key handler, (d) a local undo
stack. Output is one markdown table per repo — `file | line | signal | disposition (migrate /
keep, reason / file upstream)` — committed nowhere, pasted into the PR 2 description and kept
in `scratch/` for the session. A hit not migrated needs a written reason; "out of scope" is not
a reason (§S005).

**Accepted limits (decision #8, upstream spec §4.4).** Browser back/forward and programmatic
`navigate()` are covered only by `beforeunload` on unload, not by the dialog; `CommandPalette`
navigation does not call `requestLeave`. Consumers rely on the cooperative guard
(`beforeunload` + `AppSidebar` link interception) as shipped. No consumer code works around
these; each is tracked by an upstream issue (§6) and the consumer PR descriptions say so.

## 5. Test Deprecation & Ledger Governance (§S001, §S005, §S014)

**What may be deleted.** Only a consumer unit test whose assertion is a behavior of a platform
component now owned upstream — internal class names, radius, icon rendering, a copy of
`Stepper`'s `aria-current`, `AdaptiveButton` label collapse, `draftHistoryReducer` stack limits.

**What must stay.** Domain mapping tests, CSV parsing tests, and every integration suite
(`CsvImportSheet.*.test.tsx` mapping / review / commit / upload, `Step*.test.tsx` wizard flow
logic, route mounting, permission gating, context wiring). A test that mixes the two is
**rewritten** to assert the consumer wiring against the platform component, not deleted.

**MLBTracker `AppSidebar.test.tsx` / `PageHeader.test.tsx`.** Read each case first: platform
internals are deleted; consumer wiring (nav items from settings, permission filtering, route
mounting) is kept and re-pointed to the bedrock components.

**Traceability (decision #9).** Every deleted consumer test file appears in the PR 2
description in a table:

| Deleted consumer file | Cases removed | Upstream file in `packages/bedrock-ui` | Upstream cases covering it |
| --------------------- | ------------- | -------------------------------------- | -------------------------- |

The upstream column must be a real path and real `it(` names, verified by reading the file at
the `v0.13.1` tag. A deleted case with no upstream coverage is not deleted. The suite count
before and after is stated, and the delta equals the table.

**Ledger (§S014, decision #10).** `docs/reference/bedrock-issues-to-file.md` in each consumer:
an entry whose fix shipped in `v0.13.1` and is now adopted (PR 1 and PR 2 on `master`, pins
verified) is **deleted outright**, not marked resolved. Entries not resolved by this release
stay. The deletion lives in PR 2 and the PR description lists each removed entry by number.
The audit that gates it is `python -m bedrock.tools.s014_audit_ledger_freshness`.

## 6. Upstream Issue Logging (Phase 2 of the adoption workflow)

Filed in `djntechnic/bedrock` during CollectIt PR 2 (after PR 1 has merged), through the
`issue-triage` skill, each after a `search_issues` duplicate check, labelled `origin:<consumer>`:

| # | Issue | Type |
| - | ----- | ---- |
| 1 | `CommandPalette` navigation does not call `requestLeave`; its routes come from `registerCommandRoutes`, not `navRegistry` (§S011 gap). | defect |
| 2 | `mlbtracker-*` localStorage keys in `sidebarStore` and `ThemeContext` leak a consumer name into the platform. | defect |
| 3 | `bg-black/10`-style overlays inside the shadcn primitives violate §S009. | defect |
| 4 | `REQ-HDR-003`: a `TypographyProvider` that title-cases `PageHeader` text. | feature |
| 5 | Configurable app branding via `app_config_settings` (`brand` as data, not a code prop). | feature |
| 6 | Promote MLBTracker's Theme Manager into `@djntechnic/bedrock-ui`. | feature |

Each issue gets a numbered ledger row in the PR 2 of the consumer it affects (§S014): CollectIt
records 1, 3, 4, 5; MLBTracker records 2, 5, 6. Issue 1 is the upstream home for the §4
navigation limits and CollectIt's PR 2 description links it.

## 7. Gates

| Tier | When | Commands |
| ---- | ---- | -------- |
| Fast | Pre-commit | `python -m bedrock.tools.s012_audit_pins --root .` and `python -m bedrock.tools.s001_audit_duplicates --root .` |
| Full | Pre-merge | `python scripts/run_qa.py --mode full` and `python -m bedrock.tools.run_all --root .` |

Every command is judged by its own exit code (`$LASTEXITCODE -eq 0`), never through a pipe.
CI is watched with a background `gh pr checks <pr> --watch`; no sleep loops. After each merge,
`git pull origin master` and `git status --porcelain` must be empty (§S006 invariant 9).
`npm install --no-audit --no-fund` only — never `--legacy-peer-deps`.

## 8. Risks

1. **Frozen custom-theme snapshots.** Upstream backfills `--foreground-strong` and `--scrim`
   for themes saved before the release (`patchLegacyCssVars`). MLBTracker's Theme Manager is the
   likeliest holder of old snapshots; PR 1 verifies a pre-existing custom theme renders the
   selected rail card and the mobile backdrop.
2. **Silent brand regression.** MLBTracker loses its baseball mark and "Analytics" line unless
   `brand` is passed; PR 1 asserts both render.
3. **Save-and-continue data loss.** A rejected save must leave the session dirty and not run
   the parked navigation. Consumers do not re-implement the guard, so this is covered upstream,
   but the migrated surfaces keep one integration test each that proves their `onSave` rejection
   path leaves the form dirty.
4. **Test deletion without coverage.** Mitigated by the traceability table (§5).
5. **Tag absent.** Nothing downstream starts until Task 2 verifies the tag on the remote.
