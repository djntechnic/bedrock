---
id: S010
title: "Clean Working Tree Enforcement"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s010_clean_tree
cli_command: "python -m bedrock.tools.audit_s010_clean_tree --root ."
---

## Purpose & Objective

An uncommitted file, a tracked sidecar artifact, or a dirty working tree
after a merge is how scratch state leaks into a shared branch and how the
next session inherits confusion about what is actually committed. Zero
uncommitted files after any completed unit of work is a structural
invariant, not a courtesy.

## Non-Negotiable Invariants

- After completing a task, merging a PR, or finishing a session,
  `git status --porcelain` returns **empty**. Zero uncommitted modifications,
  staged changes, or untracked files may remain.
- Runtime sidecars (`*.db-wal`, `*.db-shm`, `*.db-journal`, `.pytest_cache/`,
  `.testmondata*`, `node_modules/`) are never tracked — they are declared in
  `.gitignore`, not cleaned up ad hoc after the fact.
- After merging to `master`, local `master` is synchronized
  (`git pull origin master`) and re-verified clean before the task is
  declared complete.
- A destructive git operation (`reset --hard`, `checkout .` on unstaged work,
  `clean -f`) is never used to "fix" a dirty tree without first confirming
  the discarded content is not in-progress work — `git status` is checked
  before any such command runs.
- Force-pushing requires explicit user authorization every time; prior
  approval never carries over to a later push.

## Architecture & Code Contracts

**Verification sequence, correct:**

```bash
git status --porcelain          # must print nothing
git add docs/standards/s010-clean-working-tree-enforcement.md
git commit -m "docs(standards): add S010"
git status --porcelain          # must print nothing, again, after the commit
```

**Python — audit check shape:**

```python
import subprocess

def audit_clean_tree(repo_root: Path) -> list[str]:
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=repo_root, capture_output=True, text=True, check=True,
    )
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    return lines  # non-empty means violation
```

**Violation:**

```bash
$ git status --porcelain
 M packages/bedrock-ui/src/hooks/useGridConfig.ts
?? scratch/debug_output.json
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s010]
exempt_untracked_globs = [
  "*.local.json",
  ".claude/settings.local.json",
]
```

`exempt_untracked_globs` covers genuinely local, gitignored-by-design files
that a misconfigured `.gitignore` in an older checkout might still surface —
it does not cover anything that should be either committed or deleted.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s010_clean_tree --root .
```

- **Exit 0** — `git status --porcelain` is empty (after exempt-glob
  filtering).
- **Exit 1** — uncommitted, staged, or untracked files remain; the audit
  lists them.
- **Exit 2** — configuration error (not a git repository, malformed
  `bedrock.toml`).
