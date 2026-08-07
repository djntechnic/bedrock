# Changelog

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
