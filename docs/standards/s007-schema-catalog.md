---
id: S007
title: "Schema Catalog"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s007_schema_catalog
cli_command: "python -m bedrock.tools.audit_s007_schema_catalog --root ."
---

# Standard S007: Schema Catalog

## Purpose & Objective

A database schema known only by reading migration files in order is a schema
no tool can validate against. Bedrock's schema catalog (`core/schema_catalog.py`)
is the single generated inventory of every table, column, and index — the
one place code, drift detection, and documentation all read from, instead of
each maintaining its own understanding of what the database looks like.

## Non-Negotiable Invariants

- Every table, column, view, and index that exists in `schema/baseline.sql`
  or a migration under `schema/migrations/` is represented in the schema
  catalog. A schema object with no catalog entry is undetectable drift by
  construction.
- The schema catalog is generated from the live schema, not hand-maintained
  prose — a catalog entry that disagrees with the database it describes is a
  generation bug, not a documentation lag to tolerate.
- A migration that adds, renames, or drops a schema object regenerates the
  catalog in the same PR. A migration merged without a catalog update is an
  incomplete migration.
- Application code that needs a table or column name references the catalog's
  typed constants (e.g. `Tables.APP_CONFIG_SETTINGS`), never a bare string
  literal duplicating what the catalog already names.
- Schema drift detection (`schema_drift.py`) runs against the catalog, not
  against a separate hardcoded expectation — one source of truth for "what
  should the schema look like" and one for "what does it actually look like."
- A column's type, nullability, and default recorded in the catalog match the
  live database exactly; a mismatch is a drift violation, not a rounding
  error.

## Architecture & Code Contracts

**Python — correct, catalog-driven table reference:**

```python
from bedrock.core.schema_catalog import Tables

def get_setting(key: str):
    return db.query(f"SELECT value FROM {Tables.APP_CONFIG_SETTINGS} WHERE key = ?", key)
```

**Python — violation, bare literal duplicating the catalog:**

```python
def get_setting(key: str):
    return db.query("SELECT value FROM app_config_settings WHERE key = ?", key)  # bypasses Tables.*
```

**Python — drift check shape:**

```python
def audit_schema_drift(catalog: SchemaCatalog, live_db: Connection) -> list[str]:
    violations = []
    for table in catalog.tables:
        live_columns = introspect_columns(live_db, table.name)
        if live_columns != table.expected_columns:
            violations.append(f"{table.name}: catalog and live schema disagree")
    return violations
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s007]
exempt_paths = [
  "packages/bedrock-api/bedrock/core/schema_catalog.py",  # the catalog generator itself
  "schema/seed.sql",                                       # seed data, not schema definition
]
```

A table introduced purely for local development scratch use (never migrated
to `schema/migrations/`) is exempt only if declared explicitly — it does not
inherit an exemption by virtue of being untracked.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s007_schema_catalog --root .
```

- **Exit 0** — every live schema object has a matching catalog entry with
  agreeing type, nullability, and default; no bare table-name string literal
  outside the catalog.
- **Exit 1** — a drift violation or an undeclared bare literal was found; the
  audit reports the table/column and the mismatch.
- **Exit 2** — configuration error (unreachable database, malformed
  `bedrock.toml`).
