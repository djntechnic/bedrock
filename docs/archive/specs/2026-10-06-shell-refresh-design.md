# Shell Refresh & Standard Edit Session — Design Spec

**Date:** 2026-10-06
**Status:** Approved for planning
**Plan:** [`docs/plans/2026-10-06-shell-refresh.md`](../plans/2026-10-06-shell-refresh.md)

## 1. Problem

A review of `@djntechnic/bedrock-ui` and the CollectIt frontend found five gaps.

1. **The app shell is assembled by every consumer.** CollectIt's `App.tsx` hand-builds the
   header (`<header class="app-header …">`), the sidebar content margin (`ml-0` / `ml-16` /
   `ml-60`), and three main-column layouts. MLBTracker repeats it. bedrock exports the
   pieces (`AppSidebar`, `AppFooter`, `GlobalSearchBar`) but not the frame, so a shell fix
   ships once per consumer instead of once.
2. **There is no standard edit / save / cancel primitive.** `GridEditor` owns a private
   save handler, dirty badge, `beforeunload` listener, and Ctrl/Cmd+S binding.
   `WorkbenchShell` takes a bare `dirty` boolean and can only *discard* — it has no notion
   of saving. Every consumer workbench page re-derives saving state, error state, and
   leave-guarding on its own.
3. **`WorkbenchShell` references tokens that do not exist.** It uses
   `text-foreground-strong` and `scroll-thin`; neither is defined in `styles/tokens.css`.
   The selected rail card silently renders in the default foreground and the rail scrollbar
   is unstyled. This is a shipped defect.
4. **Reusable CollectIt UI is domain-free but lives in the consumer.** `AdaptiveButton`,
   the wizard stepper inside `CsvImportSheet`, the undo/redo history reducer in
   `useBulkDrafts`, and the sticky selection bar carry no CollectIt vocabulary.
5. **The shell looks dated and brands itself wrong.** The sidebar shows a baseball SVG and
   the literal subtitle "Analytics" in every application. The active nav item is a ring
   box. `PageHeader` draws a gradient rule. The mobile backdrop is `bg-black/40`, a bare
   hue utility banned by §S009.

## 2. Goals

- bedrock owns the shell frame (`AppShell`, `AppHeader`) and audits consumers for local
  copies (§S001).
- bedrock owns one edit-session primitive (`useEditSession`, `useRecordForm`, `SaveBar`,
  `UndoRedoControls`, `UnsavedChangesDialog`) used by `GridEditor` and `WorkbenchShell`.
- Promote the domain-free CollectIt pieces: `AdaptiveButton` family, `Stepper`,
  `WizardDialog`, `draftHistory` / `useDraftHistory`, `SelectionDock`.
- Modernise within the existing token system: token-driven motion gated on reduced motion,
  rounder nav rows with a bar indicator, an account menu, calmer page header.

## 3. Non-goals

- No change to the configurable navigation model. `AppSidebar` keeps rendering
  `useNavSettings().navItems`; Admin → Navigation overrides (label, icon, tooltip, hidden,
  sort order) apply exactly as today (§S011).
- No change to `DataGrid`'s bulk-edit engine (`draftsOverride`, `bulkDraftStore`, cell
  selection, fill, paste). The new history hook wraps it; it does not replace it.
- No staged-row, CSV-validation, or text-equality logic — those stay in CollectIt.
- No health chips in the footer.
- No edits to any consumer repository (§S012). Consumers adopt after the next release.
- No new runtime tunable. The "saved" state is not a timed flash, so nothing needs an
  `app_config_settings` key (§S004).

## 4. Design

### 4.1 Tokens (defect fix)

| Token | Light | Dark | Use |
| ----- | ----- | ---- | --- |
| `--foreground-strong` | `220 65% 25%` | `210 40% 98%` | Emphasised text on a tinted surface (selected rail card). |
| `--scrim` | `222 47% 11%` | `220 40% 4%` | Backdrop behind an overlay; consumed as `bg-scrim/40`. |

