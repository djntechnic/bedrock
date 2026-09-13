---
id: S001
title: "No Duplicate UI Code"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s001_duplicates
cli_command: "python -m bedrock.tools.audit_s001_duplicates --root ."
---

## Purpose & Objective

`@djntechnic/bedrock-ui` exists so `MLBTracker` and `CollectIt` share one grid
engine, one component library, and one admin shell. A local twin of a platform
export — a second `useReactTable(` call site, a hand-rolled `cn()`, a
re-implemented query-key factory — silently opts that one call site out of
every future bedrock fix. This standard makes "does bedrock already export
this?" the first question, not an afterthought, and gives the audit a
deterministic signal to block on when the answer was ignored.

## Non-Negotiable Invariants

- If `@djntechnic/bedrock-ui`'s barrel (`packages/bedrock-ui/src/index.ts`)
  exports it, a consumer imports it. No local component, hook, renderer,
  query-key builder, route map, or HTTP client duplicates a platform export.
- `useReactTable(` appears in exactly one place platform-wide: `DataGrid.tsx`.
  A consumer grid renders `<DataGrid gridId="…" />`; it does not call
  `useReactTable` directly unless it is on a documented
  `GRID_PRIMITIVE_ALLOWED` exception list with a written rationale.
- One `queryKeys` factory, one `API_ROUTES` map, one HTTP client export per
  consumer app. A second one alongside bedrock's is a defect, not a
  style choice.
- Formatters, date/number utilities, and design tokens are consumed from
  `@djntechnic/bedrock-ui` / the consumer's `lib/formatters` — never re-typed
  inline in a component.
- A deliberate fork is legitimate exactly once: it declares `@shadows <Name>`
  in the file header with the reason, making a reasoned fork and an accident
  stop looking alike to both a reviewer and the audit.

## Architecture & Code Contracts

**TypeScript/React — correct:**

```tsx
import { DataGrid } from "@djntechnic/bedrock-ui";
import { cn } from "@djntechnic/bedrock-ui";

export function InventoryGrid() {
  return <DataGrid gridId="inventory_grid" className={cn("h-full")} />;
}
```

**TypeScript/React — violation:**

```tsx
// Second useReactTable call site outside DataGrid.tsx — blocked by the audit.
import { useReactTable, getCoreRowModel } from "@tanstack/react-table";

export function InventoryGrid() {
  const table = useReactTable({ columns, data, getCoreRowModel: getCoreRowModel() });
  // ...
}
```

**Python — the same rule applies to shared service/client code:**

```python
# Correct: import the platform HTTP/service client rather than re-instantiating one.
from bedrock.core.database import db

def get_setting(key: str, default=None):
    return db.get_config(key, default)
```

```python
# Violation: a second ad-hoc DB/config accessor duplicating bedrock's provider.
import sqlite3

def get_setting(key: str, default=None):
    conn = sqlite3.connect("app.db")  # bypasses the platform config surface
    ...
```

## Exceptions & Audit Exemptions

Exceptions are declared in the consumer's `bedrock.toml`:

```toml
[tool.bedrock.audit.s001]
exempt_paths = [
  "scripts/**",          # one-off maintenance scripts are not shipped UI
]
allowed_primitives = [
  "frontend/src/components/admin/LegacyReportTable.tsx",  # @shadows DataGrid — see file header
]
```

Every entry in `allowed_primitives` must correspond to a file carrying an
`@shadows <Name>` header comment stating the reason. An exemption without a
matching header fails the audit as a configuration error, not a pass.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s001_duplicates --root .
```

- **Exit 0** — no duplicate `useReactTable` call sites, no shadowed exports
  outside the allowlist, no second `queryKeys`/`API_ROUTES`/HTTP client.
- **Exit 1** — a violation was found; the audit prints the offending file and
  line.
- **Exit 2** — configuration error (e.g. an `allowed_primitives` entry with no
  matching `@shadows` header, or a malformed `bedrock.toml`).
