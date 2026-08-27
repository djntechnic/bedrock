# Changelog

Every release carries a `## For consumers` section listing what to adopt and
what to delete. The cascade workflow copies that section verbatim into an
issue in each consumer repo, so the adoption obligation travels with the tag
rather than waiting to be noticed here.

This changelog nests that section at `###`, matching this file's convention
of subsections under a version heading. The release body the cascade
workflow actually parses is not this file — it keeps `## For consumers` at
the top level, which is what `.github/workflows/cascade.yml`'s awk extractor
matches on. The two are intentionally not the same heading level; treat the
release body, not this file, as authoritative for what the workflow expects.
When drafting a release body, write the section as `## For consumers`, not
`### For consumers`, even though you are copying it out of this file's
nested form — the cascade workflow's extractor matches `^## For consumers`
literally and fails the release's cascade job on a mismatch.

## Unreleased

### For consumers

**Adopt**
- `bedrock.core.app_factory.create_app()` — build the application with one
  call instead of copying `tests/conftest.py::build_app()`. It mounts every
  platform router, registers the error handlers and the rate limiter, mounts
  `bedrock.routes.seo` unprefixed (`mount_seo=False` to opt out), and runs the
  boot sequence in lifespan with `before_migrations` / `after_bootstrap` /
  `on_shutdown` hooks. `PLATFORM_ROUTER_MOUNTS` is exported alongside it.
  [`docs/app_assembly.md`](docs/app_assembly.md).

**Delete**
- Your hand-copied router mount map, your hand-written `DatabaseQueryError`
  handler, and the lifespan that re-implements the boot sequence.

**Why you want it:** the app-assembly contract lived in a *test fixture*. It
could be reordered or narrowed by a change that stayed green in this repo's
CI, and each consumer's copy drifted on its own — one of them was missing the
seo mount, and both re-implemented an error handler the platform already
exports. A consumer that skips `register_error_handlers()` turns a failed grid
query into an empty grid rather than an error state, and nothing tells it.

## v0.6.2

### For consumers

**Adopt**
- Re-point both pins at `v0.6.2`.
- If a grid's checkbox column needs its own header label or a selection cap,
  pass `selectionOptions` to `<DataGrid>` — it reaches
  `prependSelectionColumn` unchanged. Defaults are what they were ("Sel", no
  cap), so a grid that says nothing behaves as before.
