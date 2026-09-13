---
id: S007
title: "Four-Tier Documentation Taxonomy"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s007_taxonomy
cli_command: "python -m bedrock.tools.audit_s007_taxonomy --root ."
---

## Purpose & Objective

`docs/` accretes overlapping folders (`punchlists/`, `project/`, `archive/`,
`working files/`) unless every document has exactly one legal home and a
mechanical rule for reaching it. This standard fixes the taxonomy at four
tiers so a contributor — or an agentic worker producing a plan, a spec, or a
retired doc — never has to guess where a file belongs.

## Non-Negotiable Invariants

- Every long-form document under `docs/` lives in exactly one of four
  folders:
  - **`docs/standards/`** — non-negotiable engineering contracts (this file's
    own folder). Never retired; amended in place.
  - **`docs/specs/`** — design specifications for work in flight, written by
    the brainstorming/planning workflow before implementation starts.
  - **`docs/plans/`** — step-by-step implementation plans consumed by
    executing-plans / subagent-driven-development workflows.
  - **`docs/archive/`** — retired specs and plans whose work has landed or
    been abandoned. A doc moves here instead of being deleted so historical
    intent stays recoverable, but it is no longer a live reference.
- There is no fifth folder. Adding one means amending this standard's table
  in the same PR.
- A spec or plan document is retired to `docs/archive/` in the same PR that
  closes the work it describes — it is not left in `docs/specs/` or
  `docs/plans/` to rot.
- Reference material that is not a standard, spec, or plan (operator guides,
  architecture references, deployment docs) lives at `docs/<topic>.md`
  directly, per the existing bedrock layout (`docs/platform_guide.md`,
  `docs/deployment.md`, `docs/media.md`) — it does not force itself into one
  of the four tiers above.
- Every live document is reachable from `CLAUDE.md`, another live doc, or a
  folder's own index — an unreachable document is evicted, not left in place.

## Architecture & Code Contracts

**Correct placement:**

```
docs/standards/s005-zero-broken-tests.md      # non-negotiable contract
docs/specs/2026-09-12-grid-audit-design.md    # design spec, work in flight
docs/plans/2026-09-12-grid-audit-plan.md      # implementation plan
docs/archive/2026-06-01-legacy-auth-plan.md   # retired, work landed
```

**Violation:**

```
docs/punchlists/20260912_GridAuditPunchlist.md   # fifth folder, not declared
docs/plans/2026-01-01-old-migration-plan.md      # plan for work that shipped 8 months ago, never archived
```

**Python — audit check shape:**

```python
ALLOWED_DOC_FOLDERS = {"standards", "specs", "plans", "archive"}

def audit_doc_folders(docs_root: Path) -> list[str]:
    violations = []
    for entry in docs_root.iterdir():
        if entry.is_dir() and entry.name not in ALLOWED_DOC_FOLDERS:
            violations.append(f"undeclared folder: docs/{entry.name}/")
    return violations
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s007]
exempt_paths = [
  "docs/README.md",
]
allowed_root_docs = [
  "platform_guide.md",
  "extension_points.md",
  "deployment.md",
  "media.md",
  "mail.md",
  "pagination.md",
  "seo.md",
]
```

`allowed_root_docs` enumerates the topic references that legitimately live at
`docs/<topic>.md` rather than under one of the four tiers — an undeclared
root-level file fails the audit as an undeclared-location violation, not a
silent pass.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s007_taxonomy --root .
```

- **Exit 0** — `docs/` contains only `standards/`, `specs/`, `plans/`,
  `archive/`, declared `allowed_root_docs`, and `README.md`; every closed
  spec/plan has a corresponding archive entry.
- **Exit 1** — an undeclared folder or unreachable document was found; the
  audit reports the path.
- **Exit 2** — configuration error in `bedrock.toml`.
