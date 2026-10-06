# Shell Refresh & Standard Edit Session Implementation Plan

> **Delivery via Triage Plan:** Hand off this plan directly to the `/triage-plan` skill:
> ```pwsh
> /triage-plan docs/plans/2026-10-06-shell-refresh.md
> ```
> This ingests discrete tasks, maps domain-to-agent delegations, injects runtime invariants
> (active virtualenv/python, direct exit status, lockstep pins, <30s delta testing), and supervises execution.

**Goal:** Make bedrock own the application shell frame and one standard edit / save / cancel
primitive, fix the two undefined shell tokens, and promote the domain-free wizard and
bulk-edit helpers out of CollectIt.

**Architecture:** Everything lands in `@djntechnic/bedrock-ui` as additive exports behind the
barrel, in seven phases that each ship as one branch and one draft PR. The edit session is a
hook (`useEditSession`) plus a small Zustand store that parks navigation while any session is
dirty; `SaveBar`, `useRecordForm`, `GridEditor`, and `WorkbenchShell` all consume that one
hook. One backend change extends the S001 audit so a consumer that keeps a hand-rolled
`app-header` fails the gate.

**Tech Stack:** React 18.3, TypeScript (strict, `verbatimModuleSyntax`), Tailwind v4
(`@theme`, `@utility`, container queries), Zustand 4, Radix primitives via the in-repo
shadcn wrappers, react-router-dom 6, Vitest 2 + Testing Library (jsdom), Python 3 + pytest
for the audit.

**Spec:** [`docs/specs/2026-10-06-shell-refresh-design.md`](file:///c:/Dev/bedrock/docs/specs/2026-10-06-shell-refresh-design.md)

## Global Constraints

- **All commands run from the repo root `C:\Dev\bedrock`.** The npm manifest and
  `vitest.config.ts` live there, not in `packages/bedrock-ui/`.
- **No business domain (platform boundary).** Nothing in this plan may name a CollectIt or
  MLBTracker entity. Test fixtures use neutral names (`Acme`, `Reports`, `Alpha`).
- **§S001:** every new component and hook is exported from
  `packages/bedrock-ui/src/index.ts`. New files use **named exports** and are added to the
  barrel with `export * from`.
- **§S003:** log through `import { log } from "../utils/logger"` with a structured first
  argument. No `console.*`.
- **§S004:** no new runtime tunable. `autosaveDelayMs` (600) and `maxHistory` (10) are
  per-call options with defaults, not global settings. The sidebar keeps reading
  `grid.tooltipDelayDuration` from `useAppSettings()`.
- **§S005:** every task is test-first. No `it.skip`, no `any`, no `@ts-ignore` /
  `@ts-expect-error`, no `as unknown as` casts in new code (stub globals with
  `vi.stubGlobal` and restore with `vi.unstubAllGlobals()`). Test files are type-checked.
- **§S006:** one branch and one draft PR per phase, cut from updated `master`, merged in
  phase order. Never commit to `master`. Conventional Commits. A `fix:` commit carries its
  reproduction test. Watch CI with a background `gh pr checks <pr> --watch`; never
  `sleep`-poll. Force-pushing needs explicit user authorization every time.
- **§S008:** this plan and its spec are archived by the final task.
- **§S009:** no literal hex / rgb / hsl and no bare hue utility (`bg-black/40`,
  `text-red-600`) outside `tokens.css` and `theme/palettes.ts`. A new colour token reaches
  all four surfaces: `tokens.css`, every built-in theme, `buildCssVars`,
  `patchLegacyCssVars`. Motion that a test asserts is gated in code with
  `useMediaQuery("(prefers-reduced-motion: reduce)")`.
- **§S010:** mutating controls are hidden, not disabled, for a caller without permission:
  wrap `SaveBar` in the existing `<Can module="…" action="update">`. `ActionType` is
  `"view" | "update" | "delete" | "execute"`; there is no `"create"`.
- **§S011:** the sidebar keeps rendering `useNavSettings().navItems`. No task adds a
  hardcoded link list.
- **§S012:** no file under `c:\Dev\CollectIt` or `c:\Dev\MLBTracker` is edited.
- **§S014:** each phase opens one GitHub issue before its first commit. The phase 1 issue is
  a defect and carries the four RCA phases. Out-of-scope findings are filed, not patched.
- **§S015:** the plan does not edit `CHANGELOG.md`; each PR body fills the template's
  `### Changelog Entry`, and `/cut-release` assembles the release notes.
- **Install:** `npm install --no-audit --no-fund`. Never `--legacy-peer-deps`.
- **Exact copy (from the spec):** footer attribution is `built on bedrock`; guard title is
  `Discard unsaved changes?`; guard buttons are `Keep editing`, `Save and continue`,
  `Discard`; `SaveBar` status strings are `Saving…`, `Save failed`, `Unsaved changes`,
  `All changes saved`.
- **Exact token values (from the spec):** `--foreground-strong` light `220 65% 25%`, dark
  `210 40% 98%`; `--scrim` light `222 47% 11%`, dark `220 40% 4%`.

## Review Focus

1. **A custom theme saved before this release has a frozen `cssVars` snapshot with neither
   new token**, so the selected rail card and the mobile backdrop would render with an
   unresolved colour for exactly the users who customised their theme. Test:
   `backfills the shell tokens into a frozen legacy snapshot` in Task 1.
2. **A save that rejects must leave the session dirty and must not run the parked
   navigation** — otherwise "Save and continue" silently discards the operator's edits.
   Tests: `stays dirty and reports the error when onSave rejects` in Task 10 and
   `does not navigate when the save fails` in Task 16.
3. **A second Save while the first is in flight** (double-click, or Ctrl+S plus a click)
   must not send two writes. Test: `ignores a second save while one is in flight` in Task 10.
4. **Reduced motion:** a user who prefers reduced motion must get no width transition on
   the sidebar. Test: `drops the width transition when the user prefers reduced motion` in
   Task 3.
5. **A bulk write that changes nothing** (typing the value a cell already has) must not
   consume an undo slot, or Ctrl+Z appears to do nothing. Test:
   `does not spend an undo slot on a write that changes nothing` in Task 20.

---

## File Map

All paths are under `packages/bedrock-ui/src/` unless they start with `packages/bedrock-api/`.

| File | Phase | Responsibility |
| ---- | ----- | -------------- |
| `styles/tokens.css` (modify) | 1 | `--foreground-strong`, `--scrim`, `@utility scroll-thin`. |
| `theme/palettes.ts` (modify) | 1 | Both tokens in every built-in theme. |
| `context/ThemeContext.tsx` (modify) | 1 | Derivation and legacy backfill for both tokens. |
| `components/AppSidebar.tsx` (modify) | 2, 4 | Brand slot, scrim, indicator, motion gate, account menu; leave guard on links. |
| `components/AppFooter.tsx` (modify) | 3 | `built on bedrock` attribution. |
| `components/PageHeader.tsx` (modify) | 3 | Gradient rule removed. |
| `components/AppHeader.tsx` (create) | 3 | The `app-header` bar with the mobile nav button. |
| `components/AppShell.tsx` (create) | 3, 4 | Frame: sidebar + column + header + main + footer; mounts the leave dialog. |
| `packages/bedrock-api/bedrock/tools/s001_audit_duplicates.py` (modify) | 3 | Flags a consumer's local `app-header`. |
| `store/editSessionStore.ts` (create) | 4 | Registry of dirty sessions and the parked leave action. |
| `hooks/useEditSession.ts` (create) | 4 | The save / cancel / guard state machine. |
| `components/UndoRedoControls.tsx` (create) | 4 | Undo / Redo buttons and shortcuts. |
| `components/SaveBar.tsx` (create) | 4 | Status line, Cancel, Save. |
| `hooks/useRecordForm.ts` (create) | 4 | Record-level values + history on top of `useEditSession`. |
| `components/UnsavedChangesDialog.tsx` (create) | 4 | Resolves a parked leave. |
| `components/admin/gridEditor/GridEditor.tsx` (modify) | 4 | First adopter of the session and `SaveBar`. |
| `components/WorkbenchShell/WorkbenchShell.tsx` (modify) | 5 | `session` prop, "Save and continue", rounder cards. |
| `components/Stepper.tsx` (create) | 6 | Wizard progress pills. |
| `components/WizardDialog.tsx` (create) | 6 | Dialog frame for a multi-step flow. |
| `components/AdaptiveButton.tsx` (create) | 7 | Label-collapsing buttons for a container-query bar. |
| `components/grids/draftHistory.ts` (create) | 7 | Undo / redo over `BulkDrafts`. |
| `components/SelectionDock.tsx` (create) | 7 | Sticky selection toolbar. |
| `index.ts` (modify) | 3–7 | Barrel exports. |

## Phase Protocol

Each phase is one branch and one draft PR. The **first** task of a phase cuts the branch and
opens the issue; the **last** task of a phase opens the draft PR. A phase starts only after
the previous phase's PR is merged, because later phases import earlier ones (phase 4 edits
`AppShell` from phase 3; phase 5 imports `EditSession` from phase 4).

The branch a task runs on is stated on the task. If `git branch --show-current` does not
match, stop and fix the branch before editing.

Two test-environment facts every frontend task depends on:

- jsdom has **no `window.matchMedia`**. Any test that renders a component calling
  `useMediaQuery` must mock `../hooks/useMediaQuery` or stub `matchMedia`.
- jsdom has **no `ResizeObserver`**. `WorkbenchShell` tests stub it.

---

## Phase 1 — `fix/shell-tokens`

### Task 1: Define the missing shell tokens

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Branch:** `fix/shell-tokens` (created in Step 1).

**Files:**
- Modify: `packages/bedrock-ui/src/styles/tokens.css` (after each `--ring:` line, after `--color-ring:`, after `@variant dark`)
- Modify: `packages/bedrock-ui/src/theme/palettes.ts` (after each `"--ring"` entry)
- Modify: `packages/bedrock-ui/src/context/ThemeContext.tsx` (`buildCssVars`, `patchLegacyCssVars`)
- Test: `packages/bedrock-ui/src/styles/tokens.test.ts` (create)
- Test: `packages/bedrock-ui/src/context/ThemeContext.shellTokens.test.ts` (create)

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/styles/tokens.test.ts packages/bedrock-ui/src/context/ThemeContext.shellTokens.test.ts`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Cut the branch and file the defect issue (§S006, §S014)**

```pwsh
git checkout master
git pull origin master
git checkout -b fix/shell-tokens
$body = @'
## Phase 1 — Origin & Trace
`packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.tsx` applies `text-foreground-strong` to the selected rail card and `scroll-thin` to the rail list. Neither name is defined in `packages/bedrock-ui/src/styles/tokens.css`.
Repro: `Select-String -Path packages/bedrock-ui/src/styles/tokens.css -Pattern "foreground-strong|scroll-thin"` returns nothing.

## Phase 2 — Pattern Analysis
Tailwind v4 emits no CSS for a utility whose theme key does not exist, and raises no error. The selected card renders in the default foreground and the rail scrollbar is unstyled. `AppSidebar` has the adjacent problem: its mobile backdrop is `bg-black/40`, a bare hue utility banned by S009, because no scrim token exists.

## Phase 3 — Root-Cause Hypothesis
WorkbenchShell was promoted from a consumer whose stylesheet defined both names locally; the tokens were not promoted with it. No test asserts that a class used by a platform component resolves to a token.

## Phase 4 — Test Specification Contract
- `styles/tokens.test.ts`: `tokens.css` defines `--foreground-strong` and `--scrim` in both `:root` and `.dark`, maps both in `@theme`, and declares `@utility scroll-thin`.
- `context/ThemeContext.shellTokens.test.ts`: every built-in theme, a derived custom theme, and a legacy custom theme with a frozen snapshot all resolve both tokens.
'@
gh issue create --title "WorkbenchShell references undefined tokens (foreground-strong, scroll-thin)" --label bug --body $body
```

Expected: `gh` prints the new issue URL. Record its number as `<ISSUE>` for Step 8.

- [ ] **Step 2: Write the failing tests**

```ts
// packages/bedrock-ui/src/styles/tokens.test.ts
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "tokens.css"), "utf8");
const count = (needle: string) => css.split(needle).length - 1;

describe("tokens.css shell tokens", () => {
  it("defines --foreground-strong for both the light and dark roots", () => {
    expect(count("--foreground-strong:")).toBe(2);
  });

  it("defines --scrim for both the light and dark roots", () => {
    expect(count("--scrim:")).toBe(2);
  });

  it("maps both tokens into the Tailwind theme", () => {
    expect(css).toContain("--color-foreground-strong: hsl(var(--foreground-strong));");
    expect(css).toContain("--color-scrim: hsl(var(--scrim));");
  });

  it("declares the scroll-thin utility", () => {
    expect(css).toContain("@utility scroll-thin");
  });
});
```

```ts
// packages/bedrock-ui/src/context/ThemeContext.shellTokens.test.ts
import { describe, expect, it } from "vitest";
import {
  BUILT_IN_THEMES,
  buildCssVars,
  patchLegacyCssVars,
  type ThemePalette,
} from "./ThemeContext";

const HSL_TRIPLET = /^\d+ \d+% \d+%$/;

/** A user-made theme: the six colours of a built-in, and no stored snapshot. */
function derivedFrom(id: string): ThemePalette {
  const source = BUILT_IN_THEMES.find((theme) => theme.id === id);
  if (!source) throw new Error(`no built-in theme "${id}"`);
  return {
    id: `custom-${id}`,
    name: `Custom ${source.name}`,
    builtIn: false,
    isDark: source.isDark,
    colorPrimary: source.colorPrimary,
    colorSecondary: source.colorSecondary,
    colorBackground: source.colorBackground,
    colorAccent: source.colorAccent,
    colorDestructive: source.colorDestructive,
    colorBorder: source.colorBorder,
  };
}

describe("shell tokens across theme surfaces", () => {
  it("ships both tokens in every built-in theme", () => {
    for (const theme of BUILT_IN_THEMES) {
      const vars = buildCssVars(theme);
      expect(vars["--foreground-strong"], theme.id).toMatch(HSL_TRIPLET);
      expect(vars["--scrim"], theme.id).toMatch(HSL_TRIPLET);
    }
  });

  it("derives a strong foreground from the primary on a light custom theme", () => {
    const vars = buildCssVars(derivedFrom("mlb-classic"));
    expect(vars["--foreground-strong"]).toBe(vars["--primary"]);
    expect(vars["--scrim"]).toBe("222 47% 11%");
  });

  it("derives a near-white strong foreground on a dark custom theme", () => {
    const vars = buildCssVars(derivedFrom("night-game"));
    expect(vars["--foreground-strong"]).toBe("210 40% 98%");
    expect(vars["--scrim"]).toBe("220 40% 4%");
  });

  it("backfills the shell tokens into a frozen legacy snapshot", () => {
    const legacy: ThemePalette = {
      ...derivedFrom("mlb-classic"),
      cssVars: { "--primary": "200 50% 30%" },
    };
    const patched = patchLegacyCssVars(legacy);
    expect(patched.cssVars?.["--foreground-strong"]).toBe("200 50% 30%");
    expect(patched.cssVars?.["--scrim"]).toBe("222 47% 11%");
    expect(patched.cssVars?.["--primary"]).toBe("200 50% 30%");
  });

  it("leaves an already-patched snapshot untouched", () => {
    const legacy: ThemePalette = {
      ...derivedFrom("mlb-classic"),
      cssVars: { "--primary": "200 50% 30%" },
    };
    const once = patchLegacyCssVars(legacy);
    expect(patchLegacyCssVars(once)).toBe(once);
  });
});
```

- [ ] **Step 3: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/styles/tokens.test.ts packages/bedrock-ui/src/context/ThemeContext.shellTokens.test.ts`
Expected: FAIL — `tokens.test.ts` counts are 0, and the ThemeContext file fails to import `buildCssVars` / `patchLegacyCssVars` (not exported). `$LASTEXITCODE -ne 0`.

