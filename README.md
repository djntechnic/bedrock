# bedrock

A reusable full-stack application platform, extracted from MLBTracker.

Provides a config-driven grid backend and React DataGrid engine, JWT auth with roles and per-user module
gating, DB-backed application config, a schema catalog with boot-time drift
detection, a versioned migration runner, design tokens, platform audit tools, and the admin surfaces that drive all
of it.

## Packages

| Package | Version | Scope |
| --- | --- | --- |
| `packages/bedrock-api` | v0.10.0 | FastAPI application platform: grid config, auth/RBAC, schema catalog, migrations, health, media, storage providers, ecosystem standards audits (`bedrock.tools`) |
| `packages/bedrock-ui` | v0.10.0 | Reusable React UI platform: DataGrid engine, admin Grid Editor, auth shell, navigation rail, design tokens, command palette |

## Assembling an application

```python
from bedrock.core.app_factory import RouterMount, create_app

app = create_app(title="My App", routers=[RouterMount(r, prefix="/api/v1/app") for r in ROUTERS])
```

`create_app()` mounts every platform router at its documented prefix, registers
the platform's error handlers and rate limiter, and runs the database boot
sequence in lifespan — with hooks for what a host has to do before migrations,
after the database is healthy, and on the way down.
See [`docs/reference/app-assembly.md`](docs/reference/app-assembly.md) and [`docs/reference/platform-guide.md`](docs/reference/platform-guide.md).

## The contract

bedrock holds no business domain. Where it needs application knowledge it
exposes an extension point and the host app supplies the answer.

There are two kinds, and they answer different questions. **Registries** ask
*"what else should the platform include?"* — every registration is additive and
all of them run. **Providers** ask *"who does this?"* — several implementations
are registered, configuration picks one, and exactly one wins.

| Registry | Supplies |
| --- | --- |
| `core.config_constants.APP_CATEGORY_MODULE` | app config categories |
| `core.app_config_sections.register_app_config_section` | boot-payload sections |
| `core.health_metrics.register_health_counter` | health endpoint counts |
| `core.db_health.register_canonical_tables` | tables whose emptiness means a wiped DB |
| `core.diagnostics_registry.register_diagnostic_check` | data-quality checks |
| `core.schema_drift.register_schema_objects` | the app's half of the schema |
| `core.database.register_current_season_resolver` | the app's current period |
| `core.sitemap.register_sitemap_source` | the app's public URLs |
| `core.migrations.APP_MIGRATION_MODULE` | inline schema migrations |

Providers are declared with `core.providers.ProviderRegistry`.

| Provider | Config key | Ships with |
| --- | --- | --- |
| `mail.provider.mail` | `mail_provider` | `smtp`, `console`, `null` |
| `storage.provider.storage` | `storage_provider` | `local`, `s3`, `cloudflare_images` |

An application that owns its own object keys wants the wider `ObjectStore`
protocol — caller-chosen keys, exhaustive prefix listing, batch deletes and
public-URL verification — which `local` and `s3` implement and Cloudflare
Images cannot. [`docs/reference/object-storage.md`](docs/reference/object-storage.md).

Error reporting is next. Mail is documented in
[`docs/reference/mail.md`](docs/reference/mail.md): invitation, password reset and email
verification, all of which degrade to a logged no-op when nothing is
configured. `bedrock-ui` ships the three pages those links land on; mount them
at `AUTH_FLOW_PATHS`, which is also what the backend builds the links from.

Every extension point degrades sensibly when nothing is registered, so a
brand-new application boots before it has any data. That property is what makes
the package genuinely reusable rather than MLBTracker with the names filed off
— and it is verified, not assumed.

Full contract, including which kind to reach for and why the failure policy
differs per registry: [`docs/reference/extension-points.md`](docs/reference/extension-points.md). For
the complete cross-repository platform handbook, lifecycle model, and consumer invariants,
see [`docs/reference/platform-guide.md`](docs/reference/platform-guide.md).

## Schema

`packages/bedrock-api/bedrock/schema/` holds `baseline.sql` (the platform's
tables, applied by a new application before its own migrations), `seed.sql`
(the reference rows auth cannot work without), and `migrations/` — the
platform's own versioned migrations, applied by the runner ahead of the
application's.

A platform schema change is **both**: the baseline, for applications created
from now on, and a migration, for the ones that already exist. Either one alone
reaches half the databases.

## Platform Standards & Audit Tooling

Platform standards (§S001–§S012) are defined in [`docs/standards/`](docs/standards/) and enforced across repositories via 1:1 automated audit tooling:

```bash
# Run all platform audits
python -m bedrock.tools.run_all --root .

# Scoped individual audits
python -m bedrock.tools.audit_s001_duplicates --root .
python -m bedrock.tools.audit_s002_grids --root .
python -m bedrock.tools.audit_s003_logging --root .
python -m bedrock.tools.audit_s004_config --root .
python -m bedrock.tools.audit_s005_testing --root .
python -m bedrock.tools.audit_s006_pr_workflow --root .
python -m bedrock.tools.audit_s007_schema_catalog --root .
python -m bedrock.tools.audit_s008_guidance --root .
python -m bedrock.tools.audit_s009_design_tokens --root .
python -m bedrock.tools.audit_s010_security --root .
python -m bedrock.tools.audit_s011_navigation --root .
python -m bedrock.tools.audit_s012_pins --root .
```

Behavior for every audit is declared in `bedrock.toml`, not hardcoded — a
consumer changes exemptions or tunables by editing that file, not platform
code. Exemptions merge additively on top of a fixed platform baseline
(`node_modules/`, `__pycache__/`, `.venv/`).

`scripts/run_qa.py` is the unified pre-commit / pre-PR / pre-merge entry
point, replacing per-command guessing with three fixed tiers:

```bash
python scripts/run_qa.py --mode fast    # delta only — before every commit
python scripts/run_qa.py --mode scoped  # everything touched since master — before a PR
python scripts/run_qa.py --mode full    # entire suite + every platform audit — pre-merge / CI
```

## Deployment

`deploy/` holds the image, compose and nginx templates an application copies,
and `.env.example` is the environment contract. Point every healthcheck at
`/api/v1/health/ready`, which answers 503 when the database is unreachable —
`/health` is a diagnostic report and always answers 200.
[`docs/reference/deployment.md`](docs/reference/deployment.md).

## Verification

```bash
# Backend test suite
pytest packages/bedrock-api/tests/

# Frontend test suite & type checking
npm test
npm run typecheck
npm run build
```

## Consuming it

Both packages move together in lockstep:

```
bedrock-api @ git+https://github.com/djntechnic/bedrock.git@v0.10.0#subdirectory=packages/bedrock-api
```

```json
"@djntechnic/bedrock-ui": "github:djntechnic/bedrock#v0.10.0"
```

Git tags rather than a package registry: real version pinning, dual-pin lockstep governance (§S012), and zero publishing infrastructure.
