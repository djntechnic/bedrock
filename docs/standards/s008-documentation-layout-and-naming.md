---
id: S008
title: "Documentation Layout & Naming"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s008_guidance
cli_command: "python -m bedrock.tools.audit_s008_guidance --root ."
---

# Standard S008: Documentation Layout & Naming

## Purpose & Objective

`docs/` accretes overlapping folders unless every document has exactly one
legal home and a mechanical rule for reaching it, and `CLAUDE.md` degrades
every future agent session's effective context budget if it grows without
bound. This standard fixes both: a four-tier taxonomy so a contributor never
has to guess where a document belongs, and a hard line-count cap on the
system-instruction file that is loaded into every session before a single
tool call happens.

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
  directly per the declared `allowed_root_docs` list — it does not force
  itself into one of the four tiers above.
- Markdown filenames under `docs/` are lowercase kebab-case
  (`s001-no-duplicate-ui-code.md`, `platform-guide.md`). `README.md`,
  `CLAUDE.md`, `GEMINI.md`, and `CHANGELOG.md` are the only exceptions, by
  universal convention.
- `CLAUDE.md` and `GEMINI.md` are each capped at **200 lines** (including
  blank lines and frontmatter, excluding a trailing newline). Content that
  would push either file over the cap is moved to a linked `docs/` reference
  and replaced in the instruction file with a one-line pointer.
- The two instruction files are audited independently — splitting the same
  content unevenly across both to dodge the cap is a violation of the
  standard's intent even where each file individually stays under 200 lines.
- Every live document is reachable from at least one of: the docs root
  index, its own folder's index, `CLAUDE.md`, `GEMINI.md`, another live
  document, a shipped skill, a test, or a CI workflow. A document nothing
  links to is treated as already orphaned, not as merely unlisted.
- Retirement removes a document from the working tree rather than leaving it
  in place under a different label — history stays recoverable through git,
  but a retired document does not remain readable by a live agent session
  (an ignore file is advisory per-harness and does not achieve this).
  Retiring a document in the same PR that closes the work it describes
  includes fixing every incoming reference so nothing cites a moving target.

## Architecture & Code Contracts

**Correct placement:**

```
docs/standards/s005-test-coverage-mandatory.md   # non-negotiable contract
docs/specs/2026-09-12-grid-audit-design.md       # design spec, work in flight
docs/plans/2026-09-12-grid-audit-plan.md         # implementation plan
docs/archive/2026-06-01-legacy-auth-plan.md      # retired, work landed
```

**Violation — undeclared folder, unarchived stale plan:**

```
docs/punchlists/20260912-audit-punchlist.md      # fifth folder, not declared
docs/plans/2026-01-01-old-migration-plan.md      # plan for work that shipped, never archived
```

**Correct — CLAUDE.md extraction pattern:**

```markdown
## Release Workflow

Bedrock is **always released before** a consumer bumps its pin. See
[`docs/release-workflow.md`](docs/release-workflow.md) for the full sequence.
```

**Python — combined audit check shape:**

```python
ALLOWED_DOC_FOLDERS = {"standards", "specs", "plans", "archive"}
MAX_INSTRUCTION_LINES = 200

def audit_doc_folders(docs_root: Path) -> list[str]:
    return [
        f"undeclared folder: docs/{entry.name}/"
        for entry in docs_root.iterdir()
        if entry.is_dir() and entry.name not in ALLOWED_DOC_FOLDERS
    ]

def audit_instruction_length(path: Path) -> int | None:
    line_count = len(path.read_text(encoding="utf-8").splitlines())
    return line_count if line_count > MAX_INSTRUCTION_LINES else None
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s008]
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
max_instruction_lines = 200
```

There is no path-level exemption for `CLAUDE.md` or `GEMINI.md` themselves —
`exempt_paths` exists only so a consumer with a third generated instruction
surface (rare) can declare it out of scope with a written rationale in the
PR description.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s008_guidance --root .
```

- **Exit 0** — `docs/` contains only `standards/`, `specs/`, `plans/`,
  `archive/`, declared `allowed_root_docs`, and `README.md`; every closed
  spec/plan has a corresponding archive entry; every tracked `CLAUDE.md` /
  `GEMINI.md` is at or under 200 lines.
- **Exit 1** — an undeclared folder, an unreachable document, or an
  over-length instruction file was found; the audit reports the path and its
  line count where relevant.
- **Exit 2** — configuration error in `bedrock.toml`.
