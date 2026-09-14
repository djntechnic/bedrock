---
id: S007
title: "Schema Catalog & Database Object Standards"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s007_schema_catalog
cli_command: "python -m bedrock.tools.audit_s007_schema_catalog --root ."
---

# Standard S007: Schema Catalog & Database Object Standards

## Purpose & Objective

A database schema known only by reading migration files in order is a schema
no tool can validate against, and a schema whose object names are chosen
ad hoc is a schema no engineer can navigate by convention alone. S007 is the
platform's single contract for two things at once: the **schema catalog**
(`core/schema_catalog.py`) as the one generated inventory of every table,
column, view, and index — and the **naming, audit-column, and dialect rules**
that every one of those objects must satisfy before it can be catalogued.
Both halves exist so that code, drift detection, and documentation all read
from one source of truth about what the database looks like, instead of each
maintaining its own understanding.

This standard is platform vocabulary only. It defines the shape a table name,
column, or index must take — never what a consumer's tables are called beyond
the reserved platform prefixes below. A consumer's extension-domain tables
follow the same rules under their own `<domain>_` prefix.

## Non-Negotiable Invariants

**Catalog completeness**

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

**Object naming and prefixes**

- Every table name is `<domain>_<entity>[_<qualifier>]` in snake_case, with a
  plural noun for the entity when the table holds a row collection
  (`auth_users`, not `auth_user`).
- Root-level, un-prefixed tables are forbidden for new work. An existing
  un-prefixed table is grandfathered only when it is declared as such in
  `bedrock.toml`.
- Join/junction tables name both sides of the relationship, alphabetically
  (`auth_role_permissions`, never `auth_permission_roles`).
- Views are prefixed `v_`, in noun-first form (`v_auth_users_active`, not
  `v_active_auth_users`).
- Indexes are `idx_<full_table>_<col1>[_<col2>]`; the table portion is never
  abbreviated. Unique indexes are `ux_<table>_<col>`. Partial indexes append
  `_partial`.
- Ephemeral or staging tables end in `_staging`.

**Audit columns**

- Every stateful entity table carries `created_at`, `created_by`,
  `modified_at`, and `modified_by`. A table with no audit trail cannot answer
  "who changed this and when," which is the first question an incident or a
  support ticket asks.
- Foreign keys are named `<referenced_table_singular>_id`
  (`user_id` referencing `auth_users.id`).

**Boolean and lifecycle-state standardization**

- Boolean columns are named `is_*` or `has_*`. A column that encodes a binary
  truth state under any other name (`status`, `flag`, `active`) is a
  violation.
- `is_active` is the sole, universal lifecycle-state column for entity
  visibility, soft-deletion, and activation. Ad hoc aliases (`deleted`,
  `hidden`, `deactivated`, or a `status` value meaning "inactive") are
  forbidden. Soft-deleting or deactivating a row sets `is_active` false; it
  never introduces a parallel flag to mean the same thing.

**Cross-dialect portability**

- All schema DDL and all application queries are syntactically valid on both
  SQLite 3.38+ and PostgreSQL 15+. SQLite is the only currently supported
  deployment engine; the Postgres branch is portability plumbing, not a
  shipped target, and a query that only runs on one of the two dialects is
  not portable regardless of which one is live today.
- Table and column names are strict lowercase snake_case, unquoted, in both
  DDL and queries — this avoids the case-folding mismatch between Postgres
  (folds unquoted identifiers to lowercase) and SQLite (case-preserving).
- Query parameter placeholders go through the platform's query adapter, never
  raw string concatenation or a single dialect's native placeholder syntax
  hand-written inline.

## Object Naming Conventions

### Tables

`<domain>_<entity>[_<qualifier>]`, snake_case, plural entity nouns for row
collections. The domain prefix identifies the functional area that owns the
table; the entity names what a row represents; an optional qualifier narrows
further (`auth_user_sessions` — sessions scoped to `auth_users`).

### Reserved platform prefixes

| Prefix   | Reserved for                                                          |
| -------- | ---------------------------------------------------------------------- |
| `auth_`  | Authentication, users, sessions, roles/permissions (RBAC)              |
| `app_`   | Application-level configuration, layout and preference state          |
| `sys_`   | Schema metadata, system runs, migrations                              |
| `log_`   | System and audit logs                                                 |
| `diag_`  | Diagnostics, automated health-check runs                              |

These five prefixes are platform-owned; a consumer does not add tables under
them. A consumer's own domains — whatever business vocabulary its extension
points serve — take their own `<domain>_` prefix, chosen by the consumer and
disjoint from the reserved list above.

### Views

Prefixed `v_`, noun-first (`v_auth_users_active`, not `v_active_users`). The
view name reads as "the `v_` table of `<noun>`, filtered/shaped by
`<qualifier>`."

### Indexes

- Standard: `idx_<full_table>_<col1>[_<col2>]`. The table segment is the full
  table name, never an abbreviation — `idx_diag_health_runs_status`, not
  `idx_dhr_status`.
- Unique: `ux_<table>_<col>`.
- Partial: append `_partial` to whichever of the two forms above applies.

### Join tables