- [ ] **Step 4: Add the tokens to `tokens.css`**

In the first `@layer base { :root { … } }` block, directly after the line `--ring: 220 65% 25%;`:

```css
    /* Emphasised text on a tinted surface (selected rail card). */
    --foreground-strong: 220 65% 25%;
    /* Backdrop behind an overlay; consumed with alpha, e.g. bg-scrim/40. */
    --scrim: 222 47% 11%;
```

In the `.dark { … }` block, directly after the line `--ring: 214 82% 56%;`:

```css
    --foreground-strong: 210 40% 98%;
    --scrim: 220 40% 4%;
```

In the `@theme { … }` block, directly after the line `--color-ring: hsl(var(--ring));`:

```css
  --color-foreground-strong: hsl(var(--foreground-strong));
  --color-scrim: hsl(var(--scrim));
```

Directly after the line `@variant dark (&:where(.dark, .dark *));`:

```css

@utility scroll-thin {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground) / 0.4) transparent;
}
```

- [ ] **Step 5: Add the tokens to every built-in theme**

In `packages/bedrock-ui/src/theme/palettes.ts`, add two entries directly after the `"--ring"` entry of each theme's `cssVars`. Light themes reuse their own `--ring` (primary) value for the strong foreground.

`mlb-classic` (after `"--ring": "220 65% 25%",`):

```ts
      "--foreground-strong": "220 65% 25%",
      "--scrim": "222 47% 11%",
```

`night-game` (after `"--ring": "214 82% 56%",`):

```ts
      "--foreground-strong": "210 40% 98%",
      "--scrim": "220 40% 4%",
```

`emerald-diamond` (after `"--ring": "155 55% 22%",`):

```ts
      "--foreground-strong": "155 55% 22%",
      "--scrim": "222 47% 11%",
```

`cardinal-red` (after `"--ring": "355 74% 30%",`):

```ts
      "--foreground-strong": "355 74% 30%",
      "--scrim": "222 47% 11%",
```

Match the indentation of the neighbouring entries in each block.

- [ ] **Step 6: Derive and backfill the tokens in `ThemeContext.tsx`**

Export both functions: change `function buildCssVars(` to `export function buildCssVars(` and `function patchLegacyCssVars(` to `export function patchLegacyCssVars(`.

In `buildCssVars`, in the returned object, directly after the `"--ring": hexToHsl(palette.colorPrimary),` entry (`bgDark` and `fg` are already in scope there):

```ts
    "--foreground-strong": bgDark
      ? "210 40% 98%"
      : isDark(palette.colorPrimary)
        ? hexToHsl(palette.colorPrimary)
        : fg,
    "--scrim": bgDark ? "220 40% 4%" : "222 47% 11%",
```

Directly below the existing `RANK_TOKEN_KEYS` constant:

```ts
const SHELL_TOKEN_KEYS = ["--foreground-strong", "--scrim"] as const;
```

Replace the whole `patchLegacyCssVars` function with:

```ts
export function patchLegacyCssVars(palette: ThemePalette): ThemePalette {
  if (!palette.cssVars) return palette;
  const missingScoreboard = SCOREBOARD_TOKEN_KEYS.some((key) => !(key in palette.cssVars!));
  const missingChart = CHART_TOKEN_KEYS.some((key) => !(key in palette.cssVars!));
  const missingRank = RANK_TOKEN_KEYS.some((key) => !(key in palette.cssVars!));
  const missingShell = SHELL_TOKEN_KEYS.some((key) => !(key in palette.cssVars!));
  if (!missingScoreboard && !missingChart && !missingRank && !missingShell) return palette;
  return {
    ...palette,
    cssVars: {
      "--scoreboard-accent": palette.isDark ? "38 92% 62%" : "38 92% 55%",
      "--live-pulse": palette.isDark ? "330 88% 66%" : "330 85% 55%",
      "--rank-gold": palette.isDark ? "43 96% 62%" : "43 96% 56%",
      "--rank-silver": palette.isDark ? "215 20% 72%" : "215 20% 65%",
      "--rank-bronze": palette.isDark ? "27 96% 66%" : "27 96% 61%",
      "--chart-1": "var(--primary)",
      "--chart-2": "var(--scoreboard-accent)",
      "--chart-3": "var(--positive)",
      "--foreground-strong": palette.isDark
        ? "210 40% 98%"
        : (palette.cssVars["--primary"] ?? "222 47% 11%"),
      "--scrim": palette.isDark ? "220 40% 4%" : "222 47% 11%",
      ...palette.cssVars,
    },
  };
}
```

The `palette.cssVars!` non-null assertions are the file's existing style inside the `.some` callbacks; keep them. The HSL triplets here are theme source values in a file exempt from the §S009 literal scan (`ThemeContext.tsx` is in `exempt_paths`).

- [ ] **Step 7: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/styles/tokens.test.ts packages/bedrock-ui/src/context/ThemeContext.shellTokens.test.ts`
Expected: PASS, 9 tests, `$LASTEXITCODE -eq 0`.

If `derives a strong foreground from the primary on a light custom theme` fails because `isDark(colorPrimary)` is false for `mlb-classic`, the derivation is still correct (a light primary falls back to `fg`); do **not** weaken the implementation — report it as a Class B blocker, because the spec assumes built-in light themes have a dark primary.

- [ ] **Step 8: Commit, gate, and open the draft PR**

```pwsh
git add packages/bedrock-ui/src/styles/tokens.css packages/bedrock-ui/src/styles/tokens.test.ts packages/bedrock-ui/src/theme/palettes.ts packages/bedrock-ui/src/context/ThemeContext.tsx packages/bedrock-ui/src/context/ThemeContext.shellTokens.test.ts
git commit -m "fix(tokens): define foreground-strong, scrim and scroll-thin used by the shell"
npm test
npm run typecheck
git push -u origin fix/shell-tokens
$pr = @'
## Summary
WorkbenchShell used two names that tokens.css never defined. This defines them, and a scrim token for overlay backdrops, on every theme surface.

Closes #<ISSUE>

## Changes
- `tokens.css`: `--foreground-strong`, `--scrim` (light + dark), `@theme` colour entries, `@utility scroll-thin`.
- `theme/palettes.ts`: both tokens in all four built-in themes.
- `ThemeContext.tsx`: `buildCssVars` derives both for custom themes; `patchLegacyCssVars` backfills frozen snapshots. Both functions are now exported.

## Test Plan
- [x] Frontend: `npm test`
- [x] `npm run typecheck`

### Changelog Entry
**Fixed** — The selected WorkbenchShell rail card now renders in the strong foreground and the rail scrollbar is thin, as designed.
**Root Cause & Escape:** WorkbenchShell was promoted from a consumer whose stylesheet defined `foreground-strong` and `scroll-thin` locally; the tokens were not promoted with it, and Tailwind emits nothing — and no error — for an unknown utility.
**Prevention:** `styles/tokens.test.ts` asserts the tokens exist on every surface; `ThemeContext.shellTokens.test.ts` covers built-in, derived, and legacy custom themes.

## Platform Standards Checklist
- [x] S005 reproduction tests added
- [x] S009 token propagated to tokens.css, built-in themes, derived themes, legacy snapshots

## Notes
`buildCssVars` and `patchLegacyCssVars` are now part of the public barrel (via `export * from "./context/ThemeContext"`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
'@
gh pr create --draft --base master --title "fix(tokens): define the shell tokens WorkbenchShell references" --body $pr
```

Replace `<ISSUE>` with the number from Step 1 before running. Then start `gh pr checks <pr> --watch` as a background task and yield. Expected: both CI jobs exit 0. Phase 2 starts after this PR is merged.

---

---

## Phase 2 — `feat/app-sidebar-refresh`

### Task 2: Brand slot & scrim backdrop

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-ui/src/components/AppSidebar.tsx`
- Test: `packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for brand slot and scrim backdrop**

Create `packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "./ui/tooltip";
import AppSidebar, { type AppSidebarProps } from "./AppSidebar";
import type { NavItem } from "./navRegistry";

const mockState = {
  pinned: true,
  hovered: false,
  mobileOpen: false,
  isMobile: false,
  reducedMotion: false,
  togglePinned: vi.fn(),
  setHovered: vi.fn(),
  setMobileOpen: vi.fn(),
};

vi.mock("../store/sidebarStore", () => ({
  useSidebarStore: vi.fn((selector) => selector(mockState)),
}));

vi.mock("../store/commandPaletteStore", () => ({
  useCommandPaletteStore: vi.fn((selector) => selector({ open: false, setOpen: vi.fn() })),
}));

vi.mock("../hooks/useAppSettings", () => ({
  useAppSettings: () => ({
    system: { appName: "Acme Warehouse" },
    grid: { tooltipDelayDuration: 0 },
  }),
}));

vi.mock("../hooks/useMediaQuery", () => ({
  useMediaQuery: (query: string) => {
    if (query.includes("prefers-reduced-motion")) return mockState.reducedMotion;
    if (query.includes("max-width")) return mockState.isMobile;
    return false;
  },
}));

const TEST_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: () => <span data-testid="icon-dashboard" />, exact: true },
  { to: "/reports", label: "Reports", icon: () => <span data-testid="icon-reports" /> },
];

vi.mock("../hooks/useNavSettings", () => ({
  useNavSettings: () => ({
    navItems: TEST_NAV,
    isLoading: false,
  }),
}));

const mockAuth = {
  user: { email: "dan@example.com", display_name: "Dan N" },
  token: "xyz",
  isLoading: false,
  isAuthenticated: true,
  isAdmin: true,
  hasRole: () => true,
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  completeGoogleLogin: vi.fn(),
  logout: vi.fn(),
  setSession: vi.fn(),
};

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("../hooks/useModules", () => ({
  useModules: () => ({
    hasModule: () => true,
    enabledModules: ["reports"],
  }),
}));

vi.mock("../hooks/useSecurity", () => ({
  useSecurity: () => ({
    can: () => true,
  }),
}));

function renderSidebar(props: AppSidebarProps = {}, initialRoute = "/") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <TooltipProvider>
        <AppSidebar {...props} />
      </TooltipProvider>
    </MemoryRouter>
  );
}

