# bedrock

A reusable full-stack application platform, extracted from MLBTracker.

Provides a config-driven grid backend, JWT auth with roles and per-user module
gating, DB-backed application config, a schema catalog with boot-time drift
detection, a versioned migration runner, and the admin surfaces that drive all
of it.

## Packages

| Package | Status |
| --- | --- |
| `packages/bedrock-api` | v0.1.1 — 30 modules, 53 endpoints, imports and mounts standalone |
| `packages/bedrock-ui` | v0.1.1 — grid engine, Grid Editor, auth, shell, ships TS source |

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
| `core.migrations.APP_MIGRATION_MODULE` | inline schema migrations |

Providers are declared with `core.providers.ProviderRegistry`.

| Provider | Config key | Ships with |
| --- | --- | --- |
| `mail.provider.mail` | `mail_provider` | `smtp`, `console`, `null` |

Media storage and error reporting are next. Mail is documented in
[`docs/mail.md`](docs/mail.md): invitation, password reset and email
verification, all of which degrade to a logged no-op when nothing is
configured.

Every extension point degrades sensibly when nothing is registered, so a
brand-new application boots before it has any data. That property is what makes
the package genuinely reusable rather than MLBTracker with the names filed off
— and it is verified, not assumed.

Full contract, including which kind to reach for and why the failure policy
differs per registry: [`docs/extension_points.md`](docs/extension_points.md).

## Schema

`packages/bedrock-api/bedrock/schema/` holds `baseline.sql` (the platform's
tables, applied by a new application before its own migrations), `seed.sql`
(the reference rows auth cannot work without), and `migrations/` — the
platform's own versioned migrations, applied by the runner ahead of the
application's.

A platform schema change is **both**: the baseline, for applications created
from now on, and a migration, for the ones that already exist. Either one alone
reaches half the databases.

## Verification

```bash
cd packages/bedrock-api
python -c "import bedrock.routes.admin_platform"   # no MLBTracker on the path
```

## Consuming it

```
bedrock-api @ git+https://github.com/djntechnic/bedrock@v0.1.1#subdirectory=packages/bedrock-api
```

```json
"@djntechnic/bedrock-ui": "github:djntechnic/bedrock#v0.1.1"
```

Git tags rather than a package registry: real version pinning, no publishing
infrastructure.
