# Bedrock v0.13.1 Downstream Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task by task. Steps use
> checkbox (`- [ ]`) syntax for tracking. Delivery via the `/triage-plan` skill:
> ```pwsh
> /triage-plan docs/plans/2026-10-06-bedrock-v0-13-1-downstream-adoption.md
> ```

**Goal:** Cut Bedrock `v0.13.1`, then move CollectIt and MLBTracker onto it in two PRs each —
pin and shell frame first, primitive adoption second — evicting the local twins of everything the
release promoted and reconciling each consumer's §S014 ledger.

**Architecture:** Docs-and-orchestration plan. The only bedrock-side action is the release cut.
Every other task edits a consumer repository on its own branch, one concern per PR (§S006),
CollectIt before MLBTracker, PR 1 merged before PR 2 starts.

**Tech Stack:** React 18, TypeScript (strict), Vitest 2 + Testing Library, `@djntechnic/bedrock-ui`,
Python 3 + pytest, PowerShell 7, `gh`.

**Spec:** [`docs/specs/2026-10-06-bedrock-v0-13-1-downstream-adoption-design.md`](../specs/2026-10-06-bedrock-v0-13-1-downstream-adoption-design.md)

## Global Constraints

- **Workspaces.** Bedrock `C:\Dev\bedrock`; CollectIt `C:\Dev\CollectIt` (frontend in `frontend/`);
  MLBTracker `C:\Dev\MLBTracker` (frontend in `frontend/`). A task states which workspace it runs
  in; commands run from that workspace's root unless the command says `frontend/`.
- **§S012 direction.** Nothing in `C:\Dev\bedrock` is edited by a consumer task, and no consumer
  file is edited from a bedrock task. Pins move only through `/bump-bedrock-pin v0.13.1` inside the
  consumer, both files in one commit, lockfile regenerated.
- **Exit codes.** Every verification asserts `$LASTEXITCODE -eq 0` directly on the command that
  produced it. No pipe (`| Select-Object`, `| tail`) between the command and the check.
- **Install.** `npm install --no-audit --no-fund` only. **Never `--legacy-peer-deps`.**
- **Zero console output (§S003).** No `console.*` and no bare `print()` in any new or changed
  source. Log through `log` (frontend) or Loguru (backend) with a structured first argument.
- **§S001.** If the barrel exports it, the consumer imports it. An evicted file is deleted, not
  left as a re-export shim. A deliberate fork carries `@shadows <Name>` and a reason.
- **§S005.** Test-first. No `it.skip`, no `any`, no `@ts-ignore` / `@ts-expect-error`. A failing
  test is classified Class A (fix inline) or Class B (halt and file); never "pre-existing".
  Type-check runs **after** the tests.
- **§S006.** One branch and one **draft** PR per task group below, cut from updated `master`,
  Conventional Commits, never commit to `master`. A `fix:` commit carries its reproduction test.
  Watch CI with a background `gh pr checks <pr> --watch` and yield; never `sleep`-poll.
  Force-push needs explicit user authorization every time.
- **§S009.** No literal hex / rgb / hsl and no bare hue utility in changed `.tsx` / `.css`.
  The `⚾` mark is a glyph, not a colour, and is permitted.
- **§S010.** `<SaveBar>` is wrapped in `<Can module action="update">`; never disabled in place.
- **§S011.** `<AppSidebar>` keeps rendering `useNavSettings().navItems`; no hardcoded link list.
- **§S014.** Ledger entries are deleted outright when resolved and adopted. New upstream issues
  are searched for duplicates before filing and recorded in the ledger in the same PR.
- **§S015.** Consumers write no CHANGELOG entry for bedrock; each PR fills its template.
- **Gates.** Fast (pre-commit): `python -m bedrock.tools.s012_audit_pins --root .` and
  `python -m bedrock.tools.s001_audit_duplicates --root .`. Full (pre-merge):
  `python scripts/run_qa.py --mode full` and `python -m bedrock.tools.run_all --root .`.
- **Authorization.** Task 2 (push a release tag) and every merge step are outward-facing. The
  agent stops and asks before executing them unless the user has authorized that step this
  session.

## Review Focus

1. **Tag exists before any pin moves.** Every consumer task depends on Task 2's
   `git ls-remote --tags origin v0.13.1` returning the tag. Test: Task 1 / Task 2 assertions.
2. **Pins in lockstep.** `requirements.txt` and `frontend/package.json` name the identical tag in
   one commit, and the lockfile resolves it. Test: `s012_audit_pins` in Tasks 4 and 18.
3. **MLBTracker keeps its look.** `brand={{ mark: "⚾", subtitle: "Analytics" }}` is asserted by a
   test, because upstream no longer renders either by default. Test: Task 19.
4. **A deleted test is covered upstream.** Every deleted file is mapped to a real upstream file
   and real case names read at the `v0.13.1` tag. Tests: Tasks 14 and 24 mapping tables.
5. **Rejected save keeps the form dirty.** Each migrated surface keeps one test proving its
   `onSave` rejection leaves the session dirty. Tests: Tasks 12, 13, 22, 23.

---

## Phase 1 — Upstream Release Validation (`C:\Dev\bedrock`)

### Task 1: Verify the release prerequisites

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\bedrock`, branch `master`.

**Files:**
- None modified.

**Delta Verification:**
- Command: `git ls-remote --tags origin 'v0.13*'`
- Target runtime: `<10s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Confirm the archive PR merged and the tree is clean**

