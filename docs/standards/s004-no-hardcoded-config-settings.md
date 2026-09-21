---
id: S004
title: "No Hardcoded Config Settings"
status: active
tier: platform
enforced_by: bedrock.tools.s004_audit_config
cli_command: "python scripts/audit/s004_audit_config.py --root ."
---

# Standard S004: No Hardcoded Config Settings

## Purpose & Objective

Configuration scattered across `os.environ` reads, hardcoded literals, and
per-module defaults cannot be audited, cannot be changed without a deploy, and
diverges silently between environments. Bedrock's `core/config.py` /
`app_config_sections.py` surface is the single place a setting is declared,
typed, and defaulted — every reader and writer goes through it.

## Non-Negotiable Invariants

- Configuration values are read through `db.get_config(key, default)` /
  written through `db.set_config(key, value)` (or the equivalent typed
  `BaseSettings` accessor for boot-time settings) — never a raw `os.environ`
  read scattered through application code.
- Every `get_config` call site supplies a default matching the expected type.
  A missing default is a defect: it makes the read's failure mode
  environment-dependent instead of deterministic.
- Values that are inherently dynamic (a "current" season, a "current" cycle,
  an active tenant) are resolved through a dedicated accessor
  (`get_current_season()`-shaped), never hardcoded as a literal or read from a
  stale cached config key.
- `set_config` invalidates the in-memory cache for that key in the same call —
  a writer that bypasses `set_config` and updates the table directly leaves
  stale reads in every other process.
- A new third-party import on the runtime/data-pipeline/test-collection path
  is declared in the package manifest (`requirements.txt` / `pyproject.toml`)
  in the same PR that introduces it, including transitive parsing engines
  (e.g. `openpyxl` for `pandas.read_excel`). The manifest is proven against a
  fresh, isolated checkout (`python -m venv` + install from the manifest
  alone), not against a developer's locally accumulated environment, because
  a local environment can carry transitively-installed packages invisible to
  a clean container.
- Stored config values are untyped strings at the persistence layer; the
  accessor coerces each read to its expected type (integer, float, boolean,
  falling back to string) from a single coercion routine — a call site never
  parses or casts a raw config string itself.
- Frontend runtime settings (tooltip delays, feature toggles, shortcut
  bindings, and similar UI-tunable values) are declared once as a typed key
  map and resolved through a single settings hook that merges, in order: a
  boot-time env-var/literal default (pre-hydration fallback), then the
  database-backed admin config value once it resolves. A component reads the
  hook's resolved value — it never hardcodes the literal inline or reaches
  into the env var directly.
- Every config key a consumer can read or write is enumerated in one typed
  key registry (a key-name map or enum), not scattered as inline string
  literals at each call site — the registry is what an admin config editor
  and the audit both walk to know the full settings surface.

## Architecture & Code Contracts

**Python — correct:**

```python
from bedrock.core.database import db

live_cycle = db.get_config("live_cycle", 2026)
watch_enabled = db.get_config("feature_flag_enabled", False)

db.set_config("live_cycle", 2027)  # invalidates the cache internally
```

**Python — violation:**

```python
import os

live_cycle = int(os.environ.get("LIVE_CYCLE", "2026"))  # bypasses the config surface
```

**Python — dynamic "current" value, correct:**

```python
from bedrock.core.database import db

current = db.get_current_season()  # never a hardcoded year, never a raw config key
```

A "current"-shaped accessor resolves through a fallback chain, cached in
memory and explicitly invalidated on write — never re-derived inline at each
call site: (1) the record in the owning table explicitly flagged current,
(2) the maximum/most-recent record if none is flagged, (3) a deterministic
runtime fallback (e.g. the calendar year) if the table itself is empty or the
query fails. A writer that changes which record is current must invalidate
this cache explicitly, the same way `set_config` invalidates its own cache.

**TypeScript — frontend runtime setting, correct:**

```typescript
const { grid } = useAppSettings();          // merges boot default -> DB-backed value
const delay = grid.tooltipDelayDuration;     // never a literal 150 inlined in the component
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s004]
exempt_paths = [
  "packages/bedrock-api/bedrock/core/config.py",  # the config surface itself
  "deploy/**",                                    # container/env bootstrap, not application code
]
```

`deploy/**` is exempted because container entrypoints necessarily read
`os.environ` to seed the process before the config surface exists —
application code reached after boot is never exempt.

## Verification & Enforcement Gate

```bash
python scripts/audit/s004_audit_config.py --root .
```

- **Exit 0** — no raw `os.environ` reads outside `exempt_paths`, no
  `get_config` call missing a default, no undeclared third-party import on the
  runtime path.
- **Exit 1** — a violation was found; the audit reports the file, line, and
  the specific rule broken.
- **Exit 2** — configuration error (malformed `bedrock.toml`, unresolvable
  exempt path).
