---
id: S006
title: "Defect Isolation & PR Workflow"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s006_pr_workflow
cli_command: "python -m bedrock.tools.audit_s006_pr_workflow --root ."
---

# Standard S006: Defect Isolation & PR Workflow

## Purpose & Objective

A defect fixed without a reproduction test is a defect that comes back the
first time the surrounding code moves. A branch that mixes an unrelated
refactor into a bug-fix diff makes the fix unreviewable in isolation and the
revert (if the fix is wrong) collateral damage to everything bundled with it.
This standard makes reproduce-then-fix and one-branch-one-concern the
mechanically enforced shape of every change, so a reviewer — human or
automated — can evaluate a PR's diff against a single, stated defect.

## Non-Negotiable Invariants

- Every bug fix ships with a test that fails against the pre-fix code and
  passes against the post-fix code. A fix with no reproduction test is
  presumed unverified, not presumed correct.
- A branch addresses exactly one concern: one defect, one feature, or one
  refactor. A PR diff that mixes an unrelated formatting pass, dependency
  bump, or drive-by refactor into a bug-fix branch is split before merge.
- A failing test is never merged around. It is investigated and classified:
  **Class A** (minor regression) is fixed inline in the same PR; **Class B**
  (architectural blocker) halts the branch and is escalated and filed rather
  than bypassed.
- A PR description states the defect or requirement being addressed, the
  root cause (for a bug fix), and the verification command run — not a
  restatement of the diff.
- Every PR target branch and merge strategy is declared once per repository
  (e.g. `master`, squash-merge) and is not overridden ad hoc per PR without a
  stated reason.
- CI must pass — all configured checks green — before merge. A red or
  pending check is never overridden to land a PR faster.
- A defect is not filed until its root cause is investigated: the exact
  origin point (file and line where invalid state first arises), the data
  flow traced backward across every architectural layer boundary it crosses,
  and a minimal, source-level fix hypothesis are all recorded before the
  issue is opened. An issue that states only the observed symptom, with no
  origin trace, sends the next engineer to redo the investigation from
  scratch before they can even start the fix.
- Work items are filed under a declared, closed taxonomy of issue types
  (e.g. defect, out-of-scope observation, feature/enhancement task, and any
  domain-specific extension the consumer declares) — a free-form or
  untyped issue is not a substitute for classification. An "out-of-scope"
  classification is reserved for a non-failing observational discovery; it
  can never excuse or bypass a currently failing test.
- High-overhead, rate-limited, or external-network-dependent test paths are
  never wired into the per-PR blocking gate — they run on a background or
  post-merge schedule so an external service's rate limit cannot break every
  contributor's PR.
- CI execution is scoped to the layers a diff actually touches (a
  path-filtered `changes` gate), so a change confined to one layer does not
  block on, or wait for, an unrelated layer's suite.

## Architecture & Code Contracts

**Correct — reproduction test precedes the fix, same PR:**

```python
# packages/bedrock-api/tests/test_grid_service.py
def test_grid_column_width_persists_after_reload():
    # Reproduces the reported defect: width reset to default on reload.
    grid_service.update_column(column_id=1, width=240)
    reloaded = grid_service.get_column(column_id=1)
    assert reloaded.width == 240  # was failing before the fix in grid_service.py
```

**Violation — fix with no accompanying test:**

```python
# grid_service.py changed to persist width; no test added anywhere in the diff.
```

**Violation — unrelated concerns bundled in one branch:**

```
fix/grid-width-reset
  - fix: persist column width on reload
  - chore: reformat entire services/ directory
  - chore: bump fastapi to 0.115
```

**Python — audit check shape:**

```python
def audit_bugfix_has_test(diff_files: list[str], commit_message: str) -> bool:
    is_fix = commit_message.lower().startswith(("fix:", "fix("))
    touches_test = any("test_" in f or f.endswith("_test.py") for f in diff_files)
    return not is_fix or touches_test
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s006]
exempt_paths = [
  "docs/**",           # documentation-only changes carry no reproduction test
  "scripts/**",
]
```

A fix that genuinely cannot be reproduced in an automated test (e.g. a fix to
CI infrastructure itself) is exempted per-PR with a written rationale in the
PR description — an unexplained exemption fails review even where the audit
does not flag it mechanically.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s006_pr_workflow --root .
```

- **Exit 0** — every fix-classified commit's diff touches a test file; no PR
  in the audited range mixes an unrelated concern into a bug-fix branch.
- **Exit 1** — a fix commit with no paired test, or a diff spanning multiple
  declared concerns, was found; the audit reports the commit and the rule
  broken.
- **Exit 2** — configuration error in `bedrock.toml`.