```pwsh
git checkout master
git pull origin master
git status --porcelain
git log --oneline -1
git branch -a --list '*archive-shell-refresh*'
```
Expected: `git status --porcelain` empty; `docs/archive/specs/2026-10-06-shell-refresh-design.md`
and `docs/archive/plans/2026-10-06-shell-refresh.md` exist; no unmerged
`chore/archive-shell-refresh`. If any of that is false, stop.

- [ ] **Step 2: Confirm all seven upstream phases are on `master`**

```pwsh
git log --oneline --grep='shell-tokens\|app-sidebar\|app-shell\|edit-session\|workbench\|wizard\|bulk' -i -20
python -c "import re,pathlib; s=pathlib.Path('packages/bedrock-ui/src/index.ts').read_text(); [print(n, n in s) for n in ['AppShell','AppHeader','useEditSession','useRecordForm','SaveBar','UndoRedoControls','UnsavedChangesDialog','Stepper','WizardDialog','AdaptiveButton','useDraftHistory','SelectionDock']]"
```
Expected: all twelve names print `True` (barrel check; the AppShell/edit-session/wizard/bulk
families are the seven phases' public surface). Any `False` is a Class B blocker: halt and file.

- [ ] **Step 3: Record whether `v0.13.1` is already published**

```pwsh
git ls-remote --tags origin 'v0.13*'
```
Expected today: `v0.13.0` only. Proceed to Task 2 if `v0.13.1` is absent; skip Task 2 and go to
Task 3 if the tag and its `^{}` peeled commit are both present and the commit is on `master`.

### Task 2: Cut and verify `v0.13.1`

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\bedrock`, branch `master` (the script manages its own release branch).

**Files:**
- Modify (by the script): `packages/bedrock-ui/package.json`, `packages/bedrock-api/pyproject.toml`,
  `package.json`, `CHANGELOG.md`

**Delta Verification:**
- Command: `git ls-remote --tags origin v0.13.1`
- Target runtime: `<10s`
- Exit code verification: `$LASTEXITCODE -eq 0` **and** the output names `refs/tags/v0.13.1`
  and `refs/tags/v0.13.1^{}`; the peeled SHA equals `git rev-parse origin/master`'s release commit.

- [ ] **Step 1: Ask the user to authorize the tag push**, naming the version and the commit.

- [ ] **Step 2: Run the release script**

```pwsh
pwsh -File scripts/maintenance/Cut-BedrockRelease.ps1 -TargetVersion v0.13.1
$LASTEXITCODE
```
Expected: `0`. The CHANGELOG entry must list both breaking items (sidebar baseball mark and
"Analytics" subtitle removed; S001 invariant 9 hand-rolled `app-header` fails) and name
`AppShell`, `AppHeader`, `useEditSession`, `useRecordForm`, `SaveBar`, `Stepper`,
`WizardDialog`, `AdaptiveButton`, `useDraftHistory`, `SelectionDock`.

- [ ] **Step 3: Run the release gates the script does not**

```pwsh
python -m bedrock.tools.audit_release_version --root .
$LASTEXITCODE
```
Expected: `0`; both package versions read `0.13.1`.

- [ ] **Step 4: Verify the tag on the remote**

```pwsh
git ls-remote --tags origin v0.13.1
$LASTEXITCODE
```
If the push returned HTTP 403 the tag was **not** created. Do not tell any consumer it is ready:
hand the user the exact `git tag` / `git push origin v0.13.1` commands and wait.

---

## Phase 2 — CollectIt PR 1 (`chore/bump-bedrock-v0131-shell`)

### Task 3: Branch, baseline, and shell inventory

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`.

**Files:**
- None modified (inventory goes to `scratch/`, uncommitted and git-ignored).

**Delta Verification:**
- Command: `cd frontend; npx vitest run src/App.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0` (baseline green before any edit)

- [ ] **Step 1: Cut the branch from updated `master`**

```pwsh
git checkout master; git pull origin master
git status --porcelain
git checkout -b chore/bump-bedrock-v0131-shell
git branch --show-current
```
Expected: clean tree; branch name matches. Stop if it does not.

- [ ] **Step 2: Capture the baseline**

```pwsh
cd frontend; npx vitest run
$LASTEXITCODE
```
Record the test-file and test counts as one line. A red baseline is classified (Class A fix inline
in a separate commit; Class B halt) before proceeding.

- [ ] **Step 3: Inventory the hand-built frame in `frontend/src/App.tsx`**

Find every `app-header`, `ml-0` / `ml-16` / `ml-60`, and per-route column wrapper:
```pwsh
rg -n 'app-header|ml-0|ml-16|ml-60|sidebarCollapsed|<AppFooter|<AppSidebar' frontend/src/App.tsx
```
Map each route to `layout: "default" | "workbench" | "fullBleed"`. Keep the map in `scratch/`.

### Task 4: Dual pin bump to v0.13.1

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`, branch `chore/bump-bedrock-v0131-shell`.

**Files:**
- Modify: `requirements.txt`, `frontend/package.json`, `frontend/package-lock.json`

**Delta Verification:**
- Command: `python -m bedrock.tools.s012_audit_pins --root .`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`. Red/green: before the bump both pins read
  `v0.13.0`, so `git diff` against the target is the red state; the audit cannot fail on a
  consistent-but-old pair, so the Step 1 tag check is the real red gate.

- [ ] **Step 1: Confirm the tag exists before touching a pin**

```pwsh
git ls-remote --tags https://github.com/djntechnic/bedrock v0.13.1
```
Empty output → stop; Task 2 is unfinished.

- [ ] **Step 2: Run `/bump-bedrock-pin v0.13.1`**

It edits both pins in one commit, regenerates the lockfile with
`npm install --no-audit --no-fund`, proves a clean install, and runs the gates. Do not hand-edit
the pins.

- [ ] **Step 3: Verify lockstep**

```pwsh
python -m bedrock.tools.s012_audit_pins --root .
$LASTEXITCODE
git diff --stat HEAD~1 -- requirements.txt frontend/package.json frontend/package-lock.json
```
Expected: `0`; all three files in the one commit; no other file.

- [ ] **Step 4: Expect the two known breaks, nothing else**

```pwsh
cd frontend; npx vitest run
$LASTEXITCODE
```
Any failure other than a sidebar "Analytics"/mark assertion or an S001 invariant-9 hit is
unexpected: classify it (Class A inline / Class B halt) before Task 5.

### Task 5: Adopt `<AppShell>` and `<AppHeader>`

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`, branch `chore/bump-bedrock-v0131-shell`.

**Files:**
- Modify: `frontend/src/App.tsx`
- Create or modify: `frontend/src/App.shell.test.tsx`

**Delta Verification:**
- Command: `cd frontend; npx vitest run src/App.shell.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test**

`App.shell.test.tsx` renders the app tree under a `MemoryRouter` with the repo's existing test
providers and asserts: exactly one `header.app-header`; it is rendered by the platform (no local
`<header … app-header …>` in `src`); the content margin tracks the sidebar state with no
`ml-16` / `ml-60` literal in `App.tsx`; a `fullBleed` route renders no header. Mock
`useMediaQuery` (jsdom has no `matchMedia`).
Run: `cd frontend; npx vitest run src/App.shell.test.tsx` — **Expected: FAIL** (`$LASTEXITCODE -ne 0`).

- [ ] **Step 2: Implement**

Import `AppShell`, `AppHeader` from `@djntechnic/bedrock-ui`. Replace the hand-built header, margin
logic, and column wrappers with `<AppShell layout=… sidebar={<AppSidebar … />} …>`. Providers and
`<BrowserRouter>` stay in `App.tsx`. Preserve the header's existing `children` / `actions`
content through `AppHeader`'s slots (global search stays `GlobalSearchBar`).

- [ ] **Step 3: Run to green**

```pwsh
cd frontend; npx vitest run src/App.shell.test.tsx
$LASTEXITCODE
```
Expected: `0`.

- [ ] **Step 4: Commit**

```pwsh
git add frontend/src/App.tsx frontend/src/App.shell.test.tsx
git commit -m "refactor(shell): adopt AppShell and AppHeader from bedrock v0.13.1"
```

### Task 6: Wire the `brand` prop

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Workspace:** `C:\Dev\CollectIt`, branch `chore/bump-bedrock-v0131-shell`.

**Files:**
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/App.shell.test.tsx`

**Delta Verification:**
- Command: `cd frontend; npx vitest run src/App.shell.test.tsx -t brand`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test** — expanded sidebar shows the text `Collectibles Studio`
and a mark whose text is `C`; the text `Analytics` is absent. **Expected: FAIL.**

- [ ] **Step 2: Implement** — `<AppSidebar brand={{ subtitle: "Collectibles Studio" }} />`. Pass no
`mark`; the default is the initial letter `"C"`.

- [ ] **Step 3: Run to green** (`$LASTEXITCODE -eq 0`), then commit:

```pwsh
git add frontend/src/App.tsx frontend/src/App.shell.test.tsx
git commit -m "feat(shell): brand the sidebar as Collectibles Studio"
```

### Task 7: S001 invariant 9, full gates, and draft PR

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`, branch `chore/bump-bedrock-v0131-shell`.

**Files:**
- None modified unless a gate finds a Class A defect.

**Delta Verification:**
- Command: `python -m bedrock.tools.s001_audit_duplicates --root .`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Prove invariant 9 resolved**

```pwsh
rg -n 'app-header' frontend/src --glob '!**/*.test.tsx'
python -m bedrock.tools.s001_audit_duplicates --root .
$LASTEXITCODE
```
Expected: no local `<header … app-header …>`; exit `0` (no `@shadows AppHeader` escape hatch used).

- [ ] **Step 2: Fast and full gates**

```pwsh
python -m bedrock.tools.s012_audit_pins --root .
python scripts/run_qa.py --mode full
python -m bedrock.tools.run_all --root .
```
Each `$LASTEXITCODE -eq 0`, checked per command. Then `cd frontend; npx tsc -b --noEmit`
(`$LASTEXITCODE -eq 0`) after the tests.

- [ ] **Step 3: Draft PR**

```pwsh
git push -u origin chore/bump-bedrock-v0131-shell
gh pr create --draft --base master --title "chore(bedrock): bump to v0.13.1 and adopt AppShell" --body-file scratch/pr1-body.md
```
Body fills `.github/PULL_REQUEST_TEMPLATE.md`: concern (pin + shell frame), the two breaking
items and how each is resolved, and the verification commands run with exit codes.

- [ ] **Step 4: Watch CI without polling.** Run `gh pr checks <pr> --watch` in the background and
yield the turn. On completion with exit `0`, ask the user before merging.

- [ ] **Step 5: After the user authorizes the merge**

```pwsh
gh pr merge <pr> --squash --delete-branch
git checkout master; git pull origin master
git status --porcelain
```
`git status --porcelain` must print nothing (§S006 invariant 9).

---

## Phase 3 — CollectIt PR 2 (`refactor/adopt-bedrock-v0131-primitives`)

### Task 8: Branch and edit-session discovery scan

- **Target Agent:** `@Explore`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`, new branch from updated `master`.

**Files:**
- Create (uncommitted): `scratch/collectit-edit-session-scan.md`

**Delta Verification:**
- Command: `pwsh -File scratch/scan-edit-state.ps1 -Root frontend/src`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`; the script exits `1` if the output table is empty
  (the named surfaces below must appear, so an empty scan means the scan is wrong).

- [ ] **Step 1: Cut the branch**

```pwsh
git checkout master; git pull origin master
git checkout -b refactor/adopt-bedrock-v0131-primitives
git branch --show-current
```

- [ ] **Step 2: Write the scan script** (`scratch/scan-edit-state.ps1`, not committed;
`scripts/**` is exempt from §S003 if it is ever promoted). It searches `.ts` / `.tsx`, excluding
tests, for four signals and emits one markdown row per hit: `file | line | signal | disposition`.

| Signal | Pattern |
| ------ | ------- |
| `beforeunload` | `beforeunload` |
| Dirty state | `\b(isDirty|dirty|hasChanges|hasUnsaved)\b` in a file that also renders a button labelled `Save` and one labelled `Cancel` or `Discard` |
| Save shortcut | `(ctrlKey|metaKey)[^\n]*['"]s['"]` or `key === ['"]s['"]` |
| Local undo stack | `\b(undoStack|redoStack|history)\b` with `push`/`pop` |

- [ ] **Step 3: Run it and classify every hit**

```pwsh
pwsh -File scratch/scan-edit-state.ps1 -Root frontend/src > scratch/collectit-edit-session-scan.md
$LASTEXITCODE
```
Each row's disposition is `migrate (Task N)`, `keep: <reason>`, or `file upstream: <reason>`. The
three named surfaces — `components/bulk/useBulkDrafts.ts`, `components/fields/FieldsWorkbench.tsx`,
`pages/listing-studio/ListingsPage.tsx` — must all be `migrate`. Candidates the scan may surface
and that need an explicit decision: `components/bulk/BulkSaveBar.tsx`, `listing-studio/GuidedSteps.tsx`,
`listing-studio/IssueStepper.tsx`. Any additional `migrate` row becomes a sub-step of Task 12 or 13
or is escalated to the user as a scope increase.

### Task 9: Evict `AdaptiveButton`

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Workspace:** `C:\Dev\CollectIt`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- Delete: `frontend/src/components/listing-studio/AdaptiveButton.tsx`
- Delete (if Task 14 maps it): `frontend/src/components/listing-studio/AdaptiveButton.test.tsx`
- Modify: every importer of `AdaptiveButton`, `IconAction`, `Hint`, `collapseClass`, `ADAPTIVE_BAR`

**Delta Verification:**
- Command: `cd frontend; npx vitest run src/components/listing-studio`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing guard** — a one-case test (kept: it is the §S001 regression
guard, not a platform assertion) that globs `frontend/src/**` for a local export named
`AdaptiveButton`, `IconAction`, `Hint`, `collapseClass`, or `ADAPTIVE_BAR` and expects none.
**Expected: FAIL.**

- [ ] **Step 2: Find importers**: `rg -n "AdaptiveButton|IconAction|collapseClass|ADAPTIVE_BAR" frontend/src`.

- [ ] **Step 3: Repoint every import to `@djntechnic/bedrock-ui`**, delete the local file, run the
guard and the touched suites to green (`$LASTEXITCODE -eq 0`).

- [ ] **Step 4: Commit**

```pwsh
git add -A frontend/src
git commit -m "refactor(ui): replace local AdaptiveButton family with bedrock export"
```

### Task 10: Adopt `Stepper` and `WizardDialog` in `CsvImportSheet`

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- Modify: `frontend/src/components/bulk/CsvImportSheet.tsx`
- Test: `frontend/src/components/bulk/CsvImportSheet.upload.test.tsx`,
  `CsvImportSheet.mapping.test.tsx`, `CsvImportSheet.review.test.tsx`, `CsvImportSheet.commit.test.tsx`

**Delta Verification:**
- Command: `cd frontend; npx vitest run src/components/bulk/CsvImportSheet`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test** in `CsvImportSheet.upload.test.tsx`: the sheet renders an
ordered progress list whose current step has `aria-current="step"` through the platform `Stepper`
(assert the role/attribute, not a CSS class), and the scrolling region is the step body only.
**Expected: FAIL** (the local pill list has no `aria-current`, or is a different structure).

- [ ] **Step 2: Implement** — replace the local stepper markup and dialog frame with `Stepper` and
`WizardDialog`. Staged-row logic, CSV validation, column mapping, and the commit call stay in
`CsvImportSheet` unchanged.

- [ ] **Step 3: Run all four suites to green.** The mapping / review / commit / upload suites are
integration suites and are **not** pruned.

- [ ] **Step 4: Commit**

```pwsh
git add -A frontend/src/components/bulk
git commit -m "refactor(bulk): compose CsvImportSheet from bedrock Stepper and WizardDialog"
```

### Task 11: Adopt `useDraftHistory` and `SelectionDock` in `useBulkDrafts`

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- Modify: `frontend/src/components/bulk/useBulkDrafts.ts`
- Modify: the component that renders the sticky selection bar (find with
  `rg -n "sticky" frontend/src/components/bulk`); candidates `BulkToolbar.tsx`, `BulkSaveBar.tsx`
- Test: `frontend/src/components/bulk/useBulkDrafts.test.ts` (create if absent)

**Delta Verification:**
- Command: `cd frontend; npx vitest run src/components/bulk/useBulkDrafts src/components/bulk/BulkToolbar src/components/bulk/BulkSaveBar`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test** — consumer wiring only: `useBulkDrafts` hands `<DataGrid>` a
`draftsOverride` sourced from `useDraftHistory`, and CollectIt's staged-row / text-equality
behavior is unchanged (set a cell to its current value → no draft, no history entry; set to a new
value → one entry; undo restores). **Expected: FAIL** until the local reducer is gone.

- [ ] **Step 2: Implement** — delete the local reducer and its undo/redo state, call
`useDraftHistory()`, keep every CollectIt rule on top of it. Replace the local selection bar with
`<SelectionDock count onClear>` composing `UndoRedoControls` inside.

- [ ] **Step 3: Run to green; commit**

```pwsh
git add -A frontend/src/components/bulk
git commit -m "refactor(bulk): adopt useDraftHistory and SelectionDock"
```

### Task 12: Adopt `useRecordForm` and `<SaveBar>` in `FieldsWorkbench`

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- Modify: `frontend/src/components/fields/FieldsWorkbench.tsx`
- Test: `frontend/src/components/fields/FieldsWorkbench.test.tsx`

**Delta Verification:**
- Command: `cd frontend; npx vitest run src/components/fields/FieldsWorkbench`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests** — (a) editing a field then clicking Save calls the
mutation once and shows `All changes saved`; (b) a **rejecting** mutation leaves the form dirty and
shows `Save failed`; (c) a user without `update` sees no Save/Cancel (control unmounted via
`<Can>`); (d) no `beforeunload` listener is added by the component itself. **Expected: FAIL.**

- [ ] **Step 2: Implement** — `useRecordForm({ initialValues, onSave })`; render `<SaveBar session=…>`
inside `<Can module=… action="update">`; pass `session` to `WorkbenchShell` so Save-and-continue
works. Remove the local `beforeunload`, dirty flag, and Save/Cancel cluster. The caller raises the
success/failure toast (`useRecordForm` never does).

- [ ] **Step 3: Run to green; commit**

```pwsh
git add -A frontend/src/components/fields
git commit -m "refactor(fields): move FieldsWorkbench onto useRecordForm and SaveBar"
```

### Task 13: Adopt `useEditSession` and `<SaveBar>` in `ListingsPage`

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- Modify: `frontend/src/pages/listing-studio/ListingsPage.tsx`
- Test: `frontend/src/pages/listing-studio/ListingsPage.test.tsx`
- Modify (only if Task 8's scan marked them `migrate`): the other scan rows

**Delta Verification:**
- Command: `cd frontend; npx vitest run src/pages/listing-studio/ListingsPage`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests** — same four assertions as Task 12 against this page's
save path (success, rejection stays dirty, permission hides the bar, no local `beforeunload`).
**Expected: FAIL.**

- [ ] **Step 2: Implement** with `useEditSession({ dirty, onSave })` and `<SaveBar>` under `<Can>`.

- [ ] **Step 3: Re-run the scan** (Task 8, Step 3) and confirm every `migrate` row is gone from the
output and every remaining row carries a written reason.

- [ ] **Step 4: Commit**

```pwsh
git add -A frontend/src
git commit -m "refactor(listings): move ListingsPage onto useEditSession and SaveBar"
```

### Task 14: Prune redundant tests with an upstream mapping

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- Delete: only files in the mapping table below once each row is filled
- Create (uncommitted): `scratch/collectit-test-mapping.md`

**Delta Verification:**
- Command: `cd frontend; npx vitest run`
- Target runtime: `<60s`
- Exit code verification: `$LASTEXITCODE -eq 0`; the post-prune test count equals the pre-prune
  count minus the cases listed in the table.

- [ ] **Step 1: Count the suite before touching a test**

```pwsh
cd frontend; npx vitest run
$LASTEXITCODE
```
Record files/tests (one line).

- [ ] **Step 2: Fill the table by reading both sides.** Read the consumer test, then the upstream
file in `node_modules/@djntechnic/bedrock-ui/src` (the `v0.13.1` source) — never infer coverage from
a filename. Candidates: `listing-studio/AdaptiveButton.test.tsx` (→ upstream `AdaptiveButton.test.tsx`),
any local `Stepper` / history-reducer / selection-bar test. Template:

| Deleted consumer file | Cases removed | Upstream file in `packages/bedrock-ui` | Upstream cases covering it |
| --------------------- | ------------- | -------------------------------------- | -------------------------- |

A case with no upstream equivalent stays, or is rewritten as a consumer-wiring assertion. Domain
mapping, CSV parsing (`csvImport.test.ts`, `ColumnMapper.test.tsx`), and all `CsvImportSheet.*`
integration suites are never candidates.

- [ ] **Step 3: Delete the mapped files and re-run**; confirm the count delta equals the table.

```pwsh
git rm <mapped files>
cd frontend; npx vitest run
$LASTEXITCODE
git commit -m "test(ui): remove tests duplicated by bedrock-ui platform suites"
```
The table goes verbatim into the PR 2 description.

### Task 15: Reconcile the §S014 ledger and file upstream issues

- **Target Agent:** `@general-purpose`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`, branch `refactor/adopt-bedrock-v0131-primitives`; issues filed
in `djntechnic/bedrock`.

**Files:**
- Modify: `docs/reference/bedrock-issues-to-file.md`

**Delta Verification:**
- Command: `python -m bedrock.tools.s014_audit_ledger_freshness --root .`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Delete resolved entries.** For each ledger row and `Candidates` block, decide:
resolved by `v0.13.1` **and** adopted now (PR 1 and PR 2 on the branch, pins verified) → delete the
table row and its section outright. The `WorkbenchShell` candidate is resolved only if the local
`@shadows WorkbenchShell` file is gone and the bedrock export is used; otherwise it stays. Entry
#18 (media metadata, `bedrock#121`) is unrelated to this release and stays. List every deleted entry
by number for the PR description.

- [ ] **Step 2: Duplicate-check, then file six bedrock issues** (skill `issue-triage`; label
`origin:collectit`; defects carry the RCA sections, features carry brainstorming output). Run
`search_issues` first for each:
  1. `CommandPalette` navigation skips `requestLeave`; routes from `registerCommandRoutes` not `navRegistry` (§S011).
  2. `mlbtracker-*` localStorage keys in `sidebarStore` and `ThemeContext`.
  3. `bg-black/10` overlays inside shadcn primitives (§S009).
  4. `REQ-HDR-003` `TypographyProvider` title-casing `PageHeader` text.
  5. Configurable app branding via `app_config_settings`.
  6. Promote MLBTracker's Theme Manager into `@djntechnic/bedrock-ui`.

An existing duplicate is linked, not re-filed.

- [ ] **Step 3: Record rows.** Add numbered rows to this repo's ledger for 1, 3, 4, 5 with
`[bedrock#<id>](https://github.com/djntechnic/bedrock/issues/<id>)`, the discovery date, symptom,
impact, upstream fix, and local workaround ("none; accepted limit" for #1).

- [ ] **Step 4: Audit and commit**

```pwsh
python -m bedrock.tools.s014_audit_ledger_freshness --root .
$LASTEXITCODE
git add docs/reference/bedrock-issues-to-file.md
git commit -m "docs(ledger): drop entries resolved by bedrock v0.13.1 and record new upstream issues"
```

### Task 16: Gates and draft PR 2

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\CollectIt`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- None modified unless a gate finds a Class A defect.

**Delta Verification:**
- Command: `python scripts/run_qa.py --mode full`
- Target runtime: `<5m`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Gates, each judged by its own exit code**

```pwsh
python -m bedrock.tools.s012_audit_pins --root .
python -m bedrock.tools.s001_audit_duplicates --root .
python scripts/run_qa.py --mode full
python -m bedrock.tools.run_all --root .
cd frontend; npx tsc -b --noEmit
```
- [ ] **Step 2: Console-output check** — `rg -n "console\." frontend/src` over changed files
returns nothing new.
- [ ] **Step 3: Draft PR** with the template filled and three mandatory sections: the Task 14
mapping table, the Task 8 scan table, and the deleted ledger entries by number. Mention the
accepted navigation limits and link issue 1.
- [ ] **Step 4: Background `gh pr checks <pr> --watch`**, yield, then ask before merging.
- [ ] **Step 5: After authorized merge**: `git checkout master; git pull origin master;
git status --porcelain` — empty.

---

## Phase 4 — MLBTracker PR 1 (`chore/bump-bedrock-v0131-shell`)

### Task 17: Branch and baseline

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`

**Workspace:** `C:\Dev\MLBTracker`.

**Files:**
- None modified.

**Delta Verification:**
- Command: `cd frontend; npx vitest run`
- Target runtime: `<60s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1:** Phase 3 merged and verified clean. Then:
```pwsh
git checkout master; git pull origin master
git status --porcelain
git checkout -b chore/bump-bedrock-v0131-shell
git branch --show-current
```
- [ ] **Step 2:** Baseline `cd frontend; npx vitest run` → record counts; classify any red.
- [ ] **Step 3:** Inventory `frontend/src/App.tsx` exactly as Task 3 Step 3, and check Theme Manager
for custom themes with a frozen snapshot (Review risk 1).

### Task 18: Dual pin bump

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\MLBTracker`, branch `chore/bump-bedrock-v0131-shell`.

**Files:**
- Modify: `requirements.txt`, `frontend/package.json`, `frontend/package-lock.json`

**Delta Verification:**
- Command: `python -m bedrock.tools.s012_audit_pins --root .`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1:** `git ls-remote --tags https://github.com/djntechnic/bedrock v0.13.1` is non-empty.
- [ ] **Step 2:** `/bump-bedrock-pin v0.13.1`; no hand edits, no `--legacy-peer-deps`.
- [ ] **Step 3:** `python -m bedrock.tools.s012_audit_pins --root .` → `$LASTEXITCODE -eq 0`; the one
commit touches exactly the three files above.
- [ ] **Step 4:** `cd frontend; npx vitest run`; only the known sidebar-mark / "Analytics" / S001
breaks are allowed, everything else is classified.

### Task 19: Adopt `<AppShell>` / `<AppHeader>` and the baseball `brand`

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\MLBTracker`, branch `chore/bump-bedrock-v0131-shell`.

**Files:**
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/App.shell.test.tsx`

**Delta Verification:**
- Command: `cd frontend; npx vitest run src/App.shell.test.tsx`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test** — one `header.app-header` from the platform; no local
`app-header` markup or `ml-16`/`ml-60` literals; the expanded sidebar shows the text `Analytics`
and the `⚾` mark; a `fullBleed` route renders no header. **Expected: FAIL.**
- [ ] **Step 2: Implement** — `<AppShell>` / `<AppHeader>` replace the hand-built frame;
`<AppSidebar brand={{ mark: "⚾", subtitle: "Analytics" }} />`. Providers and router stay.
- [ ] **Step 3: Run to green** (`$LASTEXITCODE -eq 0`); if Task 17 found a frozen custom theme,
add one case asserting the selected rail card and backdrop still resolve a colour.
- [ ] **Step 4: Commit**
```pwsh
git add frontend/src/App.tsx frontend/src/App.shell.test.tsx
git commit -m "refactor(shell): adopt AppShell, AppHeader, and an explicit brand"
```

### Task 20: S001 audit, gates, and draft PR 1

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\MLBTracker`, branch `chore/bump-bedrock-v0131-shell`.

**Files:**
- None modified unless a gate finds a Class A defect.

**Delta Verification:**
- Command: `python -m bedrock.tools.s001_audit_duplicates --root .`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1:** Run the fast gates (`s012_audit_pins`, `s001_audit_duplicates`), then the full
gates (`python scripts/run_qa.py --mode full`, `python -m bedrock.tools.run_all --root .`), then
`cd frontend; npx tsc -b --noEmit`. Each `$LASTEXITCODE -eq 0`.
- [ ] **Step 2:** `gh pr create --draft --base master --title "chore(bedrock): bump to v0.13.1 and adopt AppShell"`
with the template filled (concern, two breaking items, verification run).
- [ ] **Step 3:** Background `gh pr checks <pr> --watch`; yield; ask before merging.
- [ ] **Step 4:** After authorized merge: `git checkout master; git pull origin master;
git status --porcelain` — empty.

---

## Phase 5 — MLBTracker PR 2 (`refactor/adopt-bedrock-v0131-primitives`)

### Task 21: Branch and edit-session discovery scan

- **Target Agent:** `@Explore`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\MLBTracker`, new branch from updated `master`.

**Files:**
- Create (uncommitted): `scratch/mlbtracker-edit-session-scan.md`

**Delta Verification:**
- Command: `pwsh -File scratch/scan-edit-state.ps1 -Root frontend/src`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1:** `git checkout master; git pull origin master;
git checkout -b refactor/adopt-bedrock-v0131-primitives; git branch --show-current`.
- [ ] **Step 2:** Run the Task 8 scan script against this repo; write
`scratch/mlbtracker-edit-session-scan.md`. `components/RankingsConfigPanel.tsx` and the edit
dialogs must appear; each row is `migrate (Task N)`, `keep: <reason>`, or `file upstream: <reason>`.
- [ ] **Step 3:** Also scan for wizard frames and progress markup:
`rg -n "Stepper|Wizard|aria-current" frontend/src/components/inventory`; the ImportWizard
(`ImportWizardMaster.tsx`, `Step1SetOverview` … `Step4CommitSummary`) is a Task 22 candidate.

### Task 22: Wizard refactor onto `WizardDialog` and `Stepper`

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\MLBTracker`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- Modify: `frontend/src/components/inventory/ImportWizard/ImportWizardMaster.tsx`
- Test: `frontend/src/components/inventory/ImportWizard/ImportWizardMaster.test.tsx`

**Delta Verification:**
- Command: `cd frontend; npx vitest run src/components/inventory/ImportWizard`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing test** — the wizard shows the platform `Stepper` with
`aria-current="step"` on the active step, Back/Next advance and retreat through the four steps,
and the final step's finish action runs the existing commit. **Expected: FAIL** if the wizard
hand-rolls its frame; **if it already composes platform parts, record that and skip the task**.
- [ ] **Step 2: Implement** — frame via `WizardDialog`, progress via `Stepper`. Step bodies
(`Step1`–`Step4`), staging, and commit logic are untouched.
- [ ] **Step 3: Run to green** (the `Step*.test.tsx` suites are integration suites and stay);
commit `refactor(inventory): compose ImportWizard from bedrock WizardDialog and Stepper`.

### Task 23: Edit-session migration of `RankingsConfigPanel` and edit dialogs

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\MLBTracker`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- Modify: `frontend/src/components/RankingsConfigPanel.tsx` and each Task 21 `migrate` file
- Test: a `*.test.tsx` beside each modified file

**Delta Verification:**
- Command: `cd frontend; npx vitest run src/components/RankingsConfigPanel`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1: Write the failing tests per surface** — Save success; **rejecting save stays
dirty**; no update permission → bar unmounted; no local `beforeunload`. **Expected: FAIL.**
- [ ] **Step 2: Implement** with `useEditSession` (form-shaped state: `useRecordForm`) and
`<SaveBar>` under `<Can>`. MLBTracker's own toasts/log lines stay.
- [ ] **Step 3:** Re-run the scan; no unexplained `migrate` row remains. Commit one surface per
commit, `refactor(<scope>): move <Surface> onto useEditSession`.

### Task 24: Prune redundant tests, preserving integration wiring

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\MLBTracker`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- Modify or delete: `frontend/src/components/AppSidebar.test.tsx`, `frontend/src/components/PageHeader.test.tsx`
- Create (uncommitted): `scratch/mlbtracker-test-mapping.md`

**Delta Verification:**
- Command: `cd frontend; npx vitest run`
- Target runtime: `<60s`
- Exit code verification: `$LASTEXITCODE -eq 0`; post-count = pre-count minus the table.

- [ ] **Step 1:** Count before (`npx vitest run`, record one line).
- [ ] **Step 2: Classify every case in the two files by reading it** (decision #6):
**delete** assertions on internal CSS classes, radius, icon rendering, active-indicator markup;
**keep and re-point** assertions on nav items from settings, permission filtering, route mounting,
and context wiring. Verify each deletion against the real upstream case
(`AppSidebar.test.tsx`, `PageHeader.test.tsx` in `node_modules/@djntechnic/bedrock-ui/src`).
- [ ] **Step 3:** Fill the mapping table (template in Task 14), delete the cases (whole file only
if every case is mapped), re-run, confirm the count delta, commit
`test(shell): remove sidebar and header cases duplicated by bedrock-ui`.

### Task 25: Ledger reconciliation and upstream issue rows

- **Target Agent:** `@general-purpose`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\MLBTracker`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- Modify: `docs/reference/bedrock-issues-to-file.md`

**Delta Verification:**
- Command: `python -m bedrock.tools.s014_audit_ledger_freshness --root .`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1:** Delete every entry resolved by `v0.13.1` and adopted (e.g. a `tooltip_override`
or sidebar entry only if the fix ships in this release — check the `v0.13.1` CHANGELOG entry
before deleting; a fix merely *released* but not adopted stays). List deleted entries by number.
- [ ] **Step 2:** Add rows for the issues filed in Task 15 that affect this repo (2, 5, 6) with
links; **do not re-file**.
- [ ] **Step 3:** Run the audit (`$LASTEXITCODE -eq 0`); commit
`docs(ledger): drop entries resolved by bedrock v0.13.1 and record new upstream issues`.

### Task 26: Gates and draft PR 2

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\MLBTracker`, branch `refactor/adopt-bedrock-v0131-primitives`.

**Files:**
- None modified unless a gate finds a Class A defect.

**Delta Verification:**
- Command: `python scripts/run_qa.py --mode full`
- Target runtime: `<5m`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1:** Fast gates, full gates, `cd frontend; npx tsc -b --noEmit`, each judged alone.
- [ ] **Step 2:** Draft PR; description carries the Task 24 mapping table, the Task 21 scan table,
the deleted ledger entries, and the accepted navigation limits with a link to the upstream issue.
- [ ] **Step 3:** Background `gh pr checks <pr> --watch`; yield; ask before merge.
- [ ] **Step 4:** After authorized merge: `git pull origin master; git status --porcelain` — empty.

---

## Phase 6 — Quality Gatekeeper & Archiving

### Task 27: Cross-repository verification

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** all three repositories, each on updated `master`.

**Files:**
- None modified.

**Delta Verification:**
- Command: `python -m bedrock.tools.s012_audit_pins --root .` (run once in each consumer)
- Target runtime: `<60s`
- Exit code verification: `$LASTEXITCODE -eq 0` in each

- [ ] **Step 1:** In CollectIt and MLBTracker: `git pull origin master`, `git status --porcelain`
(empty), `s012_audit_pins`, `s001_audit_duplicates`, `s014_audit_ledger_freshness`,
`python -m bedrock.tools.run_all --root .`. All `$LASTEXITCODE -eq 0`.
- [ ] **Step 2:** Prove eviction: `rg -n "export (function|const) (AdaptiveButton|Stepper|WizardDialog|SelectionDock|useDraftHistory)" frontend/src`
returns nothing in either consumer.
- [ ] **Step 3:** In bedrock: `npm test`, then `npm run typecheck`, then `pytest packages/bedrock-api/tests/ -q`,
then `python -m bedrock.tools.run_all --root .`; each `$LASTEXITCODE -eq 0`.

### Task 28: Archive this spec, plan, and intake JSON

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Workspace:** `C:\Dev\bedrock`, branch `chore/archive-v0131-downstream-adoption`.

**Files:**
- Move: `docs/specs/2026-10-06-bedrock-v0-13-1-downstream-adoption-design.md` → `docs/archive/specs/`
- Move: `docs/plans/2026-10-06-bedrock-v0-13-1-downstream-adoption.md` → `docs/archive/plans/`
- Move: `docs/plans/2026-10-06-bedrock-v0-13-1-downstream-adoption-intake.json` → `docs/archive/plans/`

**Delta Verification:**
- Command: `python -m bedrock.tools.s008_audit_guidance --root .`
- Target runtime: `<30s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] **Step 1:** Cut the branch from updated `master`.
- [ ] **Step 2:** `git mv` the three files; fix every incoming reference (the spec↔plan links use
`../archive/…` after the move); `rg -n "2026-10-06-bedrock-v0-13-1-downstream-adoption" .` shows no
dangling path.
- [ ] **Step 3:** `python -m bedrock.tools.s008_audit_guidance --root .` → `$LASTEXITCODE -eq 0`.
- [ ] **Step 4:** Commit `chore(docs): archive v0.13.1 downstream adoption spec, plan, and intake JSON`,
open a draft PR, background `gh pr checks <pr> --watch`, yield, ask before merge, then
`git pull origin master; git status --porcelain` — empty.