describe("AppSidebar Shell Refresh - Brand & Backdrop", () => {
  beforeEach(() => {
    mockState.pinned = true;
    mockState.isMobile = false;
    mockState.mobileOpen = false;
    mockState.reducedMotion = false;
  });

  it("renders the first letter of appName as default brand mark and removes baseball SVG", () => {
    renderSidebar();
    const mark = screen.getByTestId("sidebar-brand-mark");
    expect(mark.textContent).toBe("A");
    expect(document.querySelector("svg circle")).toBeNull();
  });

  it("renders custom brand mark when supplied", () => {
    renderSidebar({ brand: { mark: <span data-testid="custom-mark">★</span> } });
    expect(screen.getByTestId("custom-mark")).toBeDefined();
  });

  it("does not render Analytics subtitle by default", () => {
    renderSidebar();
    expect(screen.queryByText("Analytics")).toBeNull();
  });

  it("renders custom brand subtitle when supplied", () => {
    renderSidebar({ brand: { subtitle: "Enterprise Console" } });
    expect(screen.getByText("Enterprise Console")).toBeDefined();
  });

  it("uses bg-scrim/40 for mobile drawer backdrop", () => {
    mockState.isMobile = true;
    mockState.mobileOpen = true;
    renderSidebar();
    const backdrop = screen.getByTestId("sidebar-mobile-backdrop");
    expect(backdrop.className).toContain("bg-scrim/40");
    expect(backdrop.className).not.toContain("bg-black/40");
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`  
Expected: FAIL (`sidebar-brand-mark` not found, `bg-scrim/40` not found). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement brand prop and scrim backdrop in `AppSidebar.tsx`**

1. Update `AppSidebarProps` interface:
```tsx
export interface AppSidebarProps {
  profilePath?: string | null;
  brand?: {
    mark?: ReactNode;
    subtitle?: string;
  };
}
```

2. In the component signature, destructure `brand`:
```tsx
export default function AppSidebar({
  profilePath = "/profile",
  brand,
}: AppSidebarProps = {}) {
```

3. Update mobile backdrop markup (around line 196):
```tsx
      <div
        data-testid="sidebar-mobile-backdrop"
        className="fixed inset-0 z-40 bg-scrim/40"
        onClick={() => setMobileOpen(false)}
      />
```

4. Update the brand header block (around lines 213–240), replacing the baseball SVG and hardcoded "Analytics":
```tsx
      <div className="h-14 flex items-center px-3 border-b border-border shrink-0 overflow-hidden bg-primary/5">
        <Link
          to="/"
          className="flex items-center gap-2.5 min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div
            data-testid="sidebar-brand-mark"
            className="shrink-0 h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shadow-sm text-sm font-bold"
          >
            {brand?.mark ?? system.appName.trim().charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight text-foreground tracking-tight truncate">
                {system.appName}
              </p>
              {brand?.subtitle && (
                <p className="text-[10px] text-muted-foreground leading-tight font-medium tracking-wide uppercase">
                  {brand.subtitle}
                </p>
              )}
            </div>
          )}
        </Link>
      </div>
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`  
Expected: PASS, 5 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(sidebar): add brand slot and replace backdrop with scrim token"`

---

### Task 3: Active row indicator & motion gating

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-ui/src/components/AppSidebar.tsx`
- Test: `packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Add failing tests for active indicator and motion gating**

Append to `packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`:

```tsx
describe("AppSidebar Shell Refresh - Indicator & Motion", () => {
  it("renders active indicator bar and rounded-lg rows without ring box", () => {
    renderSidebar({}, "/");
    const activeIndicator = screen.getByTestId("nav-active-indicator");
    expect(activeIndicator).toBeDefined();
    expect(activeIndicator.className).toContain("bg-primary");

    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    expect(dashboardLink.className).toContain("rounded-lg");
    expect(dashboardLink.className).not.toContain("ring-1");
  });

  it("gates sidebar width transition on reduced motion", () => {
    mockState.reducedMotion = false;
    const { container, rerender } = renderSidebar();
    const aside = container.querySelector("aside.app-sidebar");
    expect(aside?.className).toContain("transition-[width]");

    mockState.reducedMotion = true;
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <TooltipProvider>
          <AppSidebar />
        </TooltipProvider>
      </MemoryRouter>
    );
    expect(aside?.className).not.toContain("transition-[width]");
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`  
Expected: FAIL (`nav-active-indicator` not found). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement active indicator and motion gating in `AppSidebar.tsx`**

1. Gating motion:
Read `prefers-reduced-motion`:
```tsx
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
```

Update aside classes:
Replace:
```tsx
  "transition-all duration-200 ease-in-out motion-reduce:transition-none",
```
with:
```tsx
  prefersReducedMotion
    ? ""
    : "transition-[width] duration-[var(--motion-base)] ease-[var(--ease-standard)]",
```

2. Navigation item styling:
Update collapsed parent Link:
Change `rounded-md` to `rounded-lg`.
Replace `active ? "bg-primary/10 text-primary ring-1 ring-primary/20" : ...` with:
```tsx
  active
    ? "bg-primary/10 text-primary font-semibold"
    : "text-muted-foreground hover:bg-muted hover:text-foreground"
```

Update expanded parent Link:
Change `rounded-md` to `rounded-lg`, add `relative`:
```tsx
  [
    "relative flex-1 flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium",
    "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-primary/10 text-primary font-semibold"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  ].join(" ")
```

Directly inside the expanded parent Link, render the active leading bar:
```tsx
  {active && (
    <span
      data-testid="nav-active-indicator"
      aria-hidden="true"
      className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary"
    />
  )}
```

Update child item links:
Change `rounded-md` to `rounded-lg`.

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`  
Expected: PASS, 7 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(sidebar): add active indicator bar and gate width transition on reduced motion"`

---

### Task 4: Account menu popover in expanded state

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-ui/src/components/AppSidebar.tsx`
- Test: `packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`
- Test: `packages/bedrock-ui/src/components/AppSidebar.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx packages/bedrock-ui/src/components/AppSidebar.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Add failing tests for account menu popover**

Append to `packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`:

```tsx
import { fireEvent } from "@testing-library/react";

describe("AppSidebar Shell Refresh - Account Menu", () => {
  it("renders Account menu trigger and opens popover on click", () => {
    renderSidebar({ profilePath: "/profile" });
    const trigger = screen.getByRole("button", { name: /Account menu/i });
    expect(trigger).toBeDefined();
    expect(trigger.textContent).toContain("Dan N");

    fireEvent.click(trigger);

    expect(screen.getByRole("link", { name: /Profile/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Sign out/i })).toBeDefined();
  });

  it("calls logout when Sign out is clicked inside Account menu", () => {
    renderSidebar();
    const trigger = screen.getByRole("button", { name: /Account menu/i });
    fireEvent.click(trigger);

    const signOutBtn = screen.getByRole("button", { name: /Sign out/i });
    fireEvent.click(signOutBtn);
    expect(mockAuth.logout).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx`  
Expected: FAIL (`Account menu` button not found). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement Account menu popover in `AppSidebar.tsx`**

1. Import `Popover, PopoverContent, PopoverTrigger` from `./ui/popover`:
```tsx
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
```

2. Replace the expanded user section (around lines 500–550):
```tsx
              <div className="flex items-center justify-between gap-1">
                {user ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        aria-label="Account menu"
                        className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                            {(user.display_name || user.email || "U").trim().charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{user.display_name || user.email}</span>
                        </div>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-1.5 text-xs">
                      <div className="px-2 py-1.5 text-muted-foreground border-b border-border mb-1">
                        <p className="font-semibold text-foreground truncate">{user.display_name || "Account"}</p>
                        <p className="truncate text-[11px]">{user.email}</p>
                      </div>
                      {profilePath && (
                        <Link
                          to={profilePath}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-foreground transition-colors"
                        >
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>Profile</span>
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          void logout();
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-destructive transition-colors text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign out</span>
                      </button>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Link
                    to="/login"
                    title="Sign in"
                    className="flex-1 flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <LogOut className="h-4 w-4 rotate-180 shrink-0" />
                    <span>Sign in</span>
                  </Link>
                )}
                {!isMobile && (
                  <button
                    type="button"
                    onClick={togglePinned}
                    title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
                    className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </button>
                )}
              </div>
```

3. Run existing `packages/bedrock-ui/src/components/AppSidebar.test.tsx` and adjust any assertions expecting the old separate `View profile` Link or `Analytics` text to match the updated contract.

- [ ] **Step 4: Run delta verification to verify both test suites pass**

Command: `npx vitest run packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx packages/bedrock-ui/src/components/AppSidebar.test.tsx`  
Expected: PASS, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit, gate, and open draft PR for Phase 2**

```pwsh
git add packages/bedrock-ui/src/components/AppSidebar.tsx packages/bedrock-ui/src/components/AppSidebar.shell.test.tsx packages/bedrock-ui/src/components/AppSidebar.test.tsx
git commit -m "feat(sidebar): add brand slot, active bar indicator, and account popover"
npm test
npm run typecheck
git push -u origin feat/app-sidebar-refresh
$pr = @'
## Summary
Modernizes AppSidebar with custom brand slots, token-gated motion, rounder nav rows, active bar indicator, and an account popover.

Closes #<ISSUE>

## Changes
- `AppSidebar.tsx`: `brand?: { mark?: ReactNode; subtitle?: string }` prop.
- Removed hardcoded baseball SVG and default "Analytics" subtitle.
- Backdrop uses `--scrim` token (`bg-scrim/40`).
- Nav rows use `rounded-lg`; active item shows leading bar indicator.
- Sidebar width transition gated on `prefers-reduced-motion`.
- Expanded user section becomes an Account popover menu.

## Test Plan
- [x] Frontend: `npm test`
- [x] `npm run typecheck`

### Changelog Entry
**Added** — `AppSidebar` accepts `brand?: { mark?: ReactNode; subtitle?: string }`.
**Breaking Changes** — `AppSidebar` no longer shows "Analytics" or the baseball logo by default. Pass `brand` to restore a custom mark or subtitle.
'@
gh pr create --draft --base master --title "feat(sidebar): modernize AppSidebar with brand slot, active bar indicator, and account popover" --body $pr
```

---

## Phase 3 — `feat/app-shell`

### Task 5: Standardize AppFooter attribution

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Files:**
- Modify: `packages/bedrock-ui/src/components/AppFooter.tsx`
- Modify: `packages/bedrock-ui/src/index.ts`
- Test: `packages/bedrock-ui/src/components/AppFooter.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/AppFooter.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for AppFooter**

Create `packages/bedrock-ui/src/components/AppFooter.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "./ui/tooltip";
import AppFooter from "./AppFooter";

vi.mock("../context/KeyboardShortcutsContext", () => ({
  useKeyboardShortcuts: () => ({ open: vi.fn() }),
}));

vi.mock("../hooks/useAppSettings", () => ({
  useAppSettings: () => ({
    system: { appName: "Acme Collect" },
  }),
}));

function renderFooter(props = {}) {
  return render(
    <TooltipProvider>
      <AppFooter {...props} />
    </TooltipProvider>
  );
}

describe("AppFooter", () => {
  it("renders appName and built on bedrock attribution", () => {
    renderFooter();
    expect(screen.getByText("Acme Collect")).toBeDefined();
    const attr = screen.getByTestId("footer-attribution");
    expect(attr.textContent).toBe("built on bedrock");
  });

  it("renders tagline between appName and attribution when provided", () => {
    renderFooter({ tagline: "Inventory Manager" });
    expect(screen.getByText("Acme Collect")).toBeDefined();
    expect(screen.getByText("Inventory Manager")).toBeDefined();
    expect(screen.getByTestId("footer-attribution").textContent).toBe("built on bedrock");
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/AppFooter.test.tsx`  
Expected: FAIL (`footer-attribution` not found). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Update `AppFooter.tsx` and barrel export**

In `packages/bedrock-ui/src/components/AppFooter.tsx`:
Update the left info row inside `<footer className="app-footer ...">`:

```tsx
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary/60" />
            </div>
            <span className="font-semibold text-foreground/80">{appName}</span>
            {tagline ? (
              <>
                <span className="text-border">·</span>
                <span>{tagline}</span>
              </>
            ) : null}
            <span className="text-border">·</span>
            <span data-testid="footer-attribution" className="text-muted-foreground/80">
              built on bedrock
            </span>
          </div>
```

In `packages/bedrock-ui/src/index.ts`:
Export `AppFooterProps`:
```tsx
export { default as AppFooter } from "./components/AppFooter";
export type { AppFooterProps } from "./components/AppFooter";
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/AppFooter.test.tsx`  
Expected: PASS, 2 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(shell): standardize AppFooter attribution to built on bedrock"`

---

### Task 6: Modernize PageHeader baseline & drop gradient

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Files:**
- Modify: `packages/bedrock-ui/src/components/PageHeader.tsx`
- Test: `packages/bedrock-ui/src/components/PageHeader.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/PageHeader.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Add failing tests for PageHeader baseline and gradient removal**

In `packages/bedrock-ui/src/components/PageHeader.test.tsx`, add test cases:

```tsx
  it("aligns title and actions on the center baseline without extra top padding", () => {
    render(<PageHeader title="Overview" actions={<button>Add</button>} />);
    const titleRow = screen.getByText("Overview").closest("div");
    expect(titleRow?.parentElement?.className).toContain("items-center");

    const actionsContainer = screen.getByText("Add").parentElement;
    expect(actionsContainer?.className).not.toContain("pt-0.5");
  });

  it("does not render the gradient separator bar", () => {
    const { container } = render(<PageHeader title="Overview" />);
    expect(container.querySelector(".bg-gradient-to-r")).toBeNull();
  });
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/PageHeader.test.tsx`  
Expected: FAIL (gradient bar still found, `items-start` still present). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Update `PageHeader.tsx`**

In `packages/bedrock-ui/src/components/PageHeader.tsx`:
1. Change title row from `items-start` to `items-center`:
```tsx
      <div className="flex items-center justify-between gap-4">
```
2. Remove `pt-0.5` from actions container:
```tsx
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
```
3. Remove the gradient separator element at the bottom of the component:
Delete:
```tsx
      <div className="h-[2px] bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/PageHeader.test.tsx`  
Expected: PASS, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(shell): align PageHeader actions on title baseline and drop gradient rule"`

---

### Task 7: AppHeader bar with mobile navigation trigger

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-ui/src/components/AppHeader.tsx`
- Test: `packages/bedrock-ui/src/components/AppHeader.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/AppHeader.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for AppHeader**

Create `packages/bedrock-ui/src/components/AppHeader.tsx` test harness `packages/bedrock-ui/src/components/AppHeader.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AppHeader from "./AppHeader";

const mockSidebar = {
  mobileOpen: false,
  setMobileOpen: vi.fn(),
};

vi.mock("../store/sidebarStore", () => ({
  useSidebarStore: vi.fn((selector) => selector(mockSidebar)),
}));

describe("AppHeader", () => {
  beforeEach(() => {
    mockSidebar.mobileOpen = false;
    mockSidebar.setMobileOpen.mockClear();
  });

  it("renders header with app-header class and children", () => {
    render(
      <AppHeader actions={<button>User</button>}>
        <input placeholder="Search" />
      </AppHeader>
    );

    const header = document.querySelector("header.app-header");
    expect(header).toBeDefined();
    expect(screen.getByPlaceholderText("Search")).toBeDefined();
    expect(screen.getByRole("button", { name: "User" })).toBeDefined();
  });

  it("toggles mobileOpen when mobile hamburger button is clicked", () => {
    render(<AppHeader />);
    const menuBtn = screen.getByRole("button", { name: /Open navigation/i });
    fireEvent.click(menuBtn);
    expect(mockSidebar.setMobileOpen).toHaveBeenCalledWith(true);
  });

  it("renders Close navigation label when mobile drawer is open", () => {
    mockSidebar.mobileOpen = true;
    render(<AppHeader />);
    expect(screen.getByRole("button", { name: /Close navigation/i })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/AppHeader.test.tsx`  
Expected: FAIL (Cannot find module `./AppHeader`). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `AppHeader.tsx`**

Create `packages/bedrock-ui/src/components/AppHeader.tsx`:

```tsx
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { useSidebarStore } from "../store/sidebarStore";

export interface AppHeaderProps {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function AppHeader({ children, actions, className }: AppHeaderProps) {
  const mobileOpen = useSidebarStore((s) => s.mobileOpen);
  const setMobileOpen = useSidebarStore((s) => s.setMobileOpen);

  return (
    <header
      className={cn(
        "app-header sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6",
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden shrink-0"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 ml-4">{actions}</div>}
    </header>
  );
}
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/AppHeader.test.tsx`  
Expected: PASS, 3 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(shell): implement AppHeader component with mobile drawer toggle"`

---

### Task 8: AppShell frame with layout modes & sidebar offsets

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-ui/src/components/AppShell.tsx`
- Modify: `packages/bedrock-ui/src/index.ts`
- Test: `packages/bedrock-ui/src/components/AppShell.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/AppShell.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for AppShell**

Create `packages/bedrock-ui/src/components/AppShell.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AppShell from "./AppShell";

const mockSidebar = {
  pinned: false,
  hovered: false,
};

vi.mock("../store/sidebarStore", () => ({
  useSidebarStore: vi.fn((selector) => selector(mockSidebar)),
}));

vi.mock("../hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => false),
}));

describe("AppShell", () => {
  beforeEach(() => {
    mockSidebar.pinned = false;
    mockSidebar.hovered = false;
  });

  it("calculates ml-16 when sidebar is collapsed on desktop", () => {
    render(
      <AppShell sidebar={<div data-testid="sidebar" />} header={<div data-testid="header" />}>
        <div>Content</div>
      </AppShell>
    );

    const mainColumn = screen.getByTestId("app-shell-main-column");
    expect(mainColumn.className).toContain("ml-16");
    expect(screen.getByTestId("header")).toBeDefined();
  });

  it("calculates ml-60 when sidebar is pinned on desktop", () => {
    mockSidebar.pinned = true;
    render(
      <AppShell sidebar={<div data-testid="sidebar" />} header={<div data-testid="header" />}>
        <div>Content</div>
      </AppShell>
    );

    const mainColumn = screen.getByTestId("app-shell-main-column");
    expect(mainColumn.className).toContain("ml-60");
  });

  it("hides header when layout is fullBleed", () => {
    render(
      <AppShell layout="fullBleed" header={<div data-testid="header" />}>
        <div>Content</div>
      </AppShell>
    );

    expect(screen.queryByTestId("header")).toBeNull();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/AppShell.test.tsx`  
Expected: FAIL (Cannot find module `./AppShell`). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `AppShell.tsx` and barrel exports**

Create `packages/bedrock-ui/src/components/AppShell.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { useSidebarStore } from "../store/sidebarStore";
import { useMediaQuery } from "../hooks/useMediaQuery";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import AppFooter from "./AppFooter";
import GlobalSearchBar from "./GlobalSearchBar";

export interface AppShellProps {
  layout?: "default" | "workbench" | "fullBleed";
  sidebar?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode | null;
  children: ReactNode;
  className?: string;
}

export default function AppShell({
  layout = "default",
  sidebar,
  header,
  footer,
  children,
  className,
}: AppShellProps) {
  const isMobile = useMediaQuery("(max-width: 1023px)");
  const pinned = useSidebarStore((s) => s.pinned);
  const hovered = useSidebarStore((s) => s.hovered);

  const sidebarOffset = isMobile ? "ml-0" : pinned || hovered ? "ml-60" : "ml-16";

  const resolvedSidebar = sidebar ?? <AppSidebar />;
  const resolvedHeader =
    layout === "fullBleed" ? null : (header ?? <AppHeader><GlobalSearchBar /></AppHeader>);
  const resolvedFooter = footer === null ? null : (footer ?? <AppFooter />);

  return (
    <div className={cn("min-h-screen bg-background text-foreground flex flex-col", className)}>
      {resolvedSidebar}
      <div
        data-testid="app-shell-main-column"
        className={cn("flex flex-1 flex-col min-h-screen transition-all duration-200", sidebarOffset)}
      >
        {resolvedHeader}
        <main
          className={cn(
            "flex-1 min-h-0 flex flex-col",
            layout === "default" && "p-4 sm:p-6",
            layout === "workbench" && "p-0 overflow-hidden",
            layout === "fullBleed" && "p-0"
          )}
        >
          {children}
        </main>
        {resolvedFooter}
      </div>
    </div>
  );
}
```

In `packages/bedrock-ui/src/index.ts`, add the barrel exports:
```tsx
export { default as AppHeader } from "./components/AppHeader";
export type { AppHeaderProps } from "./components/AppHeader";
export { default as AppShell } from "./components/AppShell";
export type { AppShellProps } from "./components/AppShell";
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/AppShell.test.tsx`  
Expected: PASS, 3 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(shell): implement AppShell layout wrapper and export from barrel"`

---

### Task 9: Backend S001 audit invariant 9 for hand-rolled app-header

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-api/bedrock/tools/s001_audit_duplicates.py`
- Test: `packages/bedrock-api/tests/test_audit_s001_to_s004.py`

**Delta Verification:**
- Command: `python -m pytest packages/bedrock-api/tests/test_audit_s001_to_s004.py -k "app_header or chrome" -q`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for S001 invariant 9**

In `packages/bedrock-api/tests/test_audit_s001_to_s004.py`, add test cases:

```python
def test_s001_flags_local_app_header(tmp_path: Path):
    app_file = tmp_path / "frontend" / "src" / "App.tsx"
    app_file.parent.mkdir(parents=True, exist_ok=True)
    app_file.write_text(
        '<header className="app-header flex items-center"><div>Custom</div></header>',
        encoding="utf-8",
    )
    (tmp_path / "bedrock.toml").write_text("[tool.bedrock.audit.s001]\nexemptions = []\n")
    from bedrock.tools.s001_audit_duplicates import find_shell_chrome_violations
    violations = find_shell_chrome_violations(tmp_path, [])
    assert len(violations) == 1
    assert "app-header" in violations[0]


def test_s001_allows_app_header_with_shadows_marker(tmp_path: Path):
    app_file = tmp_path / "frontend" / "src" / "App.tsx"
    app_file.parent.mkdir(parents=True, exist_ok=True)
    app_file.write_text(
        '/** @shadows AppHeader */\n<header className="app-header"><div>Custom</div></header>',
        encoding="utf-8",
    )
    (tmp_path / "bedrock.toml").write_text("[tool.bedrock.audit.s001]\nexemptions = []\n")
    from bedrock.tools.s001_audit_duplicates import find_shell_chrome_violations
    violations = find_shell_chrome_violations(tmp_path, [])
    assert len(violations) == 0


def test_s001_passes_without_local_app_header(tmp_path: Path):
    app_file = tmp_path / "frontend" / "src" / "App.tsx"
    app_file.parent.mkdir(parents=True, exist_ok=True)
    app_file.write_text(
        'import { AppShell } from "@djntechnic/bedrock-ui";\nexport default function App() { return <AppShell>Content</AppShell>; }',
        encoding="utf-8",
    )
    (tmp_path / "bedrock.toml").write_text("[tool.bedrock.audit.s001]\nexemptions = []\n")
    from bedrock.tools.s001_audit_duplicates import find_shell_chrome_violations
    violations = find_shell_chrome_violations(tmp_path, [])
    assert len(violations) == 0
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `python -m pytest packages/bedrock-api/tests/test_audit_s001_to_s004.py -k "app_header or chrome" -q`  
Expected: FAIL (`ImportError: cannot import name 'find_shell_chrome_violations'`). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement invariant 9 in `s001_audit_duplicates.py`**

1. In docstring, add invariant 9:
```text
           9. No hand-rolled `<header ... app-header ...>` in consumer apps;
              must compose `AppHeader` / `AppShell` or declare `@shadows AppHeader`.
```

2. Regex definition:
```python
_LOCAL_APP_HEADER = re.compile(r"<header[^>]*app-header", re.M)
```

3. Violation finder:
```python
def find_shell_chrome_violations(root: Path, exemptions: list[str]) -> list[str]:
    violations: list[str] = []
    for path in _source_files(root):
        rel = path.relative_to(root).as_posix()
        if _is_exempt(rel, exemptions):
            continue
        if rel.startswith("packages/bedrock-ui/"):
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if _LOCAL_APP_HEADER.search(text):
            shadows = _shadows_of(path)
            if "AppHeader" not in shadows and "AppShell" not in shadows:
                violations.append(
                    f"{rel} renders a hand-rolled `<header ... app-header ...>`. "
                    f"Adopt platform `<AppShell>` / `<AppHeader>` from @djntechnic/bedrock-ui, "
                    f"or mark the file header with `@shadows AppHeader`."
                )
    return violations
```

4. Wire into `main()` before reporter render:
```python
    chrome_violations = find_shell_chrome_violations(root, exemptions)
    if chrome_violations:
        for violation in chrome_violations:
            reporter.start_check("Checking application shell chrome components")
            reporter.fail_check(violation)
    else:
        reporter.start_check("Checking application shell chrome components")
        reporter.pass_check("no hand-rolled app-header elements found")
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `python -m pytest packages/bedrock-api/tests/test_audit_s001_to_s004.py -k "app_header or chrome" -q`  
Expected: PASS, 3 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit, gate, and open draft PR for Phase 3**

```pwsh
git add packages/bedrock-ui/src/components/AppFooter.tsx packages/bedrock-ui/src/components/AppFooter.test.tsx packages/bedrock-ui/src/components/PageHeader.tsx packages/bedrock-ui/src/components/PageHeader.test.tsx packages/bedrock-ui/src/components/AppHeader.tsx packages/bedrock-ui/src/components/AppHeader.test.tsx packages/bedrock-ui/src/components/AppShell.tsx packages/bedrock-ui/src/components/AppShell.test.tsx packages/bedrock-ui/src/index.ts packages/bedrock-api/bedrock/tools/s001_audit_duplicates.py packages/bedrock-api/tests/test_audit_s001_to_s004.py
git commit -m "feat(shell): implement AppShell, AppHeader, AppFooter standardization, and S001 invariant 9"
npm test
npm run typecheck
pytest packages/bedrock-api/tests/ -q
git push -u origin feat/app-shell
$pr = @'
## Summary
Introduces platform-owned AppShell and AppHeader frames, standardizes AppFooter attribution, aligns PageHeader actions, and enforces invariant 9 in the S001 audit.

Closes #<ISSUE>

## Changes
- `AppFooter.tsx`: standardized attribution `appName · [tagline ·] built on bedrock`.
- `PageHeader.tsx`: centered action baseline and removed gradient line.
- `AppHeader.tsx`: shared app header with mobile hamburger trigger.
- `AppShell.tsx`: complete responsive shell with layout presets (`default`, `workbench`, `fullBleed`).
- `s001_audit_duplicates.py`: invariant 9 audit flagging hand-rolled `app-header`s in consumers.

## Test Plan
- [x] Backend pytest
- [x] Frontend: `npm test`
- [x] `npm run typecheck`

### Changelog Entry
**Added** — `AppShell` and `AppHeader` platform exports in `@djntechnic/bedrock-ui`.
**Changed** — `AppFooter` displays `built on bedrock` attribution.
**Breaking Changes (Audit)** — S001 audit fails consumer apps hand-rolling `<header class="app-header">`.
'@
gh pr create --draft --base master --title "feat(shell): implement AppShell, AppHeader, and S001 chrome audit gate" --body $pr
```

---

## Phase 4 — `feat/edit-session`

### Task 10: In-memory EditSessionStore & useEditSession hook

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-ui/src/store/editSessionStore.ts`
- Create: `packages/bedrock-ui/src/hooks/useEditSession.ts`
- Test: `packages/bedrock-ui/src/store/editSessionStore.test.ts`
- Test: `packages/bedrock-ui/src/hooks/useEditSession.test.ts`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/store/editSessionStore.test.ts packages/bedrock-ui/src/hooks/useEditSession.test.ts`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for editSessionStore and useEditSession**

Create `packages/bedrock-ui/src/store/editSessionStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEditSessionStore, hasDirtySessions } from "./editSessionStore";

describe("editSessionStore", () => {
  beforeEach(() => {
    useEditSessionStore.setState({ sessions: {}, pendingLeave: null });
  });

  it("registers and unregisters dirty sessions", () => {
    const store = useEditSessionStore.getState();
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(false);

    store.register("session-1", vi.fn());
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(true);

    useEditSessionStore.getState().unregister("session-1");
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(false);
  });

  it("executes leave action immediately if no dirty session exists", () => {
    const action = vi.fn();
    useEditSessionStore.getState().requestLeave(action);
    expect(action).toHaveBeenCalled();
    expect(useEditSessionStore.getState().pendingLeave).toBeNull();
  });

  it("parks leave action when a dirty session exists and confirms leave cleanly", () => {
    const discard = vi.fn();
    const action = vi.fn();
    useEditSessionStore.getState().register("session-1", discard);

    useEditSessionStore.getState().requestLeave(action);
    expect(action).not.toHaveBeenCalled();
    expect(useEditSessionStore.getState().pendingLeave).not.toBeNull();

    useEditSessionStore.getState().confirmLeave();
    expect(discard).toHaveBeenCalled();
    expect(action).toHaveBeenCalled();
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(false);
    expect(useEditSessionStore.getState().pendingLeave).toBeNull();
  });

  it("cancels leave without discarding or navigating", () => {
    const discard = vi.fn();
    const action = vi.fn();
    useEditSessionStore.getState().register("session-1", discard);

    useEditSessionStore.getState().requestLeave(action);
    useEditSessionStore.getState().cancelLeave();

    expect(discard).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    expect(useEditSessionStore.getState().pendingLeave).toBeNull();
  });
});
```

Create `packages/bedrock-ui/src/hooks/useEditSession.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditSession } from "./useEditSession";
import { useEditSessionStore, hasDirtySessions } from "../store/editSessionStore";

vi.mock("../utils/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("useEditSession", () => {
  beforeEach(() => {
    useEditSessionStore.setState({ sessions: {}, pendingLeave: null });
  });

  it("initializes with idle status and clean state", () => {
    const { result } = renderHook(() =>
      useEditSession({ dirty: false, onSave: vi.fn() })
    );

    expect(result.current.dirty).toBe(false);
    expect(result.current.saving).toBe(false);
    expect(result.current.status).toBe("idle");
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(false);
  });

  it("registers in store and sets dirty when dirty is true", () => {
    const { result } = renderHook(() =>
      useEditSession({ dirty: true, onSave: vi.fn() })
    );

    expect(result.current.dirty).toBe(true);
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(true);
  });

  it("executes save successfully and updates status to saved", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useEditSession({ dirty: true, onSave })
    );

    let ok = false;
    await act(async () => {
      ok = await result.current.save();
    });

    expect(ok).toBe(true);
    expect(onSave).toHaveBeenCalled();
  });

  it("vetoes save when onBeforeSave returns false", async () => {
    const onSave = vi.fn();
    const onBeforeSave = vi.fn().mockReturnValue(false);
    const { result } = renderHook(() =>
      useEditSession({ dirty: true, onSave, onBeforeSave })
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.save();
    });

    expect(ok).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("stays dirty and reports error when onSave rejects", async () => {
    const error = new Error("Database timeout");
    const onSave = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() =>
      useEditSession({ dirty: true, onSave })
    );

    let ok = true;
    await act(async () => {
      ok = await result.current.save();
    });

    expect(ok).toBe(false);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(error);
    expect(result.current.dirty).toBe(true);
  });

  it("ignores a second save while one is in flight", async () => {
    let resolveSave: () => void = () => {};
    const deferred = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const onSave = vi.fn().mockReturnValue(deferred);

    const { result } = renderHook(() =>
      useEditSession({ dirty: true, onSave })
    );

    let firstPromise: Promise<boolean>;
    let secondPromise: Promise<boolean>;

    act(() => {
      firstPromise = result.current.save();
      secondPromise = result.current.save();
    });

    const secondResult = await secondPromise!;
    expect(secondResult).toBe(false);
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave();
      await firstPromise;
    });
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/store/editSessionStore.test.ts packages/bedrock-ui/src/hooks/useEditSession.test.ts`  
Expected: FAIL (Cannot find module). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `editSessionStore.ts` and `useEditSession.ts`**

Create `packages/bedrock-ui/src/store/editSessionStore.ts`:

```ts
import { create } from "zustand";

export interface EditSessionStore {
  sessions: Record<string, () => void>;
  pendingLeave: (() => void) | null;
  register: (id: string, onDiscard: () => void) => void;
  unregister: (id: string) => void;
  requestLeave: (action: () => void) => void;
  confirmLeave: () => void;
  cancelLeave: () => void;
}

export const useEditSessionStore = create<EditSessionStore>((set, get) => ({
  sessions: {},
  pendingLeave: null,

  register: (id, onDiscard) => {
    set((state) => ({
      sessions: { ...state.sessions, [id]: onDiscard },
    }));
  },

  unregister: (id) => {
    set((state) => {
      const rest = Object.fromEntries(
        Object.entries(state.sessions).filter(([key]) => key !== id)
      );
      return {
        sessions: rest,
        pendingLeave: Object.keys(rest).length === 0 ? null : state.pendingLeave,
      };
    });
  },

  requestLeave: (action) => {
    const { sessions } = get();
    if (Object.keys(sessions).length === 0) {
      action();
    } else {
      set({ pendingLeave: action });
    }
  },

  confirmLeave: () => {
    const { sessions, pendingLeave } = get();
    set({ sessions: {}, pendingLeave: null });
    Object.values(sessions).forEach((discard) => {
      try {
        discard();
      } catch {
        // Safe discard
      }
    });
    pendingLeave?.();
  },

  cancelLeave: () => {
    set({ pendingLeave: null });
  },
}));

export const hasDirtySessions = (state: EditSessionStore) =>
  Object.keys(state.sessions).length > 0;
```

Create `packages/bedrock-ui/src/hooks/useEditSession.ts`:

```ts
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { log } from "../utils/logger";
import { useEditSessionStore } from "../store/editSessionStore";

export type EditSessionStatus = "idle" | "saving" | "saved" | "error";

export interface UseEditSessionOptions {
  dirty: boolean;
  onSave: () => Promise<void> | void;
  onBeforeSave?: () => boolean | Promise<boolean>;
  onCancel?: () => void;
  guardNavigation?: boolean;
  saveShortcut?: boolean;
}

export interface EditSession {
  dirty: boolean;
  saving: boolean;
  status: EditSessionStatus;
  error: unknown;
  save: () => Promise<boolean>;
  cancel: () => void;
  guard: (action: () => void) => void;
}

export function useEditSession({
  dirty,
  onSave,
  onBeforeSave,
  onCancel,
  guardNavigation = true,
  saveShortcut = false,
}: UseEditSessionOptions): EditSession {
  const id = useId();
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<"none" | "saved" | "error">("none");
  const [error, setError] = useState<unknown>(null);
  const inFlight = useRef(false);

  const latest = useRef({ dirty, onSave, onBeforeSave, onCancel });
  latest.current = { dirty, onSave, onBeforeSave, onCancel };

  const save = useCallback(async (): Promise<boolean> => {
    if (!latest.current.dirty || inFlight.current) return false;
    inFlight.current = true;
    setSaving(true);
    setError(null);

    try {
      const allowed = (await latest.current.onBeforeSave?.()) ?? true;
      if (!allowed) {
        return false;
      }
      await latest.current.onSave();
      setOutcome("saved");
      return true;
    } catch (err) {
      setError(err);
      setOutcome("error");
      log.error({ err, action: "editSession.save.error" }, "useEditSession: save failed");
      return false;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, []);

  const cancel = useCallback(() => {
    setError(null);
    setOutcome("none");
    latest.current.onCancel?.();
  }, []);

  const guard = useCallback(
    (action: () => void) => {
      if (latest.current.dirty) {
        useEditSessionStore.getState().requestLeave(action);
      } else {
        action();
      }
    },
    []
  );

  useEffect(() => {
    if (dirty && guardNavigation) {
      const store = useEditSessionStore.getState();
      store.register(id, () => latest.current.onCancel?.());

      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = "";
      };
      window.addEventListener("beforeunload", handleBeforeUnload);

      return () => {
        store.unregister(id);
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [dirty, guardNavigation, id]);

  useEffect(() => {
    if (!saveShortcut) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveShortcut, save]);

  const status: EditSessionStatus = saving
    ? "saving"
    : outcome === "error"
      ? "error"
      : outcome === "saved" && !dirty
        ? "saved"
        : "idle";

  return useMemo(
    () => ({
      dirty,
      saving,
      status,
      error,
      save,
      cancel,
      guard,
    }),
    [dirty, saving, status, error, save, cancel, guard]
  );
}
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/store/editSessionStore.test.ts packages/bedrock-ui/src/hooks/useEditSession.test.ts`  
Expected: PASS, 9 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(edit-session): implement EditSessionStore and useEditSession hook"`

---

### Task 11: UndoRedoControls component & keyboard accelerators

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Files:**
- Create: `packages/bedrock-ui/src/components/UndoRedoControls.tsx`
- Test: `packages/bedrock-ui/src/components/UndoRedoControls.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/UndoRedoControls.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for UndoRedoControls**

Create `packages/bedrock-ui/src/components/UndoRedoControls.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UndoRedoControls from "./UndoRedoControls";

describe("UndoRedoControls", () => {
  it("renders buttons with disabled state and triggers callbacks on click", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const { rerender } = render(
      <UndoRedoControls canUndo={false} canRedo={false} onUndo={onUndo} onRedo={onRedo} />
    );

    const undoBtn = screen.getByRole("button", { name: /Undo/i });
    const redoBtn = screen.getByRole("button", { name: /Redo/i });
    expect(undoBtn).toBeDisabled();
    expect(redoBtn).toBeDisabled();

    rerender(
      <UndoRedoControls canUndo={true} canRedo={true} onUndo={onUndo} onRedo={onRedo} />
    );
    expect(undoBtn).not.toBeDisabled();
    expect(redoBtn).not.toBeDisabled();

    fireEvent.click(undoBtn);
    expect(onUndo).toHaveBeenCalled();
    fireEvent.click(redoBtn);
    expect(onRedo).toHaveBeenCalled();
  });

  it("handles Ctrl+Z and Ctrl+Y shortcuts except when editing an input", () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <div>
        <input data-testid="text-field" />
        <UndoRedoControls canUndo={true} canRedo={true} onUndo={onUndo} onRedo={onRedo} />
      </div>
    );

    fireEvent.keyDown(window, { key: "z", ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "y", ctrlKey: true });
    expect(onRedo).toHaveBeenCalledTimes(1);

    const input = screen.getByTestId("text-field");
    input.focus();
    fireEvent.keyDown(input, { key: "z", ctrlKey: true });
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/UndoRedoControls.test.tsx`  
Expected: FAIL (Cannot find module). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `UndoRedoControls.tsx`**

Create `packages/bedrock-ui/src/components/UndoRedoControls.tsx`:

```tsx
import { useEffect } from "react";
import { Undo2, Redo2 } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

export interface UndoRedoControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  disabled?: boolean;
  className?: string;
}

function isEditableTarget(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    element.hasAttribute("contenteditable")
  );
}

export default function UndoRedoControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  disabled = false,
  className,
}: UndoRedoControlsProps) {
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(document.activeElement)) return;
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      if (!isCmdOrCtrl) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        if (canUndo) {
          event.preventDefault();
          onUndo();
        }
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        if (canRedo) {
          event.preventDefault();
          onRedo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, onUndo, onRedo, disabled]);

  return (
    <div role="group" aria-label="History" className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        disabled={disabled || !canUndo}
        onClick={onUndo}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Redo"
        title="Redo (Ctrl+Y)"
        disabled={disabled || !canRedo}
        onClick={onRedo}
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/UndoRedoControls.test.tsx`  
Expected: PASS, 2 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(edit-session): implement UndoRedoControls component"`

---

### Task 12: SaveBar responsive toolbar with permission unmounting

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-ui/src/components/SaveBar.tsx`
- Test: `packages/bedrock-ui/src/components/SaveBar.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/SaveBar.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for SaveBar**

Create `packages/bedrock-ui/src/components/SaveBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SaveBar from "./SaveBar";
import type { EditSession } from "../hooks/useEditSession";
import { Can } from "../hooks/useSecurity";

vi.mock("../hooks/useSecurity", () => ({
  useSecurity: () => ({
    can: (module: string, action: string) => module === "allowed" && action === "update",
  }),
  Can: ({ module, action, children }: any) => {
    const isAllowed = module === "allowed" && action === "update";
    return isAllowed ? <>{children}</> : null;
  },
}));

function mockSession(overrides: Partial<EditSession> = {}): EditSession {
  return {
    dirty: false,
    saving: false,
    status: "idle",
    error: null,
    save: vi.fn().mockResolvedValue(true),
    cancel: vi.fn(),
    guard: vi.fn(),
    ...overrides,
  };
}

describe("SaveBar", () => {
  it("disables Save and Cancel when clean", () => {
    const session = mockSession({ dirty: false });
    render(<SaveBar session={session} />);

    expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeDisabled();
  });

  it("enables buttons and shows Unsaved changes status when dirty", () => {
    const session = mockSession({ dirty: true });
    render(<SaveBar session={session} />);

    expect(screen.getByRole("button", { name: /Save/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancel/i })).not.toBeDisabled();
    expect(screen.getByRole("status").textContent).toBe("Unsaved changes");

    fireEvent.click(screen.getByRole("button", { name: /Save/i }));
    expect(session.save).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(session.cancel).toHaveBeenCalled();
  });

  it("shows saving spinner and disables buttons during save", () => {
    const session = mockSession({ dirty: true, saving: true, status: "saving" });
    render(<SaveBar session={session} />);

    expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();
    expect(screen.getByRole("status").textContent).toBe("Saving…");
  });

  it("completely unmounts when wrapped in Can without permission per §S010", () => {
    const session = mockSession({ dirty: true });
    const { rerender } = render(
      <Can module="denied" action="update">
        <SaveBar session={session} />
      </Can>
    );

    expect(screen.queryByTestId("save-bar")).toBeNull();

    rerender(
      <Can module="allowed" action="update">
        <SaveBar session={session} />
      </Can>
    );
    expect(screen.getByTestId("save-bar")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/SaveBar.test.tsx`  
Expected: FAIL (Cannot find module). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `SaveBar.tsx`**

Create `packages/bedrock-ui/src/components/SaveBar.tsx`:

```tsx
import { Save, X, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import type { EditSession } from "../hooks/useEditSession";
import UndoRedoControls, { type UndoRedoControlsProps } from "./UndoRedoControls";

export interface SaveBarHistory {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export interface SaveBarProps {
  session: EditSession;
  history?: SaveBarHistory;
  saveLabel?: string;
  cancelLabel?: string;
  className?: string;
}

export default function SaveBar({
  session,
  history,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  className,
}: SaveBarProps) {
  const statusText = session.saving
    ? "Saving…"
    : session.status === "error"
      ? "Save failed"
      : session.dirty
        ? "Unsaved changes"
        : session.status === "saved"
          ? "All changes saved"
          : "";

  return (
    <div
      data-testid="save-bar"
      className={cn("flex items-center gap-1.5", className)}
    >
      {statusText && (
        <span
          role="status"
          className={cn(
            "text-xs font-medium mr-1.5",
            session.status === "error" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {statusText}
        </span>
      )}

      {history && (
        <UndoRedoControls
          className="border-r border-border pr-1.5"
          {...history}
          disabled={session.saving}
        />
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!session.dirty || session.saving}
        onClick={session.cancel}
        className="gap-1.5"
      >
        <X className="h-4 w-4" />
        <span className="@max-[280px]:sr-only">{cancelLabel}</span>
      </Button>

      <Button
        type="button"
        size="sm"
        disabled={!session.dirty || session.saving}
        onClick={() => {
          void session.save();
        }}
        className="gap-1.5"
      >
        {session.saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        <span className="@max-[280px]:sr-only">{saveLabel}</span>
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/SaveBar.test.tsx`  
Expected: PASS, 4 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(edit-session): implement responsive SaveBar component"`

---

### Task 13: useRecordForm hook with autosave and snapshot history

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `pro`

**Files:**
- Create: `packages/bedrock-ui/src/hooks/useRecordForm.ts`
- Test: `packages/bedrock-ui/src/hooks/useRecordForm.test.ts`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/hooks/useRecordForm.test.ts`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for useRecordForm**

Create `packages/bedrock-ui/src/hooks/useRecordForm.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecordForm } from "./useRecordForm";
import { useEditSessionStore } from "../store/editSessionStore";

vi.mock("../utils/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("useRecordForm", () => {
  beforeEach(() => {
    useEditSessionStore.setState({ sessions: {}, pendingLeave: null });
    vi.useRealTimers();
  });

  it("tracks field changes, dirty state, and undo/redo stacks", () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useRecordForm({
        initialValues: { name: "Alice", role: "Dev" },
        onSave,
      })
    );

    expect(result.current.session.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);

    act(() => {
      result.current.setFieldValue("name", "Bob");
    });

    expect(result.current.values.name).toBe("Bob");
    expect(result.current.session.dirty).toBe(true);
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.undo();
    });
    expect(result.current.values.name).toBe("Alice");
    expect(result.current.canRedo).toBe(true);
    expect(result.current.session.dirty).toBe(false);

    act(() => {
      result.current.redo();
    });
    expect(result.current.values.name).toBe("Bob");
  });

  it("re-anchors baseline when initialValues change externally without marking dirty", () => {
    const onSave = vi.fn();
    const { result, rerender } = renderHook(
      ({ initialValues }) => useRecordForm({ initialValues, onSave }),
      { initialProps: { initialValues: { name: "Alice" } } }
    );

    rerender({ initialValues: { name: "Charlie" } });
    expect(result.current.values.name).toBe("Charlie");
    expect(result.current.session.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it("flushes history and updates lastSavedAt on successful save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRecordForm({
        initialValues: { count: 1 },
        onSave,
      })
    );

    act(() => {
      result.current.setFieldValue("count", 2);
    });
    expect(result.current.canUndo).toBe(true);

    await act(async () => {
      await result.current.session.save();
    });

    expect(onSave).toHaveBeenCalledWith({ count: 2 });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.lastSavedAt).not.toBeNull();
  });

  it("triggers debounced autosave when configured", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useRecordForm({
        initialValues: { title: "Draft" },
        onSave,
        autosave: true,
        autosaveDelayMs: 600,
      })
    );

    act(() => {
      result.current.setFieldValue("title", "Updated");
    });
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(onSave).toHaveBeenCalledWith({ title: "Updated" });
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/hooks/useRecordForm.test.ts`  
Expected: FAIL (Cannot find module). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `useRecordForm.ts`**

Create `packages/bedrock-ui/src/hooks/useRecordForm.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditSession, type EditSession } from "./useEditSession";