Both get `--color-*` entries in `@theme`. A `@utility scroll-thin` is added
(`scrollbar-width: thin`, thumb from `--muted-foreground`).

Propagation per §S009: `tokens.css` `:root` and `.dark`; every `BUILT_IN_THEMES` entry
(light themes use their own `--primary` for `--foreground-strong`); `buildCssVars` for
derived custom themes; `patchLegacyCssVars` for custom themes with a frozen snapshot.

### 4.2 Sidebar

- `brand?: { mark?: ReactNode; subtitle?: string }`. Default mark is the first letter of
  the app name. There is **no default subtitle**. **Breaking:** the baseball SVG and the
  "Analytics" line are removed.
- Mobile backdrop uses `bg-scrim/40`.
- Width transition uses `--motion-base` / `--ease-standard` and is applied in code only
  when `useMediaQuery("(prefers-reduced-motion: reduce)")` is false (the existing
  hook; no new one is added).
- Nav rows are `rounded-lg`; the active row shows a leading bar
  (`data-testid="nav-active-indicator"`) instead of a ring.
- Expanded state: the user row becomes an **Account menu** popover (Profile, Sign out).
  Collapsed state is unchanged.

### 4.3 Shell frame

- `AppFooter`: `{appName} · built on bedrock`. `tagline` stays optional.
- `PageHeader`: gradient rule removed; actions centre on the title row.
- `AppHeader`: the `app-header` bar, with the mobile navigation button built in and
  `children` / `actions` slots.
- `AppShell`: `layout: "default" | "workbench" | "fullBleed"`; computes the sidebar
  margin; hides the header on `fullBleed`; mounts `UnsavedChangesDialog`.
  It does not mount providers or the router — those stay with the consumer.
- S001 audit gains invariant 9: a consumer file rendering `<header … app-header …>`
  fails unless exempted or marked `@shadows AppHeader`.

### 4.4 Edit session

```text
useEditSession({ dirty, onSave, onBeforeSave?, onCancel?, guardNavigation?, saveShortcut? }) -> EditSession
EditSession = { dirty, saving, status, error, save(), cancel(), guard(action) }
status      = "idle" | "saving" | "saved" | "error"
```

- `save()` resolves `true` on success, `false` on rejection or when not dirty / already
  saving. A rejection is logged through `log` and leaves the session dirty.
- `onBeforeSave` is a veto: returning `false` makes `save()` resolve `false` without
  calling `onSave` and without entering the error state (a validation stop is not a
  failure). Throwing from it is a failure.
- While dirty, the session registers in `editSessionStore` and arms `beforeunload`.
- Consumers mount `<BrowserRouter>`, so react-router's `useBlocker` is unavailable. Route
  leaving is guarded cooperatively: `editSessionStore.requestLeave(action)` parks the
  action while any session is dirty; `UnsavedChangesDialog` resolves it. `AppSidebar`
  intercepts plain left-clicks on its links and calls `requestLeave`. **Known limit:** browser back/forward and programmatic
  `navigate()` elsewhere are covered only by `beforeunload`-on-unload, not the dialog.
- `saveShortcut?: boolean` (default `false`) binds Ctrl/Cmd+S to `save()`.
- `UndoRedoControls({ canUndo, canRedo, onUndo, onRedo, disabled? })` — Ctrl/Cmd+Z undo,
  Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redo, ignored while typing in a field.
- `SaveBar({ session, history? })` renders, in order, `[Undo | Redo]` (only with
  `history`), Cancel, Save, plus a status line. Labels collapse to icons when the enclosing
  `@container` bar is narrower than 280px. `SaveBar` does not declare the container
  itself: an inline-size container that is also a shrink-to-fit flex item collapses to
  zero width, so the bar that hosts it declares `@container` (`ADAPTIVE_BAR`, §4.7).
  Cancel and Save are disabled while clean or saving.