- `<EditableCell>`'s idle affordance is labelled `Double-click or type to
  edit` (it has been since type-to-edit landed). A test selecting on the older
  `Double-click to edit` needs updating.

**Delete**
- Nothing.

**Why you want it:** `v0.6.1` restored the per-module layout but not every
module's exports. Only `src/index.ts` was a build entry, so Rollup dropped any
export the barrel's graph never reached — `renderRankCell` and
`useRowClickHandler` were both erased. `tsc` shakes nothing, so the `.d.ts`
kept declaring them: a consumer's type check passed and the import threw
`… is not a function` at runtime.

### Fixed

- **`v0.6.1` tree-shook exports its declarations still promised.** Every
  source module is now its own build entry, which makes its public surface
  load-bearing rather than reachable-from-the-barrel. `packaging.test.ts`
  gained a check that diffs each emitted module's runtime exports against its
  `.d.ts`, so the two can no longer drift apart unnoticed.

### Added

- **`<DataGrid selectionOptions>`.** `prependSelectionColumn` has accepted a
  header label, tooltips and a selection cap since it was written, but the
  engine only ever called it with defaults — so a grid whose selection means
  something specific had no way to say so. MLBTracker's Trends page compares
  at most three players under a "Cmp" header and could not express either.

## v0.6.1

### For consumers

**Adopt**
- Re-point both pins at `v0.6.1`. Nothing else changes: no API moved, no
  export was added or removed.

**Delete**
- Nothing.

**Why you want it:** `v0.6.0` is unusable for any consumer that imports a
module by subpath. Its build emitted a single `index.js`, so
`@djntechnic/bedrock-ui/hooks/useAuth` — and every other `"./*"` import the
package advertises — resolved to a file that was never written. MLBTracker has
86 such imports and cannot type-check against `v0.6.0`; CollectIt has one.

### Fixed

- **`v0.6.0` shipped a bundle where its `exports` map promised modules.** The
  library build wrote one `index.js`; the root `package.json` advertised
  `"./*" → dist/*`. Every deep import therefore resolved to a missing file,
  and the wildcard target carried no extension for the extensionless specifier
  consumers actually write. The build now emits one `.js` per source module
  (`preserveModules`), landing beside the `.d.ts` that `build:types` already
  wrote, and the wildcard target supplies `.js`/`.d.ts` explicitly. Nothing
  here caught it before: bedrock's own tests import from `src`, and its type
  check never resolves the package by name — so `packaging.test.ts` now reads
  the built `dist` and asserts the layout the `exports` map claims, and CI
  builds the package before running the suite.

- **The cascade workflow was invalid YAML from its first commit and never
  ran.** Its issue body was inlined into a `run: |` block scalar with a
  horizontal rule at column 1, where a bare `---` is a document separator —
  so GitHub refused the file and `v0.6.0` published without cascading to
  either consumer. The body is now built with `printf` and passed as
  `--body-file`, a `workflow_dispatch` input allows re-cascading an
  already-published tag, and CI parses every workflow file so an unreadable
  one fails a PR instead of a release.

## v0.6.0

### For consumers

**Adopt**
- Nothing required. `apply_migrations()` now bootstraps `baseline.sql` on a
  database that has never had it, which is automatic on next boot.

**Delete**
- Both `optimizeDeps.exclude` and `optimizeDeps.include` entries for
  `@djntechnic/bedrock-ui` in your `vite.config.ts` — remove them together,
  not one at a time. This is safe only from `v0.6.0` onward: that is the
  release that makes the package ship built ESM instead of raw TypeScript
  (#41), which is what lets its transitive CommonJS dependencies go
  uncrawled by Vite's dependency optimizer. Apply this deletion against an
  earlier pin and nothing has changed what the package ships, so dropping
  only `include` while `exclude` still lists the package leaves it uncrawled
  regardless, and you'll hit
  `use-sync-external-store/shim/with-selector.js` failing to resolve — which
  looks like a regression in this release, not the half-finished cleanup it
  actually is. Removing neither is safe (if stale); removing only one is
  worse than removing neither.

**Verify**
- Start your dev server in a browser after bumping. This is the only place
  the packaging defect was ever visible.

### Fixed

- **A fresh consumer database booted clean and then 500'd** (#20). Nothing
  applied `baseline.sql` at runtime — only the `migrations/` chain replayed —
  so a genuinely empty database had none of the platform's tables. No existing
  test caught it because the session fixture builds its database by running
  `baseline.sql` itself, making the empty-database path structurally
  unreachable from every test that used it. `apply_migrations()` now bootstraps
  the baseline first, guarded by the ledger (not table introspection, since a
  consumer may have dropped a platform table by hand) so a second boot is a
  no-op. Fixing this also surfaced a latent bug in `_split_sql_statements`: a
  trailing `--` comment containing an apostrophe (e.g. "provider's") desynced
  the quote-parity tracker for the rest of the file, silently merging any
  number of subsequent statements into one. Comments are now stripped in the
  same quote-aware pass instead of a whole-line pre-filter.

### Changed

- **`@djntechnic/bedrock-ui` now ships built ESM from `packages/bedrock-ui/dist`
  instead of raw TypeScript** (#41). `exports["."]` resolves to
  `dist/index.js` and `dist/index.d.ts`, produced by a Vite library build, so
  consumers no longer transpile the package's `.ts`/`.tsx` sources themselves.
  This is what makes the consumer-side `optimizeDeps.exclude` /
  `optimizeDeps.include` workarounds for this package removable — the
  package's transitive CommonJS dependencies no longer need crawling by
  Vite's dependency optimizer once the package itself is prebuilt. That
  removal is not safe against any pin before this release.

## v0.5.0

### Fixed — four defects that no test could see

Each of these was invisible to the suite, because none of them broke a behaviour
anyone had asserted on.

- **`useUserGridConfig` issued an unbounded PATCH/GET storm on an idle grid**
  (#11, #18). `useMutation` returns a fresh result object every render and
  `schedulePatch` listed it as a dependency, so every `persist*` callback was a
  new function each render, a consumer effect keyed on one re-ran on identity
  alone, and the cycle fed itself: debounce re-arms, PATCH invalidates the
  preference queries, refetch re-renders. The console filled with `[Violation]
  'setTimeout' handler took XXms`. `.mutate` is stable and moves to a ref, and a
  second guard keyed by the update's field set refuses to arm the debounce for a
  payload already persisted — tracked per field set, so an idle sort cannot mask
  a live filter.
- **`CellRangePaste` dropped the visible row order** (#30). The payload reported
  only an anchor, so a consumer had to work out which row came next, and the only
  order reachable from out there was the DOM's — which reads the *rendered* rows
  rather than the model's, and pastes into the wrong records the moment rows
  virtualise. The visible row and column order now ships on the event, clamped to
  the rows and columns that exist.
- **The browser logger was inverted relative to its own comment** (#17).
  `asObject` gave development shipper-shaped objects in which the message was the
  one part you could not read, and consumers' real warnings drowned in it.
- **`AlertDialogOverlay` warned on every destructive confirm** (#13) — a plain
  function component taking a Radix `Presence` ref, which React 18 drops. The
  package builds against 18, so it is a `forwardRef`.

### Fixed — a pinned column, a reachable column list, a cell you can double-click

- **A pinned column stopped sticking in bulk edit.** `cn()` is tailwind-merge and
  `sticky`/`relative` are one position group, so the `relative` that selectable
  cells add collapsed the pin. The decision now happens once, in
  `cellPosition.ts`, and the tests assert through `cn` — asserting on the raw
  return would have passed against the defect.
- **`ColumnToggle` caps the list at the viewport and scrolls it**, with the count
  and the All/None pair pinned outside the scroll region. A grid that seeds its
  bulk-edit columns hidden alongside its browse columns put twenty-odd entries in
  a panel that ran off the bottom of the screen, and the last ones were simply
  unreachable.
- **A cell enters edit mode on double-click**, routed through the same begin-edit
  handler the keyboard path already used.

### Added — the platform says something when a grid fails, is unseeded, or a toast fires

Three silences, all of which looked identical to "there is no data":

- A grid id nothing seeds rendered as a blank area — no error, no log, no pointer
  at the missing `app_grid_settings` row (#24). `useGridConfig` now derives
  `isUnseeded`, kept distinct from `isLoaded` because not-loaded means "wait" and
  unseeded means "this will never arrive", and `<DataGrid>` renders an error
  state and logs it.
- `DatabaseQueryError` had documented the `GRID_QUERY_FAILED` envelope since
  Phase 2.b with nothing registered to produce it, so a failed SELECT reached the
  client as an empty result set (#21). `register_error_handlers(app)` registers
  it in one call, so a future platform exception arrives on upgrade rather than
  in every consumer's entry point. The SQL goes to the log and never to the
  response.
- `sonner` was a declared dependency with no `<Toaster>` mounted, so four
  platform components — a CSV export, two grid-editor saves and a rejected cell
  commit — called `toast()` and displayed nothing (#16). `ThemeProvider` mounts
  one, themed from the palette actually painted, with `toaster={false}` for a
  host that owns its own surface.

### Added — the admin screens the platform's hooks were always for

bedrock served `/admin/logs`, `/admin/config`, `/admin/users` and the auth
endpoints, and exported a hook for each, while shipping no screen for any of
them. Every consumer built the same four panels over the same hooks, and the
sidebar's user block linked to `/profile` — a route the platform never served, so
clicking your own name rendered `No routes matched location` (#19).

Five screens now ship on the `<GridEditor>` precedent — mount one in a route and
supply nothing: `<LogViewer>`, `<ConfigEditor>`, `<UsersPanel>`,
`<PlatformHealthPanel>` and `<ProfilePage>`, plus the `useChangePassword`
mutation the last one needs.

`<AppSidebar>` gains `profilePath`, defaulting to `/profile` where
`<ProfilePage>` belongs. An app that routes no profile screen passes `null` and
gets plain text instead of a link into a dead route.

### Added — a consumer-facing API for the bulk draft store

The store was module-private, so `<EditableCell>` was its only writer. The three
gestures that make a bulk grid worth having — fill-down, spreadsheet paste,
apply-to-selected — write many cells at once from outside any cell and had
nowhere to write, so a consumer reimplemented the buffer, the dirty flag and the
Save/Discard bar the engine already ships (#15).

Three ways in, all of them the engine's own semantics:

- `draftsOverride={{ drafts, onChange }}`, mirroring `selectionOverride`.
  Supplying it turns bulk mode on by itself, since a caller that owns the buffer
  usually owns the save. The reads go through refs so the setter stays
  identity-stable against the inline object literal a consumer will write.
- `CustomCellCtx` carries `rowKey`, `draftValue` and `setDraft`, so a consumer's
  own cell can read and write the pending value for its row.
- The reducer moves to `bulkDraftStore.ts` and is exported, with `applyDrafts`
  for the batch gestures — one state update for a paste, not one per cell.

`canEdit` no longer wraps a supplied `customCells` renderer, and
`editableColumnIds` excludes those columns for the same reason: a consumer that
provided a cell has already said what the editor is. Opting into bulk mode was
replacing a 29,000-value typeahead with a plain text box on exactly the columns
that need the vocabulary.

### Added — a System theme, and Pin to Dashboard in the Grid Editor

`ThemeProvider` gains a System mode following `prefers-color-scheme`, live rather
than only at load. It selects among registered palettes and defines no colour of
its own, per §S9. The choice is persisted, not the resolution.

Pin to Dashboard is surfaced in the Grid Editor. It lives in
`user_grid_preferences`, not `app_grid_settings`, so it saves on toggle and says
so rather than pretending the Save button covers it.

`<PageHeader>` gains an opt-in `sticky` prop — opt-in because `position: sticky`
is inert outside a scroll container but the negative-margin bleed is not, so
defaulting it on would reflow hosts that never asked.

## v0.4.0

### Fixed — the grid cursor and the cell editor stop fighting over the keyboard

v0.3.0 gave `<DataGrid>` a cell cursor and `<EditableCell>` an inline editor, and
the two could not be used together. The cursor binds a **window** keydown, and
`isEditingActiveElement()` — its "leave the keys alone" guard — is a DOM-focus
test. An idle editable cell holds no DOM focus, so the cursor swallowed `Enter`
and moved down instead of opening the editor underneath it. Double-click was the
only gesture that ever worked, and only for the cell the mouse was over.

Three pieces, each opt-in:

- **`<EditableCell>` types like a spreadsheet.** A printable character opens the
  editor seeded with *that character*, replacing the value; `Backspace`/`Delete`
  open it empty; `Enter`, `Space`, `F2` and double-click open it preserving the
  value and select it. Escape still cancels.
- **`useCellSelection` gains `onBeginEdit(cellRef, seed)`.** When the consumer
  supplies it, a keystroke on the focus cell is offered to it before navigation
  claims it; returning `true` claims the key, and anything else falls through to
  the behaviour that shipped before — so `Enter` on a read-only cell still moves
  down. Arrows, `Tab`, `Ctrl+A` and `Escape` are never offered. A grid that
  passes no handler is byte-for-byte unchanged. The keyboard table itself is
  exported as `seedForKey`, so the hook and the cell cannot drift apart.
- **`<EditableCell openWith={{ seed, nonce }}>`** opens a cell nothing clicked.
  It is an edge-triggered request keyed by `nonce`, not a controlled value:
  editing state stays inside the cell, so no existing consumer has to start
  owning state it never had. `<DataGrid>` wires the two together and declines a
  column that is not editable.

### Changed — the selection column stopped being a player-comparison widget

`prependSelectionColumn` carried a hardcoded `selectedIds.length >= 3` cap, a
`"Cmp"` header and a "Max 3 players for comparison" tooltip — baseball-era
defaults that silently made a bulk operation over a real selection impossible on
every other grid. The cap is now an opt-in `maxSelected` option, and the header
and tooltip copy are options too (defaults: `"Sel"` / "Select rows" / "Select
row"). A row key of `0` now gets a checkbox: the guard was `!id`, and is `id == null`.

### Added — `selection_position`, so the checkbox can sit on the left

New `app_grid_settings` column (migration `003`, default `'end'`, so no shipped
grid moves), threaded through the admin schema, `useGridConfig`, the Grid Editor
settings panel and its preview. `<DataGrid>` no longer hardcodes `"end"`.

`GridConfig.columnOrder` also gained a doc comment naming its trap: it lists
**visible** columns, so a hidden-but-`editable` column is absent from it and
anything deriving a working set must iterate `GridConfig.columns` instead.

## v0.3.0

### Added — a cell cursor and clipboard for `<DataGrid>`, opt-in

The grid engine could select rows and edit one cell at a time. Neither is bulk
entry: filling forty rows across eight columns meant forty-times-eight
click-type-Tab cycles, with no way to copy a rectangle out to Excel or paste one
back in.

`<DataGrid>` now takes `cellSelection`, and with it a spreadsheet cursor —
click, shift-click, drag, arrow keys, `Shift`+arrows to extend, `Ctrl`+arrows to
the edge, `Ctrl+A`, `Escape`. `Ctrl+C` writes the selected rectangle to the
clipboard as TSV; `Ctrl+V` parses TSV back out and reports it. A fill handle on
the range's bottom-right corner reports a downward fill.

Three things are worth knowing about the shape of it:

- **The engine reads and reports; it never writes.** `onRangePaste` and
  `onRangeFill` hand the consumer a rectangle and the values destined for it,
  because the consumer owns the draft buffer — the same reason `onBulkCommit`
  does not fit an app that stages edits before saving them.
- **Clipboard access goes through the native `copy`/`paste` events**, not
  `navigator.clipboard.readText`, which needs a permission Firefox does not
  grant. `event.clipboardData` is available in every browser during a real
  keystroke. `writeText` is a fallback for the copy direction only, for when an
  event arrives carrying no clipboard at all.
- **The rectangle spans the full sorted and filtered row model**, not the
  visible page — `GridWrapper` owns pagination internally, so a paste that runs
  past the last visible row continues onto the next page rather than stopping at
  a boundary the operator cannot see. A selection whose row is filtered away or
  whose column is hidden is dropped rather than silently re-pointed.

The cursor skips the columns the engine prepends itself — expander, rank, compare
checkbox — so a copied rectangle never contains a blank column for a checkbox.
Row selection and cell selection coexist. Grid keys are ignored while a cell
editor has focus, so typing a tab inside `<EditableCell>` still belongs to the
editor.

`useCellSelection` is exported alongside, with `toTsv`/`parseTsv`, for a grid
that is not a `<DataGrid>`. Every new prop defaults off; disabled, the hook binds
no listeners. The only change visible to an existing grid is two data attributes
per cell.

### Added — `GridFocusShell`, a full-viewport workspace for any grid

`admin/gridEditor/GridFocusMode` proved the pattern and is welded to a
`GridDraft`. `GridFocusShell` is the generic runtime version: `open`, a title, a
sticky `toolbar` slot, a scrolling grid, and a sticky `footer` slot for a Save
bar.

Dismissal is deliberately hard. Outside clicks and pointer-downs are prevented,
because a stray click on the overlay must not be the thing that discards a
hundred unsaved cell edits. Escape routes through an optional `onEscape` instead
of closing, so a dirty-state confirmation can own the decision and close the
shell itself once the operator has answered.

No new design tokens: the cursor and range styling reuse `primary`, so an app's
token audit stays clean.

## v0.2.2

### Added — `NavItem.role`, for a nav entry that hides rather than greys out

`<AppSidebar>` had exactly one way to gate an entry by permission:
`module: "admin"`, a special case predating the module registry. Any other
gating went through `module`, and `module` also drives the `hasModule()`
*disabled* rendering — so an app that gates by role but seeds no module registry
got a permanently greyed-out entry rather than a hidden one.

`NavItem` now takes an optional `role` slug. Below it the entry is not rendered
at all, because an admin-only destination should not advertise itself. The guard
mirrors `<ProtectedRoute requiredRole>`, `isAdmin` short-circuit included, so a
superuser never loses a link to a route they can in fact open.

The decision is factored out as the pure, exported `isNavItemVisible(item, auth)`
— the sidebar needs a router, a query client and an auth provider to render, and
the gating logic is worth testing without all three.

`module: "admin"` keeps its existing meaning, and module gating still only
*disables*: "not switched on" and "not for you" are different answers and should
not look alike. Nothing registered today changes behaviour.

## v0.2.1

Two fixes to the boot path, both found by running MLBTracker's real migration
chain from an empty database rather than from a copy of a working one.

### Fixed — a failed migration no longer leaves the schema half-changed

`_run_sql_file` executed a migration's statements one at a time with no
transaction, and `_apply_one` logged-and-skipped on failure. Together those
read as resilient and behave as the opposite: the statements before the failing
one stayed committed, nothing was written to the ledger, and the next boot
replayed the file from statement one against a database that had already
received part of it.

Now each migration's statements and its ledger row commit as one transaction,
and a failure raises rather than being swallowed. A migration that cannot be
applied stops startup, which is the honest outcome — the alternative was an
application serving traffic on a schema no migration path describes.

Two supporting changes came with it:

- `_execute_statement` and `_run_sql_file` take the transaction's connection,
  and the ADD/RENAME COLUMN guards pre-check through it. Probing on any other
  connection would read "table absent" for a table the same file created three
  statements earlier, and "absent" makes the guard return quietly — skipping
  real work and calling the migration a success.
- `db.transaction()` opens its SQLite connection in autocommit mode and issues
  an explicit `BEGIN`. pysqlite only starts a transaction ahead of DML, so
  without this a `CREATE TABLE` committed on the spot and survived the
  rollback, which for a schema migration is the whole failure mode.

**Upgrading:** a migration that has been failing silently on every boot will
now abort startup. That is the point, but it means the failure surfaces at the
worst moment if it has been running unnoticed — check the startup log for
`Migration skipped (failed)` on v0.2.0 before upgrading.

### Added — `register_ignored_objects`, for objects deliberately uncatalogued

Not every live object belongs in a schema catalog. A DELETE-tripwire table a
maintenance script installs out of band; scratch tables a long migration
creates and drops, which linger on any database where it did not finish. Each
one reported as drift on every boot, and a warning nobody can ever clear is a
warning nobody reads.

`core.schema_drift.register_ignored_objects(*names, prefixes=())` declares
them. It is a registry in the F0 sense — additive, overwriting on re-import,
with `registered_ignored_objects()` / `registered_ignored_prefixes()` readers.
Both forms exist because both cases do: exact names for one-off objects,
prefixes for families.

Ignores filter the `extra` half of the drift report only. "Exists live,
uncatalogued on purpose" says nothing about an object the catalog expects and
the database does not have, so `missing` is untouched. The `extra` warning also
stops advising "regenerate the catalog" as the only remedy — wrong advice for
an object the generator filters deliberately — and names the ignore route too.

## v0.2.0

Plan Phase 3.5, Tier A. The gap this release closes is the one between "a
platform MLBTracker uses" and "a platform a *hosted, public, multi-user* site
can be built on" — every item below was a verified absence, not a wishlist
entry.

| | |
| --- | --- |
| **F0** | the provider extension point, and the convention for choosing between the two kinds |
| **F1** | email delivery, the token store, and the four auth routes that had been designed since Phase 5 and never built |
| **F2** | container images, compose, and a readiness endpoint that returns 503 |
| **F3** | server-side pagination, as a prop existing call sites never pass |
| **F4** | media storage keyed by `(entity_type, entity_id)`, with an approval queue |
| **F5** | per-route document head, sitemap, robots.txt |

Also, and not planned: MLBTracker was still inside the package. Its whole route
map, its query keys, a hook calling one of its endpoints, its role name on the
auth context, and its product name in the footer. None of it failed a type
check or the import-closure audit, because an unused constant and a string
literal are invisible to both — which is the finding, more than the fix.

`bedrock-ui` also gained a test runner. It had `tsc --noEmit` and nothing else
across 96 modules, and it caught a real hang on its first run.

**Upgrading from v0.1.1:** `API_ROUTES`, `queryKeys`, `useAdminKpi`, `AdminKpi`
and `AuthContextValue.isCollector` lose members that were never the platform's.
An application takes back its own route map and query keys, composing them with
what the package still exports; `hasRole("collector")` replaces `isCollector`
exactly. `AppFooter`, `GlobalSearchBar` and `CommandPalette` take their copy as
props. See MLBTracker's adoption for a worked example.

### Added — F2, deployment

Verified absent before this: 14 Windows `.bat` files, no Dockerfile, no
compose file, no service units. MLBTracker runs on a desktop; every app after
it is hosted.

- **`deploy/`** — multi-stage `Dockerfile.api` (no compiler in the runtime
  stage, non-root, `BEDROCK_APP_ROOT` set explicitly), `Dockerfile.web`
  (Vite → nginx), `nginx.conf` (SPA history fallback, `/api` proxy,
  `X-Forwarded-For`), `docker-compose.yml` (Postgres + API + web), and
  `.env.example`. Templates rather than a base image: bedrock is a library
  with no `main.py`, so the app owns the build and these are what it copies.
- **`GET /health/live` and `GET /health/ready`.** The existing `/health`
  answers **200 even when the database is unreachable** — correct for the
  admin Health page, which reads the body to report what is broken, and
  actively harmful as a container healthcheck: it marks a dead app healthy, so
  nothing restarts and a rolling deploy promotes it over a working container.
  Readiness returns 503, and checks a read *and* a write, because a replica
  promoted read-only answers `SELECT 1` and fails every login.
- **`bedrock-healthcheck`** — a console script the image's `HEALTHCHECK` runs.
  `curl` is not in a slim Python image and installing it adds a package and a
  CVE surface to every deploy for a three-line request. Standard library only,
  no bedrock imports, because it must work in the states where the application
  cannot import.
- **`docs/deployment.md`**, including why the stack runs one worker: the rate
  limiter and the diagnostics scheduler both hold per-process state, so N
  workers means N× the configured limit and N runs of every scheduled job.
- **`.env` is gitignored.** It was not, and F1 gave the file a `SMTP_PASSWORD`
  to hold.

### Fixed — the application inside the platform package

Found while adding the F1 pages, and all the same defect: code that reads
correctly in MLBTracker and is wrong the moment a second app consumes it.
None of it failed a type check or the import-closure audit, because an
unused constant and a string literal are invisible to both.

- **`api/routes.ts` held MLBTracker's entire API** — `analytics`,
  `leaderboard`, `trend`, `players`, `search`, `collection`, `catalog`,
  `transactions`, `inventory`, `cardPhotos`, `photoAdmin`, plus the domain
  half of `/admin` (seasons, aliases, teams, inventory statuses, sync trigger,
  KPI). None of it is served by `bedrock-api`. The map now holds only routes
  the platform mounts, and `routes.test.ts` asserts the *shape of the whole
  map* rather than individual paths — a test listing what is present would
  have passed before the cleanup too.
- **`queryKeys.ts` had the matching problem**, exporting cache keys for
  `inventory`, `catalog`, `collection`, `transactions`, `leaderboard`,
  `trend`, `players`, `rankings`, `search`, `cardPhotos` and `photoAdmin`.
- **`useAdminKpi` called an application endpoint.** `/admin/kpi` is served by
  MLBTracker, and `AdminKpi` counted players and stat seasons. A platform hook
  pointed at an app route compiles and 404s in the next app.
- **`CommandPalette` sorted groups by a hardcoded list** of MLBTracker's
  headings. A second app's groups matched none of them, so every static route
  registered, matched the query, and rendered nowhere. Ordering is now first
  appearance in the registered list, which is what `commandRoutes.ts` already
  documented.
- **`AuthContextValue.isCollector`** — one app's role in a platform interface.
  `hasRole("collector")` reads the same and generalises. `isAdmin` stays,
  because the platform itself branches on it.
- **Product copy that named the wrong product.** `AppFooter` rendered the
  literal "Baseball Analytics Platform" in every consumer's footer; the search
  bar and palette prompted "Search players, teams, pages…" in a package with
  neither. All three are props now, with defaults true of any application.

### Added — F5, public-site essentials

- **`useDocumentHead`** — per-route title, description, canonical and the
  Open Graph / Twitter tags a link preview reads. No `react-helmet`: a peer
  dependency, a provider every consumer mounts and a competing scheduler, to
  write four lines into `document.head`. What Helmet buys is SSR, which bedrock
  does not do; if that changes this is one module to replace.
- **A sitemap registry and `robots.txt`.** The platform owns the format,
  escaping, the 50,000-URL ceiling and the caching; the application registers
  what its URLs are, because the platform cannot know one. A raising source is
  logged and skipped rather than failing the file — a sitemap that 500s makes a
  crawler back off the whole site rather than one section — and an app that
  registers nothing gets a valid empty `<urlset>`.
- **`docs/seo.md`**, including the nginx blocks these two paths need (they are
  only honoured at the root of a host, so mounting under `/api/v1` produces
  files no crawler will request) and what is still missing: a scraper that does
  not run JavaScript sees `index.html`'s static tags, which is a rendering
  decision rather than a head-management one.
### Added — F4, media and storage

- **`bedrock.storage`** — a storage provider with local-disk and Cloudflare
  Images backends. Three methods, because the platform calls three; a wider
  guessed surface forces every backend to implement what nothing calls.
  **The fallback is local disk, not a no-op** — a deliberate divergence from
  mail, where dropping the message is survivable. A dropped file is data loss
  the user watched succeed, and local disk needs no configuration, so there is
  no reason to reach for a black hole.
- **`media_service`** — `attach_media(entity_type, entity_id, …)`, the approval
  queue, and deletion, generalised out of MLBTracker's `photo_service`, whose
  every function took a `collection_card_id`. Uploads land `pending` so an
  unreviewed image cannot reach a public CDN, `list_for_entity` filters to
  approved by default, and approve/reject move only pending rows in the WHERE
  clause so two admins on one queue cannot both count the same asset.
- **`media_assets`**, keyed by `(entity_type, entity_id)` with no foreign key
  to any application table — which is what lets one table serve a card's
  photos, a gallery's images and a post's attachments, and which means nothing
  cascades. `docs/media.md` says so and names the call an app makes instead.

### Added — F1, the pages the links land on

- **`SetPasswordPage`, `ForgotPasswordPage`, `VerifyEmailPage`** in
  `bedrock-ui`, plus `AUTH_FLOW_PATHS`, which the backend's link builder and
  the app's router both read. Until now the emailed links pointed at routes no
  package provided, so F1 was complete over the API and unusable in a browser.
  All three are anonymous by construction — someone who has forgotten their
  password cannot be asked to sign in first. One component serves
  `/accept-invite` and `/reset-password` because one endpoint serves both;
  `mode` changes the copy and nothing else.
- **A test runner for `bedrock-ui`.** The package had `tsc --noEmit` and
  nothing else — a check that tells you a prop is misspelled and nothing about
  whether a form submits. Vitest + Testing Library, wired into CI ahead of the
  type check, with 35 tests over the new flows. It earned itself immediately:
  the StrictMode case caught `VerifyEmailPage` hanging on "Verifying…" forever
  in development, because the conventional `let cancelled = false` cleanup
  cancels the first mount's in-flight response while the single-use guard
  suppresses the second mount's request.

### Added — F1, email delivery

Verified absent before this: no SMTP, SendGrid, Mailgun, SES or Postmark
anywhere in the package, while `POST /admin/users/invite` created a user with no
way to tell them and `auth_activity_service` had declared
`password_reset_request` / `password_reset_complete` event types since Phase 5
with no route implementing either. This is that designed-but-unbuilt feature.

- **`bedrock.mail` — the mail capability**, declared with `ProviderRegistry` and
  the first real consumer of F0. Two backends ship, because neither needs any
  application knowledge: `smtp` (a relay — the right default for a self-hosted
  app) and `console` (renders the message to the log, which is how you read a
  reset link in development without standing up a mail server). An application
  registers its own the same way it registers anything else.
- **Invitation, password reset and email verification**, templated in both
  plain text and HTML. Four new endpoints: `POST /auth/password-reset/request`
  and `/complete`, `POST /auth/verify-email/request` and `/confirm`.
  `/admin/users/invite` now emails the invitee a link to set their password,
  and says in its response whether the mail went out — an admin who believes an
  email was sent and is wrong waits for a reply that never comes.
- **`auth_email_tokens`** — single-use expiring tokens behind all three flows.
  Only the SHA-256 is stored, so a database read does not yield a working reset
  link. Single use is enforced by `UPDATE … WHERE consumed_at IS NULL` and the
  row count rather than a check-then-act; issuing supersedes the outstanding
  token for that purpose; expired, spent, unknown and wrong-purpose all fail
  identically, because which one it was is what an attacker probing tokens
  wants told.
- **Platform-owned migrations.** `bedrock/schema/migrations/*.sql`, applied by
  the runner ahead of the application's and namespaced `bedrock_` in the ledger.
  Without this a bedrock release could not add a platform table to an
  application that already exists — `baseline.sql` only reaches databases
  created after the change, so every consumer would have had to hand-copy a
  migration for a table it does not own.
- **`docs/mail.md`** — the operator's view: what to set, what the three flows
  do, and what is deliberately not built yet.

### Fixed — F1

- **`revoke_all_sessions`, called on a password reset.** Rotating a password
  did nothing to a JWT already issued — valid for seven days and carrying no
  password material — so "I reset my password" and "they are locked out" were
  different statements.

### Changed — F1

- `pyproject.toml` names the schema files as package data explicitly. They were
  already installed — `include_package_data` defaults to true for a
  pyproject-configured build — but the platform migrations are now read from
  the installed package at runtime, and relying on a default for that is how
  you get a source tree that works and an install that silently has no schema.
- `FRAMEWORK_CATEGORIES` gains `auth` and `mail`, which token lifetimes and
  mail settings need to be legal config keys at all. Adding a framework
  category only widens the accepted set.
- SMTP connection settings are read from the environment rather than
  `app_config_settings` — a deliberate §S4 departure, since `SMTP_PASSWORD` is
  a credential and app config is rendered in an admin UI and returned by the
  export endpoint. The Cloudflare Images token already drew this line.
- `baseline.sql` is maintained by hand from here on, and
  `tools/generate_baseline_sql.py` is removed. It re-derived the baseline from
  MLBTracker's migration chain, which was the authoritative description of the
  platform schema while the platform lived inside the application. Now that
  MLBTracker consumes this package, a re-run would delete every table bedrock
  has added since — the same reasoning that removed the other extraction
  scripts in v0.1.1.

### Added — F0, the extension-point convention

- **`bedrock.core.providers` — the second kind of extension point.** The seven
  existing registries are all *additive*: they answer "what else should the
  platform include?" and every registration runs. Mail, storage and error
  reporting are not that shape — several implementations are registered,
  configuration picks one, and exactly one wins. `ProviderRegistry` is that
  contract: typed registration, lazy thread-safe instantiation, selection
  re-read from `app_config_settings` so the admin UI can switch backends
  without a restart, and a no-op fallback so an app that configures nothing
  still boots. An unknown provider name logs once and degrades rather than
  raising, because the selecting value is admin-editable and a typo must not
  be able to halt the process.
- **`docs/extension_points.md`.** Which kind to reach for, the naming
  convention, and why the failure policy deliberately differs per registry — a
  failing health counter is swallowed, a failing config section is not.
- **A conformance test** (`test_extension_point_convention.py`) that asserts
  the shape rather than describing it, and fails when a new `register_*`
  function appears in `bedrock.core` without being listed.

### Fixed — F0

- **`register_current_season_resolver` now matches the other six registries.**
  It had no `registered_*` reader, no `__clear_*` test helper, and an
  unannotated parameter — the only registry a test could not undo. All three
  added; the resolver's behaviour is unchanged.

## v0.1.1

Bug fixes found by making MLBTracker consume the package (plan Phase 3). All
of them are the same mistake in different files: code written inside an
application computed paths from its own `__file__`, which stopped being the
application root the moment it shipped as a library.

### Fixed

- **Application paths resolve from the application, not the package.** New
  `bedrock.core.paths` exposes `APP_ROOT` — `BEDROCK_APP_ROOT` if set,
  otherwise the working directory — and `config.py`, `logging.py` and
  `oauth_service.py` anchor to it. Previously all three computed
  `parents[2]` of their own file, which in an installed package is
  site-packages: `.env` was never found and `PROJECT_ROOT` pointed at the
  library.
- **`MIGRATIONS_DIR` points at the app's migrations.** Defaults to
  `<APP_ROOT>/migrations`, overridable with `BEDROCK_MIGRATIONS_DIR`. It
  previously resolved inside the package, so an application's schema history
  was looked for in site-packages and silently found to be empty.
- **The schema-drift check spans both halves of the schema.**
  `check_schema_drift()` diffed the live database against the platform
  catalog alone — correct while the platform was the application, and pure
  noise once an app owns tables of its own, which are all reported as
  unknown objects. New `register_schema_objects()` takes the app's half;
  `expected_objects()` is the union. Registering nothing stays valid.
- **The SQLite default is no longer another app's database file.**
  `SQLITE_DB_PATH` (env, relative values resolved against `APP_ROOT`) with a
  default of `<DATA_DIR>/app.db`, and `BEDROCK_DATA_DIR` to relocate the data
  directory.

### Changed

- **Deep imports actually resolve now.** `exports` mapped `./*` to a path with
  no extension, so `@djntechnic/bedrock-ui/api/client` pointed at a file that
  does not exist and TypeScript reported the module as missing. The pattern is
  now an ordered array trying `.ts`, `.tsx`, then the literal path.
- **`CustomCellCtx`, `CustomHeaderCtx` and `DataGridProps` are exported.** The
  barrel republished `DataGrid` but none of the types a caller needs to write
  a custom cell renderer, so typing one was impossible through the contract.

- **The npm manifest moved to the repository root.** npm cannot install a
  package from a subdirectory of a git repository, so a `package.json` under
  `packages/bedrock-ui/` is simply unreachable by
  `github:djntechnic/bedrock#<ref>` — the install fails with ENOENT looking
  for a root manifest. `exports` now maps back down into
  `packages/bedrock-ui/src/`; the source did not move. pip has no equivalent
  limitation, which is why `bedrock-api` keeps its `pyproject.toml` in place.

- `MLBTRACKER_ALLOW_EMPTY_DB` is now `BEDROCK_ALLOW_EMPTY_DB`.
- Removed `Config.MLB_API_BASE` and `Config.SRC_DIR`. The first is
  application data; the second assumed the app keeps its backend in `api/`.
- Removed the unused `PlayerAliasSchema` and `AdminKpiSchema` — leftovers from
  the platform/domain split of `admin.py`, both dead in this package.
- Removed the MLBTracker extraction scripts from `tools/`. They were correct
  while the app was upstream of the package; now that it consumes the package,
  re-deriving these files from it is backwards, and a re-run would revert
  fixes made here.

### Added

- **The 19 shadcn UI primitives and both loggers are exported from the
  barrel.** They shipped in the package from v0.1.0 but `index.ts` never
  re-exported them, so the only way to reach a `Button` was a deep import the
  README calls unsupported. Found by migrating MLBTracker's frontend: 17 of
  the 35 platform modules it imports were unreachable through the contract.

- `tests/test_paths.py` — 18 tests. Alongside the resolution cases it asserts
  the negative directly: no bedrock path may resolve inside the package, and
  no string *value* in the package may name a specific application. That
  second check exists because the file set is an import closure, and a
  hardcoded application name is invisible to an import graph by construction.

## v0.1.0

The reusable application platform extracted from MLBTracker.

- **bedrock-api** — 32 modules, 53 endpoints, 25-table baseline schema, 77 tests
- **bedrock-ui** — 96 modules: grid engine, Grid Editor, app shell, design tokens

Both are domain-free by construction: the file sets are computed import
closures, so a platform module that grows an application import fails the
build rather than shipping the application module.