export interface UseRecordFormOptions<T extends object> {
  initialValues: T;
  onSave: (values: T) => Promise<void> | void;
  onBeforeSave?: (values: T) => boolean | Promise<boolean>;
  autosave?: boolean;
  autosaveDelayMs?: number;
  maxHistory?: number;
}

export interface RecordForm<T extends object> {
  values: T;
  setFieldValue: <K extends keyof T>(field: K, value: T[K]) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  lastSavedAt: Date | null;
  session: EditSession;
}

interface FormState<T> {
  baseline: T;
  values: T;
  past: T[];
  future: T[];
}

export function useRecordForm<T extends object>({
  initialValues,
  onSave,
  onBeforeSave,
  autosave = false,
  autosaveDelayMs = 600,
  maxHistory = 10,
}: UseRecordFormOptions<T>): RecordForm<T> {
  const [state, setState] = useState<FormState<T>>(() => ({
    baseline: initialValues,
    values: initialValues,
    past: [],
    future: [],
  }));
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const stateRef = useRef(state);
  stateRef.current = state;

  const handlers = useRef({ onSave, onBeforeSave });
  handlers.current = { onSave, onBeforeSave };

  const initialKey = useMemo(() => JSON.stringify(initialValues), [initialValues]);
  const seenKey = useRef(initialKey);

  useEffect(() => {
    if (seenKey.current !== initialKey) {
      seenKey.current = initialKey;
      setState({
        baseline: initialValues,
        values: initialValues,
        past: [],
        future: [],
      });
    }
  }, [initialKey, initialValues]);

  const isDirty = useMemo(() => {
    return JSON.stringify(state.values) !== JSON.stringify(state.baseline);
  }, [state.values, state.baseline]);

  const setFieldValue = useCallback(
    <K extends keyof T>(field: K, value: T[K]) => {
      setState((prev) => {
        if (Object.is(prev.values[field], value)) return prev;
        const nextValues = { ...prev.values, [field]: value };
        const nextPast = [...prev.past.slice(-Math.max(0, maxHistory - 1)), prev.values];
        return {
          ...prev,
          values: nextValues,
          past: nextPast,
          future: [],
        };
      });
    },
    [maxHistory]
  );

  const undo = useCallback(() => {
    setState((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      return {
        ...prev,
        values: previous,
        past: prev.past.slice(0, -1),
        future: [prev.values, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      return {
        ...prev,
        values: next,
        past: [...prev.past, prev.values],
        future: prev.future.slice(1),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      values: prev.baseline,
      past: [],
      future: [],
    }));
  }, []);

  const persist = useCallback(async () => {
    const currentValues = stateRef.current.values;
    await handlers.current.onSave(currentValues);
    setState((prev) => ({
      baseline: currentValues,
      values: prev.values,
      past: [],
      future: [],
    }));
    setLastSavedAt(new Date());
  }, []);

  const session = useEditSession({
    dirty: isDirty,
    onSave: persist,
    onBeforeSave: () => handlers.current.onBeforeSave?.(stateRef.current.values) ?? true,
    onCancel: reset,
    saveShortcut: true,
  });

  useEffect(() => {
    if (!autosave || !isDirty || session.saving) return;
    const timer = window.setTimeout(() => {
      void session.save();
    }, autosaveDelayMs);
    return () => window.clearTimeout(timer);
  }, [autosave, isDirty, session, autosaveDelayMs]);

  return {
    values: state.values,
    setFieldValue,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    lastSavedAt,
    session,
  };
}
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/hooks/useRecordForm.test.ts`  
Expected: PASS, 4 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(edit-session): implement useRecordForm with history stack and autosave loop"`

---

### Task 14: UnsavedChangesDialog & AppSidebar cooperative click guard

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-ui/src/components/UnsavedChangesDialog.tsx`
- Modify: `packages/bedrock-ui/src/components/AppSidebar.tsx`
- Modify: `packages/bedrock-ui/src/components/AppShell.tsx`
- Test: `packages/bedrock-ui/src/components/UnsavedChangesDialog.test.tsx`
- Test: `packages/bedrock-ui/src/components/AppSidebar.leaveGuard.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/UnsavedChangesDialog.test.tsx packages/bedrock-ui/src/components/AppSidebar.leaveGuard.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for UnsavedChangesDialog and AppSidebar leave guard**

Create `packages/bedrock-ui/src/components/UnsavedChangesDialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import UnsavedChangesDialog from "./UnsavedChangesDialog";
import { useEditSessionStore } from "../store/editSessionStore";

describe("UnsavedChangesDialog", () => {
  beforeEach(() => {
    useEditSessionStore.setState({ sessions: {}, pendingLeave: null });
  });

  it("renders AlertDialog when pendingLeave is set and handles Keep editing / Discard", () => {
    const leaveAction = vi.fn();
    const discardSession = vi.fn();
    useEditSessionStore.setState({
      sessions: { s1: discardSession },
      pendingLeave: leaveAction,
    });

    const { rerender } = render(<UnsavedChangesDialog />);

    expect(screen.getByText("Discard unsaved changes?")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Keep editing/i }));
    expect(useEditSessionStore.getState().pendingLeave).toBeNull();
    expect(leaveAction).not.toHaveBeenCalled();

    useEditSessionStore.setState({
      sessions: { s1: discardSession },
      pendingLeave: leaveAction,
    });
    rerender(<UnsavedChangesDialog />);

    fireEvent.click(screen.getByRole("button", { name: /Discard/i }));
    expect(discardSession).toHaveBeenCalled();
    expect(leaveAction).toHaveBeenCalled();
  });
});
```

Create `packages/bedrock-ui/src/components/AppSidebar.leaveGuard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { TooltipProvider } from "./ui/tooltip";
import AppSidebar from "./AppSidebar";
import { useEditSessionStore } from "../store/editSessionStore";
import type { NavItem } from "./navRegistry";

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: () => null, exact: true },
  { to: "/reports", label: "Reports", icon: () => null },
];

vi.mock("../hooks/useNavSettings", () => ({
  useNavSettings: () => ({ navItems: NAV, isLoading: false }),
}));

vi.mock("../store/sidebarStore", () => ({
  useSidebarStore: vi.fn((sel) => sel({ pinned: true, hovered: false, mobileOpen: false })),
}));
vi.mock("../hooks/useAppSettings", () => ({
  useAppSettings: () => ({ system: { appName: "App" }, grid: { tooltipDelayDuration: 0 } }),
}));
vi.mock("../hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../hooks/useModules", () => ({ useModules: () => ({ hasModule: () => true }) }));
vi.mock("../hooks/useSecurity", () => ({ useSecurity: () => ({ can: () => true }) }));

function Probe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname}</output>;
}

describe("AppSidebar Leave Guard", () => {
  beforeEach(() => {
    useEditSessionStore.setState({ sessions: {}, pendingLeave: null });
  });

  it("intercepts link clicks and parks leave when dirty session is registered", () => {
    const discard = vi.fn();
    useEditSessionStore.getState().register("session-1", discard);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <TooltipProvider>
          <Probe />
          <AppSidebar />
        </TooltipProvider>
      </MemoryRouter>
    );

    const reportsLink = screen.getByRole("link", { name: /Reports/i });
    fireEvent.click(reportsLink);

    expect(screen.getByTestId("location").textContent).toBe("/");
    expect(useEditSessionStore.getState().pendingLeave).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/UnsavedChangesDialog.test.tsx packages/bedrock-ui/src/components/AppSidebar.leaveGuard.test.tsx`  
Expected: FAIL. `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `UnsavedChangesDialog.tsx` and wire leave guards**

Create `packages/bedrock-ui/src/components/UnsavedChangesDialog.tsx`:

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { useEditSessionStore } from "../store/editSessionStore";

export default function UnsavedChangesDialog() {
  const pendingLeave = useEditSessionStore((s) => s.pendingLeave);
  const confirmLeave = useEditSessionStore((s) => s.confirmLeave);
  const cancelLeave = useEditSessionStore((s) => s.cancelLeave);

  return (
    <AlertDialog
      open={pendingLeave !== null}
      onOpenChange={(open) => {
        if (!open) cancelLeave();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes that will be lost if you leave this page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelLeave}>Keep editing</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={confirmLeave}
          >
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

In `packages/bedrock-ui/src/components/AppSidebar.tsx`:
Import `useNavigate` and `useEditSessionStore`, `hasDirtySessions`:
```tsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useEditSessionStore, hasDirtySessions } from "../store/editSessionStore";
```

Add delegated link interceptor:
```tsx
  const navigate = useNavigate();

  const guardLinkClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const store = useEditSessionStore.getState();
    if (!hasDirtySessions(store)) return;

    event.preventDefault();
    const to = `${anchor.pathname}${anchor.search}${anchor.hash}`;
    store.requestLeave(() => navigate(to));
  };
