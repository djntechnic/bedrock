# bedrock

A reusable full-stack application platform, extracted from MLBTracker.

Provides a config-driven grid backend, JWT auth with roles and per-user module
gating, DB-backed application config, a schema catalog with boot-time drift
detection, a versioned migration runner, and the admin surfaces that drive all
of it.

## Packages

| Package | Status |
| --- | --- |
| `packages/bedrock-api` | v0.1.0 — 30 modules, 53 endpoints, imports and mounts standalone |
| `packages/bedrock-ui` | not yet extracted |

## The contract

bedrock holds no business domain. Where it needs application knowledge it
exposes an extension point and the host app registers an implementation:

| Extension point | Supplies |
| --- | --- |
| `core.config_constants.APP_CATEGORY_MODULE` | app config categories |
| `core.app_config_sections.register_app_config_section` | boot-payload sections |
| `core.health_metrics.register_health_counter` | health endpoint counts |
| `core.db_health.register_canonical_tables` | tables whose emptiness means a wiped DB |
| `core.database.register_current_season_resolver` | the app's current period |
| `core.migrations.APP_MIGRATION_MODULE` | inline schema migrations |

Every one degrades sensibly when nothing is registered, so a brand-new
application boots before it has any data. That property is what makes the
package genuinely reusable rather than MLBTracker with the names filed off —
and it is verified, not assumed.

## Verification

```bash
cd packages/bedrock-api
python -c "import bedrock.routes.admin_platform"   # no MLBTracker on the path
```

## Consuming it

```
bedrock-api @ git+https://github.com/djntechnic/bedrock@v0.1.0#subdirectory=packages/bedrock-api
```

Git tags rather than a package registry: real version pinning, no publishing
infrastructure.
