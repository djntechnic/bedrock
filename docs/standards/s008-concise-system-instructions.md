---
id: S008
title: "Concise System Instructions"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s008_instruction_length
cli_command: "python -m bedrock.tools.audit_s008_instruction_length --root ."
---

## Purpose & Objective

`CLAUDE.md` and `GEMINI.md` are loaded into every agent session's context
window before a single tool call happens. A file that grows without bound
degrades every future session's effective context budget, not just the
session that added the content. Capping the file forces genuinely durable
information into `docs/` (reference, standards) and keeps the instruction
file itself a table of contents, not an encyclopedia.

## Non-Negotiable Invariants

- `CLAUDE.md` and `GEMINI.md` are each capped at **200 lines** (including
  blank lines and frontmatter, excluding a trailing newline).
- Content that would push the file over the cap is moved to a linked
  `docs/` reference (`docs/platform_guide.md`, a new `docs/standards/` entry,
  etc.) and replaced in the instruction file with a one-line pointer.
- A PR that adds to `CLAUDE.md` or `GEMINI.md` and pushes either file over 200
  lines is not mergeable until the overflow is extracted.
- The two files are audited independently — a consumer with both is not
  permitted to split content unevenly to dodge the cap (e.g. duplicating the
  same 250 lines across both, each individually under 200, is still a
  violation of the standard's intent and is treated as such in review even
  though the line-count audit is mechanical).

## Architecture & Code Contracts

**Correct — extraction pattern:**

```markdown
## Release Workflow

Bedrock is **always released before** a consumer bumps its pin. See
[`docs/release-workflow.md`](docs/release-workflow.md) for the full sequence.
```

**Violation — inline sprawl that should be a linked doc:**

```markdown
## Release Workflow

<40 lines of step-by-step release mechanics that belong in docs/release-workflow.md,
duplicated inline instead of linked>
```

**Python — audit check shape:**

```python
MAX_INSTRUCTION_LINES = 200

def audit_instruction_length(path: Path) -> int | None:
    line_count = len(path.read_text(encoding="utf-8").splitlines())
    return line_count if line_count > MAX_INSTRUCTION_LINES else None
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s008]
exempt_paths = []
max_lines = 200
```

There is no path-level exemption for `CLAUDE.md` or `GEMINI.md` themselves —
`exempt_paths` exists only so a consumer with a third generated instruction
surface (rare) can declare it out of scope with a written rationale in the
PR description.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s008_instruction_length --root .
```

- **Exit 0** — every tracked `CLAUDE.md` / `GEMINI.md` is at or under 200
  lines.
- **Exit 1** — a file exceeds the cap; the audit reports the file and its
  line count.
- **Exit 2** — configuration error in `bedrock.toml`.