```

On the root `<aside className="app-sidebar ...">`, add:
```tsx
onClickCapture={guardLinkClick}
```

In `packages/bedrock-ui/src/components/AppShell.tsx`:
Mount `UnsavedChangesDialog`:
```tsx
import UnsavedChangesDialog from "./UnsavedChangesDialog";
// Inside return JSX:
      {resolvedSidebar}
      <div data-testid="app-shell-main-column" ...>
        ...
      </div>
      <UnsavedChangesDialog />
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/UnsavedChangesDialog.test.tsx packages/bedrock-ui/src/components/AppSidebar.leaveGuard.test.tsx`  
Expected: PASS, 2 suites, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(edit-session): implement UnsavedChangesDialog and AppSidebar cooperative click guard"`

---

### Task 15: GridEditor adoption of useEditSession & SaveBar

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-ui/src/components/admin/gridEditor/GridEditor.tsx`
- Modify: `packages/bedrock-ui/src/index.ts`
- Test: `packages/bedrock-ui/src/components/admin/gridEditor/GridEditor.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/admin/gridEditor/GridEditor.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for GridEditor integration**

Create `packages/bedrock-ui/src/components/admin/gridEditor/GridEditor.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GridEditor from "./GridEditor";
import { useEditSessionStore, hasDirtySessions } from "../../../store/editSessionStore";

const mockDraft = {
  isDirty: false,
  save: vi.fn().mockResolvedValue(undefined),
  reset: vi.fn(),
  dirtyCount: 0,
};

vi.mock("./useGridDraft", () => ({
  useGridDraft: () => ({
    draft: mockDraft,
    draftRef: { current: mockDraft },
  }),
}));

vi.mock("../../../hooks/useAdminPlatform", () => ({
  useGridSettings: () => ({
    data: { data: [{ grid_id: "test-grid", grid_label: "Test Grid", page: "items" }] },
    isLoading: false,
  }),
  useGridPages: () => ({
    data: { data: ["items"] },
  }),
}));

vi.mock("./GridPreview", () => ({ default: () => <div data-testid="preview" /> }));
vi.mock("./GridSettingsPanel", () => ({ default: () => null }));
vi.mock("./GridColumnsPanel", () => ({ default: () => null }));
vi.mock("./CustomColumnsPanel", () => ({ default: () => null }));
vi.mock("./GridFocusMode", () => ({ default: () => null }));
vi.mock("./ImportGridConfigDialog", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../../utils/logger", () => ({ log: { info: vi.fn(), error: vi.fn() } }));

describe("GridEditor with useEditSession", () => {
  it("renders SaveBar and manages editSessionStore registration", () => {
    mockDraft.isDirty = false;
    const { rerender } = render(<GridEditor initialGridId="test-grid" />);

    expect(screen.getByTestId("save-bar")).toBeDefined();
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(false);

    mockDraft.isDirty = true;
    rerender(<GridEditor initialGridId="test-grid" />);
    expect(hasDirtySessions(useEditSessionStore.getState())).toBe(true);

    const saveBtn = screen.getByRole("button", { name: /Save/i });
    fireEvent.click(saveBtn);
    expect(mockDraft.save).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/admin/gridEditor/GridEditor.test.tsx`  
