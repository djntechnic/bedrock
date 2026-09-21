---
id: S006
title: "SDLC & PR Workflow"
status: active
tier: platform
enforced_by: bedrock.tools.s006_audit_pr_workflow
cli_command: "python scripts/audit/s006_audit_pr_workflow.py --root ."
---

# Standard S006: SDLC & PR Workflow

## Purpose & Objective

A defect fixed without a reproduction test is a defect that returns when the surrounding code moves. A pull request that mixes unrelated chores, refactors, or formatting into a bug-fix diff makes the change unreviewable in isolation and turns any necessary revert into collateral damage. 

Standard S006 governs the code modification lifecycle from initial branch cut to post-merge master alignment across Bedrock and all consumer repositories. It establishes mechanically enforced rules for feature branching, atomic concerns, test-driven defect reproduction, draft PR creation, background CI gating, and post-merge working tree verification. All work-item authoring, root-cause investigation phases, closed issue taxonomies, and cross-repository platform ledger synchronization are decoupled and governed by Standard S014.

## Non-Negotiable Invariants

1. **Feature Branch Isolation:** All development must occur on dedicated feature branches cut from the default branch (`master`/`main`) (`feat/<name>`, `fix/<name>`, `chore/<name>`). Direct commits to the default branch are strictly prohibited and mechanically blocked by pre-push client guards and server-side GitHub branch rulesets.
2. **One-Branch-One-Concern:** A pull request must address exactly one concern: one defect, one feature, or one architectural refactor. Diff pollution—such as mixing an unrelated formatting pass, dependency bump, or drive-by refactor into a bug-fix branch—must be split prior to merge.
3. **Reproduce-Then-Fix (TDD Invariant):** Every bug fix commit must ship with an accompanying automated reproduction test that fails against pre-fix code and passes against post-fix code. A fix diff that touches no test files is presumed unverified, not correct.
4. **Failing Test Classification:** A failing test is never bypassed or merged around. It must be classified immediately:
   - **Class A (Minor Regression):** Addressed and fixed inline in the active feature branch before opening or merging the PR.
   - **Class B (Architectural Blocker):** Halts development immediately; requires escalation and formal issue tracking under S014.
5. **Tiered Verification Protocol:** Testing scales with the development phase:
   - *During iteration:* Fast, targeted delta tests only (`npx vitest related`, `pytest -m "not integration" --testmon -q`).
   - *Before PR creation/merge:* Comprehensive scoped test suites (`pytest -m "not integration"`, `npm run test:run`, `npx tsc -b --noEmit`) and domain/platform audit gates (`pwsh -File scripts/run_audit.ps1`).
6. **PR Creation & Templates:** All pull requests must be opened as a **Draft** targeting the default branch via the GitHub integration or `gh pr create`. Contributors must fully populate `.github/PULL_REQUEST_TEMPLATE.md` with the stated requirement/defect, root cause, and verification command run. Commits must follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
7. **Non-Blocking CI Gating:** Continuous Integration checks must be monitored via the background task `gh pr checks <pr> --watch` (yielding the turn to the messaging system). Status-polling loops, `sleep` commands, or manual busy-waiting are strictly banned. All configured CI checks must pass (exit code 0) before draft status is removed or merge is authorized.
8. **Zero Broken Tests on Master:** A failing test can never be excused or shipped to the default branch (§S005).
9. **Post-Merge Clean Tree Verification:** Following merge and local trunk synchronization (`git pull origin <default_branch>`), the local checkout must be verified clean: `git status --porcelain` must be 100% empty before yielding completion.

## Architecture & Code Contracts

### Mechanical Enforcement Architecture

Direct check-ins to the repository default branch are mechanically blocked by three non-bypassable layers:
1. **Client Guard (`.git/hooks/pre-push`):** Inspects incoming push refspecs via `stdin`; terminates with exit code 1 if targeting `refs/heads/<default_branch>`.
2. **Server Ruleset (`github.com/djntechnic/<repo>`):** Branch ruleset on `~DEFAULT_BRANCH` with `bypass_actors: []` (zero bypass, including administrators) enforcing PR isolation, squash-merging, and deletion of branch references.
3. **Lifecycle Orchestrator (`/finalize-pr` / `Invoke-EcosystemLifecycle`):** Canonical automation executing tiered testing, Conventional Commits, draft PR creation, reactive CI watching (`gh pr checks --watch`), squash-merge, and local trunk tree reconciliation.

### Commit Message Conventions
Commits must use Conventional Commits to clearly delineate intent:
- `fix(<scope>): <description>`: Must be paired with a test diff in the same commit.
- `feat(<scope>): <description>`: Adds new functionality with corresponding test coverage (§S005).
- `test(<scope>): <description>`: Adds or updates test coverage without runtime code changes.
- `chore(<scope>): <description>`: Maintenance, dependency bumps, or tooling adjustments.
- `docs(<scope>): <description>`: Documentation additions or updates.

### Correct — Reproduction Test Precedes Fix in Same Commit:
```python
# packages/bedrock-api/tests/test_grid_service.py
def test_grid_column_width_persists_after_reload():
    # Reproduces the reported defect: width reset to default on reload.
    grid_service.update_column(column_id=1, width=240)
    reloaded = grid_service.get_column(column_id=1)
    assert reloaded.width == 240  # was failing before the fix in grid_service.py
```

### Violation — Fix with No Accompanying Test:
```python
# grid_service.py changed to persist width; zero test files touched in diff.
```

### Violation — Unrelated Concerns Bundled in One Branch:
```text
fix/grid-width-reset
  - fix: persist column width on reload
  - chore: reformat entire services/ directory
  - chore: bump fastapi to 0.115
```

### Python — PR Workflow Audit Verification Check:
```python
def audit_bugfix_has_test(diff_files: list[str], commit_message: str) -> bool:
    is_fix = commit_message.lower().startswith(("fix:", "fix("))
    touches_test = any("test_" in f or f.endswith("_test.py") or ".test." in f for f in diff_files)
    return not is_fix or touches_test
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s006]
exemptions = [
  "docs/**",           # documentation-only changes carry no reproduction test
  "scripts/**",        # developer maintenance scripts
]
```

A bug fix that genuinely cannot be exercised via automated test suites (e.g., changes to physical CI runners or release packaging infrastructure) requires an explicit written exemption in the PR description detailing why automated test reproduction was impossible. Unexplained exemptions fail review automatically.

## Verification & Enforcement Gate

```bash
python scripts/audit/s006_audit_pr_workflow.py --root .
```

- **Exit 0:** All tracking ledgers declared in `bedrock.toml` are well-formed and non-empty; the working tree is clean (`git status --porcelain` empty).
- **Exit 1:** A declared ledger file is missing or malformed; or pending uncommitted changes are present in the working tree.
- **Exit 2:** Configuration or environment error in `bedrock.toml`.
