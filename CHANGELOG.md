# Changelog

## Unreleased

Plan F0 and F1 — the extension-point convention, and the first capability built
on it.

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
