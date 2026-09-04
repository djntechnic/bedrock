<!-- CLAUDE.md is the navigational index. Hard ceiling: 200 lines.
     New long-form content goes under docs/ and is referenced from here —
     never inlined. Mirrors the convention used by the consumer repos
     (MLBTracker, CollectIt). -->

# bedrock — Claude Code Project

## What this is

The reusable application platform behind `MLBTracker` and `CollectIt`: a
config-driven grid engine, the admin Grid Editor, an auth shell, app config,
schema drift detection, and the admin API. It ships as **two packages installed
by git tag**, not from a registry.

| Package | Path | Consumed as |
| ------- | ---- | ----------- |
| `bedrock-api` | `packages/bedrock-api/` | `bedrock-api @ git+https://github.com/djntechnic/bedrock@<tag>#subdirectory=packages/bedrock-api` in the consumer's `requirements.txt` |
| `@djntechnic/bedrock-ui` | `packages/bedrock-ui/` | `"@djntechnic/bedrock-ui": "github:djntechnic/bedrock#<tag>"` in the consumer's `frontend/package.json` |

Both carry the **same version number** and move together on one tag. A consumer
on two different refs has a backend and frontend that disagree about what they
are, and it fails at install time, not review time.

**The npm manifest lives at the repo root**, not in `packages/bedrock-ui/` — npm
cannot install a package from a subdirectory (see v0.1.1). `vitest.config.ts`
sits at the root for the same reason: the two need to agree about where
`node_modules` is.

**PR target:** `master`.

## The platform boundary

**bedrock holds no business domain.** Nothing here knows what a baseball player
or a trading card is. Everywhere the platform needs application knowledge it
exposes an extension point and the host application supplies the answer.

The test, stated from the consumer side: *a backend file belongs to the
application iff it touches an application table.* If you are about to add
domain vocabulary to this repo, you are adding it in the wrong place — add an
extension point instead.

Read [`docs/extension_points.md`](docs/extension_points.md) before adding one.
There are exactly **two kinds** and picking the wrong one is the mistake that
document exists to prevent:

- **Registry** — *"what else should the platform include?"* All contributions
  win. Chosen by code. Changing it needs a deploy. Seven exist today.
- **Provider** — *"who does this?"* Exactly one wins. Chosen by configuration
  (a row in `app_config_settings`). Changing it needs a settings edit.

If two implementations could sensibly be active at once, it is a registry.
Three health counters all run; two SMTP servers do not both send the email.

---

## Dev Commands

```bash
# Frontend (@djntechnic/bedrock-ui) — from the repo root
npm install --no-audit --no-fund
npm test               # vitest run
npm run test:watch
npm run typecheck      # tsc --noEmit -p packages/bedrock-ui/tsconfig.json

# Backend (bedrock-api)
cd packages/bedrock-api
pip install -e ".[dev]"
pytest
```

**Never add `--legacy-peer-deps` to the install.** The package ships source and
declares only peers; npm 7+ installs `peerDependencies` alongside
`devDependencies`, so a plain `npm install` gets both. That flag makes npm skip
the peer install entirely, and the type check and tests then pass against
modules that are not there.

Run the type check **after** the tests, so a genuine failure is reported rather
than a missing matcher type on a test file. CI does this deliberately.
During iteration, run targeted unit tests; reserve full test runs and typecheck for pre-PR gating.

---

## Package Map

### `bedrock-api` — `packages/bedrock-api/bedrock/`