Expected: FAIL (`save-bar` not found in GridEditor). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Update `GridEditor.tsx` and barrel exports**

In `packages/bedrock-ui/src/components/admin/gridEditor/GridEditor.tsx`:
1. Import `useEditSession` and `SaveBar`:
```tsx
import { useEditSession } from "../../../hooks/useEditSession";
import SaveBar from "../../SaveBar";
```
2. Remove private `beforeunload` listener effect.
3. Replace custom `handleSave` and header buttons with `useEditSession` and `<SaveBar />`:
```tsx
  const saveDraft = useCallback(async () => {
    try {
      await draftRef.current.save();
      toast.success("Grid settings saved");
      log.info({ gridId: selectedGridId, action: "save.success" }, "GridEditor: save complete");
    } catch (error) {
      toast.error("Failed to save grid settings");
      log.error({ err: error, gridId: selectedGridId, action: "save.error" }, "GridEditor: save failed");
      throw error;
    }
  }, [selectedGridId]);

  const session = useEditSession({
    dirty: draft.isDirty,
    onSave: saveDraft,
    onCancel: () => draftRef.current.reset(),
  });
```
In header actions, replace the Cancel and Save buttons with:
```tsx
  <SaveBar session={session} />
```

In `packages/bedrock-ui/src/index.ts`, export the new edit session suite:
```tsx
// ── Edit session ─────────────────────────────────────────────────────────────
export { useEditSession } from "./hooks/useEditSession";
export type { EditSession, EditSessionStatus, UseEditSessionOptions } from "./hooks/useEditSession";
export { useRecordForm } from "./hooks/useRecordForm";
export type { RecordForm, UseRecordFormOptions } from "./hooks/useRecordForm";
export { useEditSessionStore, hasDirtySessions } from "./store/editSessionStore";
export type { EditSessionStore } from "./store/editSessionStore";
export { default as SaveBar } from "./components/SaveBar";
export type { SaveBarProps, SaveBarHistory } from "./components/SaveBar";
export { default as UndoRedoControls } from "./components/UndoRedoControls";
export type { UndoRedoControlsProps } from "./components/UndoRedoControls";
export { default as UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/admin/gridEditor/GridEditor.test.tsx`  
Expected: PASS, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit, gate, and open draft PR for Phase 4**

```pwsh
git add packages/bedrock-ui/src/store/editSessionStore.ts packages/bedrock-ui/src/store/editSessionStore.test.ts packages/bedrock-ui/src/hooks/useEditSession.ts packages/bedrock-ui/src/hooks/useEditSession.test.ts packages/bedrock-ui/src/components/UndoRedoControls.tsx packages/bedrock-ui/src/components/UndoRedoControls.test.tsx packages/bedrock-ui/src/components/SaveBar.tsx packages/bedrock-ui/src/components/SaveBar.test.tsx packages/bedrock-ui/src/hooks/useRecordForm.ts packages/bedrock-ui/src/hooks/useRecordForm.test.ts packages/bedrock-ui/src/components/UnsavedChangesDialog.tsx packages/bedrock-ui/src/components/UnsavedChangesDialog.test.tsx packages/bedrock-ui/src/components/AppSidebar.tsx packages/bedrock-ui/src/components/AppSidebar.leaveGuard.test.tsx packages/bedrock-ui/src/components/AppShell.tsx packages/bedrock-ui/src/components/admin/gridEditor/GridEditor.tsx packages/bedrock-ui/src/components/admin/gridEditor/GridEditor.test.tsx packages/bedrock-ui/src/index.ts
git commit -m "feat(edit-session): implement useEditSession, SaveBar, useRecordForm, and adopt in GridEditor"
npm test
npm run typecheck
git push -u origin feat/edit-session
$pr = @'
## Summary
Introduces the unified edit-session primitive: in-memory session store, useEditSession, useRecordForm with autosave/history, SaveBar with container query responsiveness, UndoRedoControls, UnsavedChangesDialog, and proves adoption in GridEditor.

Closes #<ISSUE>

## Changes
- `editSessionStore.ts`: multi-session registry and leave guard.
- `useEditSession.ts`: unified dirty/saving/error state machine with Ctrl+S binding and beforeunload protection.
- `useRecordForm.ts`: field values, undo/redo stack, and debounced autosave.
- `UndoRedoControls.tsx`: history triggers with keyboard accelerators.
- `SaveBar.tsx`: responsive action cluster with permission-aware unmounting.
- `UnsavedChangesDialog.tsx`: dialog for parked navigation leaves.
- `GridEditor.tsx`: migrated to `useEditSession` and `<SaveBar />`.

## Test Plan
- [x] Frontend: `npm test`
- [x] `npm run typecheck`

### Changelog Entry
**Added** — Standard edit session primitives: `useEditSession`, `useRecordForm`, `SaveBar`, `UndoRedoControls`, and `UnsavedChangesDialog`.
**Changed** — `GridEditor` uses `useEditSession` and `SaveBar` instead of private save logic.
'@
gh pr create --draft --base master --title "feat(edit-session): introduce standard edit session engine and adopt in GridEditor" --body $pr
```

---

## Phase 5 — `feat/workbench-session`

### Task 16: WorkbenchShell session integration & inline guard with Save and Continue

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.tsx`
- Test: `packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.session.test.tsx`
- Test: `packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.session.test.tsx packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for WorkbenchShell session integration**