Name both related tables, alphabetically, pluralized as the join semantics
require (`auth_role_permissions` combines `auth_roles` and `auth_permissions`
in alphabetical order of the entity nouns).

### Staging tables

End in `_staging`. A `_staging` table is transient by contract — it exists to
hold an import or migration in flight, not as a permanent extension of the
schema it stages into.

## Mandatory Audit Columns Contract

Every stateful/entity table defines:

| Column        | Type (SQLite)                     | Type (PostgreSQL)   | Contract                                  |
| ------------- | ---------------------------------- | -------------------- | ------------------------------------------ |
| `created_at`  | `TEXT` (UTC ISO-8601 string)        | `TIMESTAMPTZ`         | Set once, at insert; never mutated.        |
| `created_by`  | `TEXT` / UUID principal identifier  | `TEXT` / UUID         | The principal that created the row.        |
| `modified_at` | `TEXT` (UTC ISO-8601 string)        | `TIMESTAMPTZ`         | Updated on every mutation.                 |
| `modified_by` | `TEXT` / UUID principal identifier  | `TEXT` / UUID         | The principal that performed the mutation. |
| `is_active`   | `INTEGER` (0/1)                     | `BOOLEAN`             | The sole lifecycle/visibility flag.        |

Foreign keys follow `<referenced_table_singular>_id`
(`user_id → auth_users.id`, `role_id → auth_roles.id`).

Application code maps these consistently through the platform's ORM/schema
layer (Pydantic models, SQLAlchemy column types) — a caller never hand-rolls
a boolean-to-integer conversion or an ad hoc timestamp format at the call
site.

## Cross-Dialect Portability Contract

- **Primary keys**: use a portable auto-incrementing form
  (`INTEGER PRIMARY KEY` under SQLite's `rowid` semantics) rather than a
  dialect-locked keyword. Bare `AUTOINCREMENT` and Postgres `SERIAL` /
  `IDENTITY` are not interchangeable — a migration that needs identity
  behavior expresses it through the platform's migration runner, which knows
  how to express the same intent on each dialect, not through a raw
  dialect-specific keyword in a shared `.sql` file.
- **Booleans**: stored as `INTEGER` (0/1) under SQLite and `BOOLEAN` under
  PostgreSQL. The code layer's type mapping (Pydantic/SQLAlchemy) is what
  reconciles the two — a query or model never assumes one representation.
- **Identifiers**: lowercase snake_case, unquoted, everywhere. Quoting an
  identifier to preserve case is itself the bug this rule prevents.
- **Parameters**: queries go through the platform's parameterized query
  adapter. Raw string concatenation of user- or config-supplied values into
  SQL text is forbidden regardless of dialect; a raw dialect-native
  placeholder written by hand in application code bypasses the adapter's
  portability guarantee even when the query works today.

## Single-Source Catalog Architecture

**Python — `core/schema_catalog.py`** is the sole place raw object names
appear as string literals in the backend. It exposes `Tables`, `Views`, and
`Indexes` classes of typed constants, plus `ALL_TABLES` / `ALL_VIEWS` /
`ALL_INDEXES` collections, generated from the live schema:

```python
from bedrock.core.schema_catalog import Tables

def get_setting(key: str):
    return db.query(f"SELECT value FROM {Tables.APP_CONFIG_SETTINGS} WHERE key = ?", key)
```

**Violation — bare literal duplicating the catalog:**

```python
def get_setting(key: str):
    return db.query("SELECT value FROM app_config_settings WHERE key = ?", key)  # bypasses Tables.*
```

**TypeScript — `frontend/src/lib/schemaCatalog.ts`** is the mirror emitted by
the same generator, exposing `Tables`, `Views`, `Indexes` as `as const`
objects and `ALL_TABLES` / `ALL_VIEWS` / `ALL_INDEXES` `ReadonlySet<string>`s.
The frontend talks HTTP, not SQL, so its use of these constants is limited to
identifiers that cross the wire as-is (grid IDs, admin config keys) — but
wherever a table/view/index name needs to appear in TypeScript, it comes from
here, not a retyped string literal.

**Drift check shape:**

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
exemptions = []  # declared table/column names grandfathered out of naming rules
```

- A table introduced purely for local development scratch use (never migrated
  to `schema/migrations/`) is exempt only if declared explicitly — it does
  not inherit an exemption by virtue of being untracked.
- A root-level, un-prefixed table predating this standard is grandfathered
  only by an explicit entry in `exemptions`; the absence of a prefix is never
  self-exempting.
- Migration `.sql` files under `schema/migrations/` are exempt from the
  bare-literal check — they *define* the names and therefore own the literal.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s007_schema_catalog --root .
```

- **Exit 0** — every live schema object has a matching catalog entry with
  agreeing type, nullability, and default; every table/view/index name
  conforms to the naming, prefix, audit-column, and boolean-standardization
  rules above; no bare table-name string literal outside the catalog.
- **Exit 1** — a drift violation, a naming/prefix violation, a missing audit
  column, or an undeclared bare literal was found; the audit reports the
  object and the mismatch.
- **Exit 2** — configuration error (unreachable database, malformed
  `bedrock.toml`).