| Module | Holds |
| ------ | ----- |
| `core/database.py` | DB abstraction. SQLite is the supported engine; the Postgres branch is incomplete plumbing, not a deployment (#25) — leave `DATABASE_URL` unset. The consumer's `db.get_config` / `set_config` / `get_current_season` live here. |
| `core/config.py`, `app_config_sections.py`, `config_constants.py` | App config surface — the provider-selection substrate. |
| `core/schema_catalog.py`, `schema_drift.py`, `migrations.py` | Schema catalog generation, drift detection, migration runner. |
| `core/providers.py`, `diagnostics_registry.py`, `health_metrics.py`, `diagnostic_checks.py` | The extension-point machinery itself. |
| `core/rate_limit.py`, `error_handlers.py`, `logging.py` | Cross-cutting middleware. |
| `routes/` | `admin_platform`, `auth`, `config`, `diagnostics`, `health`, `modules`, `seo`, `user_preferences`. |
| `services/` | Auth, OAuth, users, admin, modules, media, email tokens, user preferences. |
| `mail/`, `storage/` | Provider-shaped: SMTP + templates; Cloudflare + provider interface. |
| `schema/` | `baseline.sql`, `seed.sql`, `migrations/`. |

### `@djntechnic/bedrock-ui` — `packages/bedrock-ui/src/`

| Path | Holds |
| ---- | ----- |
| `hooks/useGridConfig.ts` | **The central grid config hook — every consumer grid depends on it.** |
| `hooks/useUserGridConfig.ts` | Per-user grid preferences + the debounced persist loop. |
| `components/grids/DataGrid.tsx` | The grid engine. `useReactTable(` should appear in exactly one place. |
| `components/grids/` | `EditableCell`, `GridFocusShell`, `cellPosition`, `cellRegistry`, `cellRenderers`, `bulkDraftStore`, `rowAccentRegistry`. |
| `components/admin/gridEditor/` | The admin Grid Editor. |
| `components/admin/` | `ConfigEditor`, `UsersPanel`, `LogViewer`, `PlatformHealthPanel`, `ProfilePage`. |
| `components/auth/` | Auth flow pages + `authFlowApi`. |
| `components/` (root) | App shell — `AppSidebar`, `AppFooter`, `PageHeader`, `PageToolbar`, `CommandPalette`, `Breadcrumb`, `ProtectedRoute`, `navRegistry`. |
| `lib/`, `utils/`, `store/`, `context/`, `types/` | `cn()`, the `log` Pino logger, Zustand stores, providers. |
| `styles/tokens.css` | Design tokens, exported as `@djntechnic/bedrock-ui/styles/tokens.css`. |

Consumers must add an `@source` line pointing at this package so Tailwind scans it.

---

## Reference Docs

- [`docs/platform_guide.md`](docs/platform_guide.md) — primary cross-repository architectural guide, lifecycle model, and consumer invariants.
- [`docs/extension_points.md`](docs/extension_points.md) — registries vs. providers. **Read before adding either.**
- [`docs/deployment.md`](docs/deployment.md) — `deploy/` Dockerfiles, compose, nginx.
- [`docs/media.md`](docs/media.md) · [`docs/mail.md`](docs/mail.md) — the two provider-shaped subsystems.
- [`docs/pagination.md`](docs/pagination.md) · [`docs/seo.md`](docs/seo.md)
- [`CHANGELOG.md`](CHANGELOG.md) — release notes. Consumers read this to decide whether a pin bump is mechanical.

---

## Release Workflow

Bedrock is **always released before** a consumer bumps its pin. `/cut-release`
runs the sequence: move both versions, write the CHANGELOG entry, run both
gates, merge, tag the merge commit with the full 40-char SHA, push the tag, and
verify it with `git ls-remote`.

If `git push origin <tag>` returns HTTP 403 the tag was not created — do not
tell the consumer it is ready. Hand the user the commands and wait.

Consumers then run their own `/bump-bedrock-pin <tag>`. Never edit a consumer's
pins from inside this repo.

## CI

`.github/workflows/ci.yml` — two jobs on every PR and every push to `master`:
`bedrock-api (pytest)` and `bedrock-ui (vitest + tsc)`. Both block merge.
Wait for CI via background `gh pr checks <pr> --watch` and yield the turn; never
`sleep`-poll. All checks must pass (exit code 0) before merge. Zero broken tests ship to master.

Precise typing only — `any` casts and `@ts-ignore` / `@ts-expect-error` are
banned as fixes.

## Working Agreement

**Answer with the decision, not the journey.** Test results as counts, one line
each. No passing output, no recaps, no preamble.

Breaking changes to a consumer-visible surface — an export, prop, hook
signature, extension-point contract, or route shape — are called out explicitly
in the CHANGELOG. Internal refactors behind a stable export are not breaking.

Force-pushing needs explicit user authorization **every time**; prior approval
never carries over.

## Slash Commands

| Command | Usage | Description |
| ------- | ----- | ----------- |
| `/cut-release` | `/cut-release v0.6.0` | Move both versions, CHANGELOG, gates, tag, push, verify. |

## GitHub Repo

`djntechnic/bedrock`