Create `packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.session.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WorkbenchShell from "./WorkbenchShell";
import type { EditSession } from "../../hooks/useEditSession";

function createMockSession(overrides: Partial<EditSession> = {}): EditSession {
  return {
    dirty: false,
    saving: false,
    status: "idle",
    error: null,
    save: vi.fn().mockResolvedValue(true),
    cancel: vi.fn(),
    guard: vi.fn(),
    ...overrides,
  };
}

const ITEMS = [
  { id: "1", title: "Item 1" },
  { id: "2", title: "Item 2" },
];

describe("WorkbenchShell with EditSession", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  it("renders rounder cards and neutral hover classes", () => {
    render(
      <WorkbenchShell
        title="Test Bench"
        items={ITEMS}
        selectedId="1"
        onSelect={vi.fn()}
        renderCard={(item) => <div>{item.title}</div>}
      >
        <div>Body</div>
      </WorkbenchShell>
    );

    const option = screen.getByRole("option", { name: /Item 2/i });
    expect(option.className).toContain("rounded-lg");
    expect(option.className).toContain("hover:bg-muted");
    expect(option.className).not.toContain("hover:bg-accent/50");
  });

  it("shows Save and continue in guard when session is supplied", async () => {
    const session = createMockSession({ dirty: true });
    const onSelect = vi.fn();

    render(
      <WorkbenchShell
        title="Test Bench"
        items={ITEMS}
        selectedId="1"
        onSelect={onSelect}
        session={session}
        renderCard={(item) => <div>{item.title}</div>}
      >
        <div>Body</div>
      </WorkbenchShell>
    );

    // Click item 2 to trigger guard
    const item2 = screen.getByRole("option", { name: /Item 2/i });
    fireEvent.click(item2);

    expect(screen.getByText("Discard unsaved changes?")).toBeDefined();
    const saveAndContinueBtn = screen.getByRole("button", { name: /Save and continue/i });
    expect(saveAndContinueBtn).toBeDefined();

    fireEvent.click(saveAndContinueBtn);
    await waitFor(() => {
      expect(session.save).toHaveBeenCalled();
      expect(onSelect).toHaveBeenCalledWith("2");
    });
  });

  it("does not navigate when save fails", async () => {
    const session = createMockSession({
      dirty: true,
      save: vi.fn().mockResolvedValue(false),
    });
    const onSelect = vi.fn();

    render(
      <WorkbenchShell
        title="Test Bench"
        items={ITEMS}
        selectedId="1"
        onSelect={onSelect}
        session={session}
        renderCard={(item) => <div>{item.title}</div>}
      >
        <div>Body</div>
      </WorkbenchShell>
    );

    const item2 = screen.getByRole("option", { name: /Item 2/i });
    fireEvent.click(item2);

    const saveAndContinueBtn = screen.getByRole("button", { name: /Save and continue/i });
    fireEvent.click(saveAndContinueBtn);

    await waitFor(() => {
      expect(session.save).toHaveBeenCalled();
    });

    // Guard must still be present and navigation must NOT have been called
    expect(screen.getByText("Discard unsaved changes?")).toBeDefined();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls session.cancel on Discard", () => {
    const session = createMockSession({ dirty: true });
    render(
      <WorkbenchShell
        title="Test Bench"
        items={ITEMS}
        selectedId="1"
        onSelect={vi.fn()}
        session={session}
        renderCard={(item) => <div>{item.title}</div>}
      >
        <div>Body</div>
      </WorkbenchShell>
    );

    const item2 = screen.getByRole("option", { name: /Item 2/i });
    fireEvent.click(item2);

    const discardBtn = screen.getByRole("button", { name: /Discard/i });
    fireEvent.click(discardBtn);

    expect(session.cancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.session.test.tsx`  
Expected: FAIL (`Save and continue` not found). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement session integration in `WorkbenchShell.tsx`**

1. Import `EditSession`:
```tsx
import type { EditSession } from "../../hooks/useEditSession";
```

2. Update `WorkbenchShellProps`:
```tsx
export interface WorkbenchShellProps<T extends WorkbenchItem> {
  // ...
  dirty?: boolean;
  session?: EditSession;
  // ...
}
```

3. In component body:
```tsx
export default function WorkbenchShell<T extends WorkbenchItem>({
  // ...
  dirty,
  session,
  // ...
}: WorkbenchShellProps<T>) {
  const isDirty = session?.dirty ?? dirty ?? false;
```
Replace all uses of `dirty` with `isDirty` throughout `WorkbenchShell.tsx` (the guard, the clear-pending effect, etc.).

4. Update rail card styling (lines 332–337):
Change `rounded-md` to `rounded-lg`.
Change `!isSelected && "hover:bg-accent/50"` to:
```tsx
  "cursor-pointer rounded-lg border-l-2 border-transparent px-3 py-2 text-sm text-foreground motion-safe:transition-colors",
  !isSelected && "hover:bg-muted",
  index === activeIndex && "bg-muted",
  isSelected && "border-primary bg-secondary text-foreground-strong font-medium",
```

5. Update discard and save-and-continue handlers:
```tsx
  const discard = () => {
    const action = pending;
    setPending(null);
    session?.cancel();
    onDiscard?.();
    action?.();
  };

  const saveAndContinue = async () => {
    if (!session) return;
    const action = pending;
    const ok = await session.save();
    if (ok) {
      setPending(null);
      action?.();
    }
  };
```

6. In `guardGroup`, add the "Save and continue" button:
```tsx
                <div className="flex gap-2">
                  <Button ref={keepEditingRef} variant="outline" size="sm" onClick={keepEditing}>
                    Keep editing
                  </Button>
                  {session && (
                    <Button size="sm" onClick={() => { void saveAndContinue(); }}>
                      Save and continue
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={discard}>
                    Discard
                  </Button>
                </div>
```

7. Update any existing test in `packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.test.tsx` that specifically checked for `hover:bg-accent/50` or `rounded-md` to check for `hover:bg-muted` and `rounded-lg`.

- [ ] **Step 4: Run delta verification to verify both test suites pass**

Command: `npx vitest run packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.session.test.tsx packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.test.tsx`  
Expected: PASS, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit, gate, and open draft PR for Phase 5**

```pwsh
git add packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.tsx packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.session.test.tsx packages/bedrock-ui/src/components/WorkbenchShell/WorkbenchShell.test.tsx
git commit -m "feat(workbench): integrate EditSession into WorkbenchShell with Save and Continue guard"
npm test
npm run typecheck
git push -u origin feat/workbench-session
$pr = @'
## Summary
Integrates the EditSession primitive into WorkbenchShell, adding a Save and Continue option to the leave guard and updating rail cards with modern rounded-lg geometry and neutral muted hover states.

Closes #<ISSUE>

## Changes
- `WorkbenchShell.tsx`: accepts optional `session?: EditSession`.
- `dirty` prop becomes optional (`session?.dirty ?? dirty ?? false`).
- Rail cards styled with `rounded-lg`, `hover:bg-muted`, and `motion-safe:transition-colors`.
- Inline guard gains "Save and continue" button when session is provided.
- Discard action triggers `session.cancel()`.

## Test Plan
- [x] Frontend: `npm test`
- [x] `npm run typecheck`

### Changelog Entry
**Added** — `WorkbenchShell` accepts `session?: EditSession` and supports "Save and continue" in its leave guard.
**Changed** — Workbench rail cards use `rounded-lg` and neutral `hover:bg-muted` hover states.
'@
gh pr create --draft --base master --title "feat(workbench): integrate EditSession into WorkbenchShell with Save and Continue guard" --body $pr
```

---

## Phase 6 — `feat/wizard-primitives`

### Task 17: Stepper progress indicator component

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Files:**
- Create: `packages/bedrock-ui/src/components/Stepper.tsx`
- Test: `packages/bedrock-ui/src/components/Stepper.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/Stepper.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for Stepper**

Create `packages/bedrock-ui/src/components/Stepper.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Stepper from "./Stepper";

