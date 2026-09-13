---
id: S006
title: "Naming & Casing Conventions"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s006_naming
cli_command: "python -m bedrock.tools.audit_s006_naming --root ."
---

## Purpose & Objective

A codebase spanning two languages and two packages needs one predictable
casing rule per surface, so a contributor (or an agent) can predict a file's
or symbol's name without checking a neighbor first. Mixed conventions —
`camelCase.py`, `snake_case.tsx`, `PascalCase.md` — cost a lookup every time
and make a rename harder to grep for.

## Non-Negotiable Invariants

- **Markdown docs** (`docs/**/*.md`): lowercase kebab-case
  (`s001-no-duplicate-ui-code.md`, `platform-guide.md`). `README.md`,
  `CLAUDE.md`, `GEMINI.md`, and `CHANGELOG.md` are the only exceptions,
  by universal convention.
- **Python** (`packages/bedrock-api/**/*.py`): `snake_case` for modules,
  functions, and variables; `PascalCase` for classes; `UPPER_SNAKE_CASE` for
  module-level constants.
- **TypeScript/React** (`packages/bedrock-ui/**/*.ts(x)`): `camelCase` for
  functions, hooks, and variables; `PascalCase` for components, types, and
  interfaces; file names match the primary export's casing
  (`DataGrid.tsx` exports `DataGrid`, `useGridConfig.ts` exports
  `useGridConfig`).
- **Database objects**: `snake_case`, domain-prefixed
  (`<domain>_<entity>[_<qualifier>]`), plural for row collections. Views are
  prefixed `v_`; indexes `idx_<full_table>_<col>`; unique indexes
  `ux_<table>_<col>`. No abbreviated table portions, no numeric suffixes for
  versioning — migrations own that.
- **Two-stage rename on case-insensitive filesystems**: a rename that only
  changes case (`Foo.tsx` → `foo.tsx`) stages through an intermediate path
  (`git mv Foo.tsx Foo.tsx__tmp && git mv Foo.tsx__tmp foo.tsx`) so Windows
  NTFS does not silently no-op the rename.

## Architecture & Code Contracts

**Python — correct:**

```python
# packages/bedrock-api/bedrock/core/schema_catalog.py
class Tables:
    APP_CONFIG_SETTINGS: Final = "app_config_settings"

MAX_CACHE_TTL_SECONDS: Final = 300

def get_current_season() -> int: ...
```

**TypeScript — correct:**

```tsx
// packages/bedrock-ui/src/hooks/useGridConfig.ts
export function useGridConfig(gridId: string): GridConfig { ... }
```

```tsx
// packages/bedrock-ui/src/components/grids/DataGrid.tsx
export function DataGrid({ gridId }: DataGridProps) { ... }
```

**Violation:**

```
docs/standards/S001_No_Duplicate_UI_Code.md   # wrong: screaming-snake, not kebab-case
frontend/src/hooks/UseGridConfig.ts            # wrong: PascalCase file for a hook export
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s006]
exempt_paths = [
  "CHANGELOG.md",
  "docs/standards/README.md",  # index file, universal convention
]
```

Vendored or generated files (e.g. a schema-catalog TypeScript mirror emitted
by a generator script) are exempt only if declared explicitly — generation
determinism does not itself grant an exemption.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s006_naming --root .
```

- **Exit 0** — every markdown file under `docs/` is lowercase kebab-case
  (or a declared exception), every Python module/class/constant follows its
  casing rule, every TypeScript file's casing matches its primary export.
- **Exit 1** — a violation was found; the audit reports the path and the rule
  it breaks.
- **Exit 2** — configuration error in `bedrock.toml`.