- **Permission (§S010):** `SaveBar` takes no permission prop. A caller without the right
  wraps it in the existing `<Can module action="update">`, which *unmounts* the mutating
  controls rather than disabling them.
- `useRecordForm<T>({ initialValues, onSave, onBeforeSave?, autosave?, autosaveDelayMs?,
  maxHistory? })` is the record-level engine built on `useEditSession`: field values, an
  undo/redo stack (default depth 10) flushed on every successful save, baseline
  re-anchoring when `initialValues` changes, optional debounced autosave (default 600 ms,
  a per-call option rather than a global tunable), and `lastSavedAt`. It never raises a
  toast — the caller decides how to announce a result — and it carries no `any`.
- `GridEditor` adopts the hook and `SaveBar`, keeping its toasts, log lines, Ctrl/Cmd+S
  binding, and its own screen-filter confirm.

Source requirements: `REQ-ENG-001..006`, `REQ-SEC-001..003`, `REQ-TLB-001..004` in the
platform component standards notes. Deviations from the notes' sample code: no `any`
(§S005); the engine does not call `toast`; `Can` already exists and resolves through
`useSecurity().can(module, action)` with `ActionType = view | update | delete | execute`
(there is no `create` action); the toolbar is `SaveBar`, not a second `RecordToolbar`; the
container query is declared by the host bar, not the toolbar root (reason above).

### 4.5 WorkbenchShell

- Rail cards: `rounded-lg`, `hover:bg-muted`.
- New optional `session?: EditSession`. `dirty` becomes optional
  (`session?.dirty ?? dirty ?? false`) — non-breaking. With a session, the inline guard
  gains **Save and continue**, and Discard also calls `session.cancel()`.

### 4.6 Wizard

- `Stepper({ steps, current })` — pill list, `aria-current="step"` on the current pill.
- `WizardDialog` — `Dialog`-based; header with `Stepper`; only the step body scrolls;
  Back / Next / finish in the footer.

### 4.7 Bulk-edit helpers

- `AdaptiveButton`, `IconAction`, `Hint`, `collapseClass`, `ADAPTIVE_BAR` — moved verbatim.
- `draftHistoryReducer` + `useDraftHistory()` — undo/redo (limit 50) over `BulkDrafts`;
  returns a `draftsOverride` ready for `<DataGrid>`.
- `SelectionDock({ count, onClear, children })` — the sticky selection toolbar. Callers
  compose `UndoRedoControls` (§4.4) inside it.

## 5. Delivery

Seven phases, one branch and one draft PR each (§S006), merged in order:

| Phase | Branch | Content |
| ----- | ------ | ------- |
| 1 | `fix/shell-tokens` | §4.1 |
| 2 | `feat/app-sidebar-refresh` | §4.2 |
| 3 | `feat/app-shell` | §4.3 |
| 4 | `feat/edit-session` | §4.4 |
| 5 | `feat/workbench-session` | §4.5 |
| 6 | `feat/wizard-primitives` | §4.6 |
| 7 | `feat/bulk-edit-primitives` | §4.7 |

## 6. Consumer impact (for the CHANGELOG)

- **Breaking:** sidebar no longer shows "Analytics" or the baseball mark. Pass `brand` to
  restore a mark or subtitle.
- **Breaking (audit gate):** S001 fails a consumer that still hand-rolls
  `<header class="app-header">`. Adopt `AppShell` / `AppHeader`, or mark `@shadows`.
- Additive: everything else. `WorkbenchShell.dirty` is now optional.

## 7. Follow-ups to file, not fix here (§S014)

- `CommandPalette` navigation does not call `requestLeave`, and its routes come from
  `registerCommandRoutes`, a registry separate from `navRegistry` (§S011 gap).
- `mlbtracker-*` localStorage keys in `sidebarStore` and `ThemeContext`.
- `bg-black/10`-style overlays inside the shadcn primitives.
- `REQ-HDR-003` from the component standards notes: a `TypographyProvider` that title-cases
  `PageHeader` text. No such provider exists in bedrock; it is a separate feature.