describe("Stepper", () => {
  const steps = ["Upload", "Map Columns", "Review"];

  it("renders ordered progress list with aria-current on the active step", () => {
    render(<Stepper steps={steps} current={1} />);

    const list = screen.getByRole("list", { name: "Progress" });
    expect(list).toBeDefined();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);

    expect(items[0].getAttribute("data-state")).toBe("complete");
    expect(items[0].getAttribute("aria-current")).toBeNull();

    expect(items[1].getAttribute("data-state")).toBe("current");
    expect(items[1].getAttribute("aria-current")).toBe("step");

    expect(items[2].getAttribute("data-state")).toBe("upcoming");
    expect(items[2].getAttribute("aria-current")).toBeNull();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/Stepper.test.tsx`  
Expected: FAIL (Cannot find module). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `Stepper.tsx`**

Create `packages/bedrock-ui/src/components/Stepper.tsx`:

```tsx
import { Check } from "lucide-react";
import { cn } from "../lib/utils";

export interface StepperProps {
  steps: string[];
  current: number;
  className?: string;
}

export default function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol aria-label="Progress" className={cn("flex flex-wrap items-center gap-2", className)}>
      {steps.map((label, index) => {
        const isCurrent = index === current;
        const isComplete = index < current;
        const state = isComplete ? "complete" : isCurrent ? "current" : "upcoming";

        return (
          <li
            key={label}
            data-state={state}
            aria-current={isCurrent ? "step" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              isCurrent && "border-primary bg-primary/10 text-primary",
              isComplete && "border-border bg-muted/40 text-foreground",
              !isCurrent && !isComplete && "border-border text-muted-foreground bg-transparent"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                isCurrent && "bg-primary text-primary-foreground font-bold",
                isComplete && "bg-muted text-muted-foreground",
                !isCurrent && !isComplete && "text-muted-foreground"
              )}
            >
              {isComplete ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/Stepper.test.tsx`  
Expected: PASS, 1 test, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(wizard): implement Stepper progress indicator component"`

---

### Task 18: WizardDialog multi-step modal dialog

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-ui/src/components/WizardDialog.tsx`
- Modify: `packages/bedrock-ui/src/index.ts`
- Test: `packages/bedrock-ui/src/components/WizardDialog.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/WizardDialog.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for WizardDialog**

Create `packages/bedrock-ui/src/components/WizardDialog.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WizardDialog, { type WizardStep } from "./WizardDialog";

const STEPS: WizardStep[] = [
  { id: "step1", label: "File", content: <div>File Content</div> },
  { id: "step2", label: "Map", content: <div>Map Content</div>, nextDisabled: true },
  { id: "step3", label: "Review", content: <div>Review Content</div> },
];

describe("WizardDialog", () => {
  it("renders steps, navigates forward/backward, and invokes finish", () => {
    const onStepChange = vi.fn();
    const onFinish = vi.fn();

    const { rerender } = render(
      <WizardDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Import Data"
        steps={STEPS}
        stepIndex={0}
        onStepChange={onStepChange}
        onFinish={onFinish}
      />
    );

    expect(screen.getByText("File Content")).toBeDefined();
    const backBtn = screen.getByRole("button", { name: /Back/i });
    expect(backBtn).toBeDisabled();

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    fireEvent.click(nextBtn);
    expect(onStepChange).toHaveBeenCalledWith(1);

    // On step 2, nextDisabled is true
    rerender(
      <WizardDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Import Data"
        steps={STEPS}
        stepIndex={1}
        onStepChange={onStepChange}
        onFinish={onFinish}
      />
    );
    expect(screen.getByRole("button", { name: /Next/i })).toBeDisabled();

    // On step 3, finish button is rendered
    rerender(
      <WizardDialog
        open={true}
        onOpenChange={vi.fn()}
        title="Import Data"
        steps={STEPS}
        stepIndex={2}
        onStepChange={onStepChange}
        onFinish={onFinish}
        finishLabel="Import 42 items"
      />
    );
    const finishBtn = screen.getByRole("button", { name: "Import 42 items" });
    fireEvent.click(finishBtn);
    expect(onFinish).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/WizardDialog.test.tsx`  
Expected: FAIL (Cannot find module). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `WizardDialog.tsx` and export from barrel**

Create `packages/bedrock-ui/src/components/WizardDialog.tsx`:

```tsx
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import Stepper from "./Stepper";

export interface WizardStep {
  id: string;
  label: string;
  content: ReactNode;
  nextDisabled?: boolean;
  nextLabel?: string;
}

export interface WizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  steps: WizardStep[];
  stepIndex: number;
  onStepChange: (index: number) => void;
  onFinish: () => void;
  finishLabel?: string;
  busy?: boolean;
  className?: string;
}

export default function WizardDialog({
  open,
  onOpenChange,
  title,
  description,
  steps,
  stepIndex,
  onStepChange,
  onFinish,
  finishLabel = "Finish",
  busy = false,
  className,
}: WizardDialogProps) {
  const currentStep = steps[stepIndex] ?? steps[0];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[85vh] flex-col gap-4 sm:max-w-3xl",
          className
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className={description ? undefined : "sr-only"}>
            {description ?? `Step ${stepIndex + 1} of ${steps.length}: ${currentStep.label}`}
          </DialogDescription>
          <Stepper
            steps={steps.map((s) => s.label)}
            current={stepIndex}
            className="mt-2"
          />
        </DialogHeader>

        <div
          data-testid="wizard-step-body"
          className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1 py-2"
        >
          {currentStep.content}
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFirst || busy}
              onClick={() => onStepChange(stepIndex - 1)}
            >
              Back
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={Boolean(currentStep.nextDisabled) || busy}
              onClick={() => {
                if (isLast) {
                  onFinish();
                } else {
                  onStepChange(stepIndex + 1);
                }
              }}
            >
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {isLast ? finishLabel : (currentStep.nextLabel ?? "Next")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

In `packages/bedrock-ui/src/index.ts`, export the wizard primitives:
```tsx
// ── Wizard primitives ────────────────────────────────────────────────────────
export { default as Stepper } from "./components/Stepper";
export type { StepperProps } from "./components/Stepper";
export { default as WizardDialog } from "./components/WizardDialog";
export type { WizardDialogProps, WizardStep } from "./components/WizardDialog";
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/WizardDialog.test.tsx`  
Expected: PASS, 1 test, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit, gate, and open draft PR for Phase 6**

```pwsh
git add packages/bedrock-ui/src/components/Stepper.tsx packages/bedrock-ui/src/components/Stepper.test.tsx packages/bedrock-ui/src/components/WizardDialog.tsx packages/bedrock-ui/src/components/WizardDialog.test.tsx packages/bedrock-ui/src/index.ts
git commit -m "feat(wizard): implement Stepper and WizardDialog primitives"
npm test
npm run typecheck
git push -u origin feat/wizard-primitives
$pr = @'
## Summary
Introduces Stepper and WizardDialog modal primitives into bedrock-ui, standardizing multi-step flows and import wizards across consumers.

Closes #<ISSUE>

## Changes
- `Stepper.tsx`: pill list progress indicator with `aria-current="step"` and completion tokens.
- `WizardDialog.tsx`: dialog wrapper with responsive footer navigation, step scroll boundary, and busy states.
- Barrel exports added to `index.ts`.

## Test Plan
- [x] Frontend: `npm test`
- [x] `npm run typecheck`

### Changelog Entry
**Added** — Multi-step wizard primitives: `Stepper` and `WizardDialog`.
'@
gh pr create --draft --base master --title "feat(wizard): implement Stepper and WizardDialog primitives" --body $pr
```

---

## Phase 7 — `feat/bulk-edit-primitives`

### Task 19: Promote AdaptiveButton family from CollectIt

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Files:**
- Create: `packages/bedrock-ui/src/components/AdaptiveButton.tsx`
- Test: `packages/bedrock-ui/src/components/AdaptiveButton.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/AdaptiveButton.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for AdaptiveButton**

Create `packages/bedrock-ui/src/components/AdaptiveButton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "./ui/tooltip";
import { AdaptiveButton, IconAction, collapseClass } from "./AdaptiveButton";

function renderWithTooltip(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("AdaptiveButton", () => {
  it("renders with icon, visible label, and container query collapse classes", () => {
    renderWithTooltip(
      <AdaptiveButton
        icon={<span data-testid="test-icon">icon</span>}
        label="Download Report"
        collapseBelow="lg"
      />
    );

    expect(screen.getByTestId("test-icon")).toBeDefined();
    const labelSpan = screen.getByText("Download Report");
    expect(labelSpan.className).toBe(collapseClass("lg"));
    expect(labelSpan.className).toContain("@max-5xl:sr-only");
  });

  it("renders square button classes when square prop is true", () => {
    const { container } = renderWithTooltip(
      <AdaptiveButton
        icon={<span>x</span>}
        label="Delete"
        collapseBelow="md"
        square
      />
    );

    const button = container.querySelector("button");
    expect(button?.className).toContain("@max-3xl:w-8");
  });

  it("renders IconAction with aria-label for accessibility", () => {
    renderWithTooltip(<IconAction icon={<span>edit</span>} label="Edit Row" />);
    const button = screen.getByRole("button", { name: "Edit Row" });
    expect(button).toBeDefined();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/AdaptiveButton.test.tsx`  
Expected: FAIL (Cannot find module). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `AdaptiveButton.tsx`**

Create `packages/bedrock-ui/src/components/AdaptiveButton.tsx`:

```tsx
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const COLLAPSE_BELOW = {
  md: "@max-3xl:sr-only",
  lg: "@max-5xl:sr-only",
  xl: "@max-[1350px]:sr-only",
  "2xl": "@max-[1600px]:sr-only",
} as const;

export type CollapseBelow = keyof typeof COLLAPSE_BELOW;

export function collapseClass(below: CollapseBelow): string {
  return COLLAPSE_BELOW[below];
}

export function Hint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

const SQUARE_BELOW = {
  md: "@max-3xl:w-8 @max-3xl:px-0",
  lg: "@max-5xl:w-8 @max-5xl:px-0",
  xl: "@max-[1350px]:w-8 @max-[1350px]:px-0",
  "2xl": "@max-[1600px]:w-8 @max-[1600px]:px-0",
} as const;

export interface AdaptiveButtonProps
  extends Omit<ComponentProps<typeof Button>, "children"> {
  icon: ReactNode;
  label: string;
  collapseBelow?: CollapseBelow;
  square?: boolean;
  hint?: string;
}

export function AdaptiveButton({
  icon,
  label,
  collapseBelow = "lg",
  size = "sm",
  square = false,
  hint,
  className,
  ...props
}: AdaptiveButtonProps) {
  return (
    <Hint label={hint ?? label}>
      <Button
        size={size}
        className={cn(square && ["h-8 shrink-0", SQUARE_BELOW[collapseBelow]], className)}
        {...props}
      >
        {icon}
        <span className={collapseClass(collapseBelow)}>{label}</span>
      </Button>
    </Hint>
  );
}

export interface IconActionProps
  extends Omit<ComponentProps<typeof Button>, "children" | "size" | "variant"> {
  icon: ReactNode;
  label: string;
}

export function IconAction({ icon, label, ...props }: IconActionProps) {
  return (
    <Hint label={label}>
      <Button size="icon" variant="ghost" aria-label={label} {...props}>
        {icon}
      </Button>
    </Hint>
  );
}

export const ADAPTIVE_BAR = "@container";
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/AdaptiveButton.test.tsx`  
Expected: PASS, 3 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(bulk): promote AdaptiveButton family into bedrock-ui"`

---

### Task 20: DraftHistory reducer & useDraftHistory hook

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Create: `packages/bedrock-ui/src/components/grids/draftHistory.ts`
- Test: `packages/bedrock-ui/src/components/grids/draftHistory.test.ts`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/grids/draftHistory.test.ts`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for draftHistory**

Create `packages/bedrock-ui/src/components/grids/draftHistory.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  draftHistoryReducer,
  useDraftHistory,
  type DraftHistoryAction,
} from "./draftHistory";

describe("draftHistory", () => {
  it("does not spend an undo slot on a write that changes nothing per Review Focus 5", () => {
    const initial = {
      drafts: { row1: { col1: "alpha" } },
      past: [],
      future: [],
    };

    const action: DraftHistoryAction = {
      type: "write",
      writes: [{ rowKey: "row1", colId: "col1", value: "alpha" }],
    };

    const next = draftHistoryReducer(initial, action);
    expect(next.drafts).toEqual(initial.drafts);
    expect(next.past).toHaveLength(0);
  });

  it("pushes previous drafts to past and clears future on valid write", () => {
    const initial = {
      drafts: { row1: { col1: "alpha" } },
      past: [],
      future: [{ row1: { col1: "future" } }],
    };

    const action: DraftHistoryAction = {
      type: "write",
      writes: [{ rowKey: "row1", colId: "col1", value: "beta" }],
    };

    const next = draftHistoryReducer(initial, action);
    expect(next.drafts.row1.col1).toBe("beta");
    expect(next.past).toHaveLength(1);
    expect(next.past[0].row1.col1).toBe("alpha");
    expect(next.future).toHaveLength(0);
  });

  it("caps undo history at 50 entries", () => {
    let state = {
      drafts: {},
      past: Array.from({ length: 50 }, (_, i) => ({ r: { c: `${i}` } })),
      future: [],
    };

    const next = draftHistoryReducer(state, {
      type: "write",
      writes: [{ rowKey: "r", colId: "c", value: "51" }],
    });

    expect(next.past).toHaveLength(50);
  });

  it("handles undo and redo correctly via useDraftHistory hook", () => {
    const { result } = renderHook(() => useDraftHistory());

    expect(result.current.isDirty).toBe(false);

    act(() => {
      result.current.write([{ rowKey: "1", colId: "name", value: "Item A" }]);
    });
    expect(result.current.isDirty).toBe(true);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.drafts["1"]?.name).toBe("Item A");

    act(() => {
      result.current.undo();
    });
    expect(result.current.drafts["1"]?.name).toBeUndefined();
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect(result.current.drafts["1"]?.name).toBe("Item A");
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/grids/draftHistory.test.ts`  
Expected: FAIL (Cannot find module). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `draftHistory.ts`**

Create `packages/bedrock-ui/src/components/grids/draftHistory.ts`:

```ts
import { useCallback, useReducer } from "react";
import {
  applyDrafts,
  isDirty as isDraftsDirty,
  type BulkDrafts,
  type DraftWrite,
} from "./bulkDraftStore";

export const HISTORY_LIMIT = 50;

export interface DraftHistory {
  drafts: BulkDrafts;
  past: BulkDrafts[];
  future: BulkDrafts[];
}

export type DraftHistoryAction =
  | { type: "write"; writes: DraftWrite[] }
  | { type: "replace"; drafts: BulkDrafts }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" };

export function draftHistoryReducer(
  state: DraftHistory,
  action: DraftHistoryAction
): DraftHistory {
  switch (action.type) {
    case "write": {
      const nextDrafts = applyDrafts(state.drafts, action.writes);
      // No-op check: if next state is identical, do not consume an undo slot
      if (JSON.stringify(nextDrafts) === JSON.stringify(state.drafts)) {
        return state;
      }
      return {
        drafts: nextDrafts,
        past: [...state.past.slice(-Math.max(0, HISTORY_LIMIT - 1)), state.drafts],
        future: [],
      };
    }

    case "replace": {
      if (JSON.stringify(action.drafts) === JSON.stringify(state.drafts)) {
        return state;
      }
      return {
        drafts: action.drafts,
        past: [...state.past.slice(-Math.max(0, HISTORY_LIMIT - 1)), state.drafts],
        future: [],
      };
    }

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        drafts: previous,
        past: state.past.slice(0, -1),
        future: [state.drafts, ...state.future],
      };
    }

    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        drafts: next,
        past: [...state.past, state.drafts],
        future: state.future.slice(1),
      };
    }

    case "reset":
      return {
        drafts: {},
        past: [],
        future: [],
      };

    default:
      return state;
  }
}

export function useDraftHistory(initialDrafts: BulkDrafts = {}) {
  const [state, dispatch] = useReducer(draftHistoryReducer, {
    drafts: initialDrafts,
    past: [],
    future: [],
  });

  const write = useCallback((writes: DraftWrite[]) => {
    dispatch({ type: "write", writes });
  }, []);

  const replace = useCallback((drafts: BulkDrafts) => {
    dispatch({ type: "replace", drafts });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "undo" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "redo" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  return {
    drafts: state.drafts,
    draftsOverride: {
      drafts: state.drafts,
      onChange: replace,
    },
    isDirty: isDraftsDirty(state.drafts),
    write,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset,
  };
}
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/grids/draftHistory.test.ts`  
Expected: PASS, 4 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit**

Command: `git commit -am "feat(bulk): implement DraftHistory reducer and useDraftHistory hook"`

---

### Task 21: SelectionDock floating toolbar component

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Files:**
- Create: `packages/bedrock-ui/src/components/SelectionDock.tsx`
- Modify: `packages/bedrock-ui/src/index.ts`
- Test: `packages/bedrock-ui/src/components/SelectionDock.test.tsx`

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/components/SelectionDock.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests for SelectionDock**

Create `packages/bedrock-ui/src/components/SelectionDock.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SelectionDock from "./SelectionDock";

describe("SelectionDock", () => {
  it("returns null when count is less than 1", () => {
    const { container } = render(<SelectionDock count={0} onClear={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders toolbar with count, clear button, and slot actions", () => {
    const onClear = vi.fn();
    render(
      <SelectionDock count={12} onClear={onClear}>
        <button>Assign</button>
      </SelectionDock>
    );

    const dock = screen.getByRole("toolbar", { name: "Selection" });
    expect(dock).toBeDefined();
    expect(screen.getByText("12 selected")).toBeDefined();
    expect(screen.getByRole("button", { name: "Assign" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Clear/i }));
    expect(onClear).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run delta verification to verify it fails**

Command: `npx vitest run packages/bedrock-ui/src/components/SelectionDock.test.tsx`  
Expected: FAIL (Cannot find module). `$LASTEXITCODE -ne 0`.

- [ ] **Step 3: Implement `SelectionDock.tsx` and barrel exports**

Create `packages/bedrock-ui/src/components/SelectionDock.tsx`:

```tsx
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

export interface SelectionDockProps {
  count: number;
  onClear: () => void;
  children?: ReactNode;
  label?: string;
  className?: string;
}

export default function SelectionDock({
  count,
  onClear,
  children,
  label = "Selection",
  className,
}: SelectionDockProps) {
  if (count < 1) return null;

  return (
    <div
      data-testid="selection-dock"
      role="toolbar"
      aria-label={label}
      className={cn(
        "sticky bottom-0 z-10 mt-auto flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-md",
        className
      )}
    >
      <span className="text-sm font-medium tabular-nums">{count} selected</span>
      <Button type="button" size="sm" variant="ghost" onClick={onClear}>
        Clear
      </Button>
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
```

In `packages/bedrock-ui/src/index.ts`, add exports:
```tsx
// ── Bulk edit primitives ─────────────────────────────────────────────────────
export * from "./components/AdaptiveButton";
export * from "./components/grids/draftHistory";
export { default as SelectionDock } from "./components/SelectionDock";
export type { SelectionDockProps } from "./components/SelectionDock";
```

- [ ] **Step 4: Run delta verification to verify it passes**

Command: `npx vitest run packages/bedrock-ui/src/components/SelectionDock.test.tsx`  
Expected: PASS, 2 tests, `$LASTEXITCODE -eq 0`.

- [ ] **Step 5: Commit, gate, and open draft PR for Phase 7**

```pwsh
git add packages/bedrock-ui/src/components/AdaptiveButton.tsx packages/bedrock-ui/src/components/AdaptiveButton.test.tsx packages/bedrock-ui/src/components/grids/draftHistory.ts packages/bedrock-ui/src/components/grids/draftHistory.test.ts packages/bedrock-ui/src/components/SelectionDock.tsx packages/bedrock-ui/src/components/SelectionDock.test.tsx packages/bedrock-ui/src/index.ts
git commit -m "feat(bulk): promote AdaptiveButton, draftHistory, and SelectionDock"
npm test
npm run typecheck
git push -u origin feat/bulk-edit-primitives
$pr = @'
## Summary
Promotes the domain-free bulk-edit primitives from CollectIt into bedrock-ui: AdaptiveButton container query family, draftHistory snapshot history reducer/hook, and SelectionDock sticky toolbar.

Closes #<ISSUE>

## Changes
- `AdaptiveButton.tsx`: promoted with container-query responsive collapse utilities.
- `draftHistory.ts`: in-memory snapshot history over BulkDrafts with 50-item limit and no-op suppression.
- `SelectionDock.tsx`: sticky floating toolbar for active selection actions.
- Barrel exports added to `index.ts`.

## Test Plan
- [x] Frontend: `npm test`
- [x] `npm run typecheck`

### Changelog Entry
**Added** — `AdaptiveButton`, `IconAction`, `useDraftHistory`, and `SelectionDock` bulk edit helpers.
'@
gh pr create --draft --base master --title "feat(bulk): promote AdaptiveButton, draftHistory, and SelectionDock primitives" --body $pr
```

---

### Task 22: Final Quality Audit, Spec & Plan Archiving, and PR Gate

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Files:**
- Move: `docs/specs/2026-10-06-shell-refresh-design.md` -> `docs/archive/specs/2026-10-06-shell-refresh-design.md`
- Move: `docs/plans/2026-10-06-shell-refresh.md` -> `docs/archive/plans/2026-10-06-shell-refresh.md`
- Move: `docs/plans/2026-10-06-shell-refresh-intake.json` -> `docs/archive/plans/2026-10-06-shell-refresh-intake.json`

**Delta Verification:**
- Command: `npm test && npm run typecheck && pytest packages/bedrock-api/tests/ -q && python -m bedrock.tools.run_all --root .`
- Target runtime: `<60s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Run repository QA suite**

Execute frontend and backend verification:
```pwsh
npm test
npm run typecheck
pytest packages/bedrock-api/tests/ -q
```
Confirm all suites PASS with `$LASTEXITCODE -eq 0`.

- [ ] **Step 2: Run platform audit suite**

```pwsh
python -m bedrock.tools.run_all --root .
```
Confirm all platform gates (§S001–§S015) PASS with `$LASTEXITCODE -eq 0`.

- [ ] **Step 3: Move supporting spec to archive**

```pwsh
git mv docs/specs/2026-10-06-shell-refresh-design.md docs/archive/specs/
```

- [ ] **Step 4: Move implementation plan and companion intake JSON to archive**

```pwsh
git mv docs/plans/2026-10-06-shell-refresh.md docs/archive/plans/
git mv docs/plans/2026-10-06-shell-refresh-intake.json docs/archive/plans/
```

- [ ] **Step 5: Record §S014 follow-up issues**

File ecosystem issues for out-of-scope defects identified during design and planning:
1. `CommandPalette` navigation does not call `requestLeave`, and its routes come from `registerCommandRoutes` rather than `navRegistry` (§S011 gap).
2. Domain-leaking `mlbtracker-*` localStorage keys in `sidebarStore` and `ThemeContext`.
3. `bg-black/10`-style overlays inside third-party/shadcn primitives violating §S009.
4. `REQ-HDR-003`: `TypographyProvider` for automated title-casing across `PageHeader` components.

- [ ] **Step 6: Verify clean working tree**

```pwsh
git status --porcelain
```
Verify only the expected staged renames appear.

- [ ] **Step 7: Commit archival**

```pwsh
git commit -m "chore(docs): archive shell-refresh spec, plan, and intake JSON per §S008"
```
