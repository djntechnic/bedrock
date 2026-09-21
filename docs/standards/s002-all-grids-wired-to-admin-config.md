---
id: S002
title: "All Grids Wired to Admin Config"
status: active
tier: platform
enforced_by: bedrock.tools.s002_audit_grids
cli_command: "python scripts/audit/s002_audit_grids.py --root ."
---

# Standard S002: All Grids Wired to Admin Config

## Purpose & Objective

Every tabular surface across bedrock consumers renders through one engine —
`<DataGrid>` backed by `useGridConfig(gridId)` — so that a grid feature (column
persistence, gradients, sort colors, density) ships once in bedrock and is
immediately available everywhere, and so that an admin editing grid config in
the Grid Editor sees the change reflected without a code deploy. A grid that
reads its own hardcoded defaults instead of `config.*` breaks that promise
invisibly: it looks wired until someone touches the admin config and nothing
happens.

## Non-Negotiable Invariants

- Every grid component calls `useGridConfig(gridId)` and applies **every**
  config property it returns. No hardcoded defaults standing in for a config
  field, no React prop reintroducing behavior the config already owns.
- The **seven-layer contract** stays synchronized for every grid field: DB
  schema → migrations → Pydantic/schema layer → API GET/PATCH routes →
  TypeScript interface → runtime mapping (`buildGridConfig`) → display
  component and admin Grid Editor. A field wired on one layer and silently
  dropped on another is a defect, not a partial feature.
- UI views never import a data-fetching client directly; grid data flows
  through a domain hook that consumes a centralized query-key factory. No
  inline query-key strings.
- Selection columns, rank/podium highlighting, and other structural columns
  are config-driven (`allow_selection`, `show_rank_highlight`), never a
  component prop.
- Sort/gradient color resolution follows a fixed precedence:
  `column.sort_color ?? grid.sort_color ?? null`. No component may special-case
  this order.
- Tooltip delays, hover colors, and other runtime-tunable values resolve from
  `config.*` with a documented fallback — never a literal number inline.
- Every `app_grid_settings` row declares a non-empty `page` attribute so the
  admin Grid Editor can group it under a screen. A grid with a missing or
  empty `page` is unreachable from the admin navigation, not just untidy.
- Every `app_grid_settings` row declares a non-null, non-empty
  `row_key_column` that matches an actual `column_id` inserted for that grid
  in `app_grid_column_settings`. A `row_key_column` that is null or points at
  a column the grid never registers breaks row selection and bulk-edit at
  runtime (see `DataGrid.tsx`'s own `config.rowKeyColumn` invariant).
- Every grid has at least one live API endpoint wired into the Admin Grid
  Preview pane via `registerApiPreviewEndpoints`. A grid with no registered
  binding, or a binding registered with an empty endpoint array, is an
  orphaned preview config — the editor renders the grid with nothing to
  preview.

## Architecture & Code Contracts

**TypeScript/React — correct:**

```tsx
import { DataGrid, useGridConfig } from "@djntechnic/bedrock-ui";

export function ExampleGrid() {
  const config = useGridConfig("example_grid");
  if (!config.isLoaded) return null;
  return <DataGrid gridId="example_grid" />;
}
```

**TypeScript/React — violation:**

```tsx
// Hardcodes what config.pageSizeOptions already owns.
<DataGrid gridId="example_grid" pageSizeOptions={[10, 25, 50]} />
```

**Python — GET/PATCH route pair for a grid-config field must stay in step:**

```python
class GridColumnSettingUpdate(BaseModel):
    label_override: str | None = None
    width: int | None = None
    gradient_from_color: str | None = None
    gradient_to_color: str | None = None

@router.patch("/admin/grid-columns/{column_id}")
def update_grid_column(column_id: int, body: GridColumnSettingUpdate):
    return grid_service.update_column(column_id, body)
```

Adding `gradient_from_color` here without the matching TypeScript interface
field and `buildGridConfig` mapping is a seven-layer contract break — the
audit's grid-diff mode flags exactly this shape of drift.

**`page`, `row_key_column`, and the Preview API binding contract:**

```ts
// Runtime shape of an app_grid_settings row, as consumed by the Grid Editor.
interface GridSettings {
  gridId: string;
  gridLabel: string;
  page: string;              // non-empty; groups the grid under an admin screen
  rowKeyColumn: string;      // non-empty; must match a registered column_id
}

// Migration-seeded; every grid_id inserted here must also appear as a key in
// a registerApiPreviewEndpoints({ ... }) call somewhere in the consumer app.
interface ApiEndpointBinding {
  id: string;
  label: string;
  path: string;
  method: "GET";
  responsePath?: string;
  params?: string[];
}

registerApiPreviewEndpoints({
  example_grid: [
    { id: "default", label: "Example", path: "/api/example", method: "GET", params: [] },
  ],
});
```

A grid seeded via `INSERT INTO app_grid_settings (...)` with an empty `page`,
a `row_key_column` that doesn't match any `INSERT INTO app_grid_column_settings`
`column_id`, or no corresponding `registerApiPreviewEndpoints` entry is a
violation the audit reports with the offending migration file and line.

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s002]
exempt_grids = [
  "diagnostics_raw_export",   # read-only debug surface, not an admin-configured grid
]
exempt_paths = [
  "packages/bedrock-ui/src/components/grids/DataGrid.tsx",  # the engine itself
]
```

`exempt_grids` entries must correspond to a `PRESENTATIONAL_TABLES` /
`GRID_PRIMITIVE_ALLOWED` allowlist entry with a written rationale — an
exemption with no matching rationale is a configuration error.

## Verification & Enforcement Gate

```bash
python scripts/audit/s002_audit_grids.py --root . --diff
```

- **Exit 0** — every grid's seven layers agree; no config field is read as a
  hardcoded default; no unauthorized `useReactTable` call site.
- **Exit 1** — a layer mismatch, hardcoded default, or unwired config field was
  found; the audit reports the grid ID and the layer where drift occurred.
- **Exit 2** — configuration error (unresolvable `exempt_grids` entry,
  malformed `bedrock.toml`).
