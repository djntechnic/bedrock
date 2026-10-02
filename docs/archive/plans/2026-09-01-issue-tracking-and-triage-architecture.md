# Issue Tracking & Triage Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize GitHub issue and PR templates across `bedrock`, `CollectIt`, and `MLBTracker`, and create the new `/issue-triage` skill in `claude-kit` `dev-doctrine`.

**Architecture:** Deploys a unified 4-template suite (`config.yml`, `defect.md`, `feature_task.md`, `out_of_scope_bug.md`, `grid_issue.md`, `PULL_REQUEST_TEMPLATE.md`) across the bedrock ecosystem without altering any `ci.yml` workflows. Implements `/issue-triage` in `claude-kit` embedding `systematic-debugging` (for root-cause defect hand-off) and `brainstorming` (for feature intake).

**Tech Stack:** GitHub Issue & PR Markdown Templates, YAML Frontmatter, Claude-kit Skill Framework (`dev-doctrine`).

**Spec:** [docs/superpowers/specs/2026-09-01-issue-tracking-and-triage-architecture-design.md](file:///c:/Dev/bedrock/docs/superpowers/specs/2026-09-01-issue-tracking-and-triage-architecture-design.md)

## Global Constraints

- Never modify any `.github/workflows/ci.yml` file across any repository.
- Standard defect templates must be named `defect.md`.
- Out-of-scope defects must follow the §S6 Defect Isolation contract and include root-cause isolation.
- Grid issues must explicitly document `bedrock` platform architecture ownership for DataGrid and hook logic.
- All defect workflows must enforce `systematic-debugging` (Phases 1-4) so junior engineers receive complete root-cause investigations, file/line anchors, and reproduction steps.
- All feature/enhancement workflows must enforce `brainstorming` inputs (goal, scope, boundary validation).

---

## File Structure & Responsibilities

| File                                                | Repo         | Responsibility                                                                                              |
| --------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| `plugins/dev-doctrine/skills/issue-triage/SKILL.md` | `claude-kit` | The `/issue-triage` skill orchestrating defect & feature issue authoring with embedded systematic-debugging |
| `.github/ISSUE_TEMPLATE/config.yml`                 | `bedrock`    | Disables blank issues and links to bedrock's `CLAUDE.md` standards                                          |
| `.github/ISSUE_TEMPLATE/defect.md`                  | `bedrock`    | Standard defect template with systematic-debugging fields                                                   |
| `.github/ISSUE_TEMPLATE/feature_task.md`            | `bedrock`    | Feature/task template with platform boundary & extension point checks                                       |
| `.github/ISSUE_TEMPLATE/out_of_scope_bug.md`        | `bedrock`    | §S6 defect isolation template for platform mid-task discoveries                                             |
| `.github/PULL_REQUEST_TEMPLATE.md`                  | `bedrock`    | Pull request template tailored to bedrock CI gates & standards                                              |
| `.github/ISSUE_TEMPLATE/defect.md`                  | `CollectIt`  | Standard defect template with systematic-debugging fields                                                   |
| `.github/ISSUE_TEMPLATE/feature_task.md`            | `CollectIt`  | Updated feature/task template                                                                               |
| `.github/ISSUE_TEMPLATE/out_of_scope_bug.md`        | `CollectIt`  | Synchronized §S6 defect isolation template                                                                  |
| `.github/ISSUE_TEMPLATE/grid_issue.md`              | `CollectIt`  | 7-layer DataGrid issue template noting bedrock platform ownership                                           |
| `.github/PULL_REQUEST_TEMPLATE.md`                  | `CollectIt`  | PR checklist verified against CollectIt §S1–S9 standards                                                    |
| `.github/ISSUE_TEMPLATE/defect.md`                  | `MLBTracker` | Standard defect template with systematic-debugging fields                                                   |
| `.github/ISSUE_TEMPLATE/feature_task.md`            | `MLBTracker` | Updated feature/task template                                                                               |
| `.github/ISSUE_TEMPLATE/out_of_scope_bug.md`        | `MLBTracker` | Synchronized §S6 defect isolation template                                                                  |
| `.github/ISSUE_TEMPLATE/grid_issue.md`              | `MLBTracker` | 7-layer DataGrid issue template noting bedrock platform ownership                                           |
| `.github/PULL_REQUEST_TEMPLATE.md`                  | `MLBTracker` | PR checklist verified against MLBTracker §S1–S9 standards                                                   |

---

### Task 1: Create the `/issue-triage` Skill in `claude-kit`

**Files:**

- Create: `c:/dev/claude-kit/plugins/dev-doctrine/skills/issue-triage/SKILL.md`

**Interfaces:**

- Produces: The `/issue-triage` skill callable across all repos in the workspace, supporting sub-modes for defect triage (systematic-debugging), feature triage (brainstorming), grid triage (7-layer check), and §S6 out-of-scope logging.

- [ ] **Step 1: Write the `/issue-triage` SKILL.md**

Write `c:/dev/claude-kit/plugins/dev-doctrine/skills/issue-triage/SKILL.md` with:

- Full YAML frontmatter (name: `issue-triage`, description, tags).
- Iron Law: No defect issue filed without Phase 1 (Root Cause Investigation) and Phase 2 (Pattern Analysis).
- Step-by-step triage workflow:
  1. Intake classification (`defect`, `out-of-scope-defect`, `feature-task`, `grid-issue`).
  2. Defect protocol embedding `systematic-debugging`:
     - Mandatory stack trace & error inspection.
     - Call stack tracing to point of origin (`root-cause-tracing.md`).
     - Identification of data flow boundary (API → Service → DB).
     - Working vs broken pattern comparison.
     - Proposed minimal root-cause fix hypothesis (Phase 3).
     - Test contract specification (Phase 4).
  3. Feature protocol embedding `brainstorming`:
     - User story & goal extraction.
     - Platform boundary check: Bedrock platform table/primitive vs Host application domain.
     - Extension point classification: Registry vs Provider.
  4. Grid issue protocol:
     - 7-layer contract audit (DB, Migration, Pydantic, API GET/PATCH, TS hook, DataGrid, Admin editor).
     - Bedrock core architecture ownership check.
  5. Markdown generation targeting repository's `.github/ISSUE_TEMPLATE/`.

- [ ] **Step 2: Verify the skill file**

Run verification check to ensure the skill file exists and has valid YAML frontmatter.

- [ ] **Step 3: Commit**

```bash
cd c:/dev/claude-kit
git add plugins/dev-doctrine/skills/issue-triage/SKILL.md
git commit -m "feat(doctrine): add issue-triage skill with embedded systematic-debugging and brainstorming"
```

---

### Task 2: Deploy Unified Template Suite to `bedrock`

**Files:**

- Create: `c:/Dev/bedrock/.github/ISSUE_TEMPLATE/config.yml`
- Create: `c:/Dev/bedrock/.github/ISSUE_TEMPLATE/defect.md`
- Create: `c:/Dev/bedrock/.github/ISSUE_TEMPLATE/feature_task.md`
- Create: `c:/Dev/bedrock/.github/ISSUE_TEMPLATE/out_of_scope_bug.md`
- Create: `c:/Dev/bedrock/.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**

- Consumes: Platform guide & boundary contracts from `CLAUDE.md`.
- Produces: GitHub Issue & PR templates for `djntechnic/bedrock`.

- [ ] **Step 1: Write `c:/Dev/bedrock/.github/ISSUE_TEMPLATE/config.yml`**

Create config with `blank_issues_enabled: false` and link to `CLAUDE.md` and `docs/platform_guide.md`.

- [ ] **Step 2: Write `c:/Dev/bedrock/.github/ISSUE_TEMPLATE/defect.md`**

Create `defect.md` containing:

- Title format: `[P<phase>.<block>] <Concise Defect Summary>`
- Labels: `["type:defect"]`
- Headings: `## Goal`, `## Severity & Blast Radius`, `## Systematic Reproduction`, `## Root Cause Analysis (Phase 1 & 2)`, `## Proposed Resolution & Hypothesis (Phase 3)`, `## Files Impacted & Test Specification (Phase 4)`, `## Success Criteria`.

- [ ] **Step 3: Write `c:/Dev/bedrock/.github/ISSUE_TEMPLATE/feature_task.md`**

Create `feature_task.md` containing:

- Title format: `[P<phase>.<block>] <Concise Title Summary Detail>`
- Labels: `["type:feature"]`
- Headings: `## Goal`, `## Context & Brainstorming Summary`, `## Platform Boundary Validation`, `## Files Impacted`, `## Success Criteria`.

- [ ] **Step 4: Write `c:/Dev/bedrock/.github/ISSUE_TEMPLATE/out_of_scope_bug.md`**

Create `out_of_scope_bug.md` with §S6 defect isolation fields and root-cause tracing.

- [ ] **Step 5: Write `c:/Dev/bedrock/.github/PULL_REQUEST_TEMPLATE.md`**

Create PR template referencing bedrock CI gates (`bedrock-api (pytest)` and `bedrock-ui (vitest + tsc)`), PR target `master`, and platform standards.

- [ ] **Step 6: Verify `ci.yml` was untouched**

Run `git status` in `c:/Dev/bedrock` to ensure `.github/workflows/` was unmodified.

- [ ] **Step 7: Commit**

```bash
cd c:/Dev/bedrock
git add .github/ISSUE_TEMPLATE/ .github/PULL_REQUEST_TEMPLATE.md
git commit -m "feat(github): add unified issue templates and PR template"
```

---

### Task 3: Deploy and Synchronize Template Suite in `CollectIt`

**Files:**

- Create: `c:/Dev/CollectIt/.github/ISSUE_TEMPLATE/defect.md`
- Create: `c:/Dev/CollectIt/.github/ISSUE_TEMPLATE/grid_issue.md`
- Modify: `c:/Dev/CollectIt/.github/ISSUE_TEMPLATE/feature_task.md`
- Modify: `c:/Dev/CollectIt/.github/ISSUE_TEMPLATE/out_of_scope_bug.md`
- Modify: `c:/Dev/CollectIt/.github/ISSUE_TEMPLATE/config.yml`
- Modify: `c:/Dev/CollectIt/.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**

- Consumes: CollectIt standards §S1–S9 from `CLAUDE.md`.
- Produces: Synchronized templates conforming to `/issue-triage` and `/implement-issue`.

- [ ] **Step 1: Write `c:/Dev/CollectIt/.github/ISSUE_TEMPLATE/defect.md`**

Create `defect.md` with the systematic-debugging structure tailored to CollectIt (FastAPI + React 18 + Bedrock packages).

- [ ] **Step 2: Write `c:/Dev/CollectIt/.github/ISSUE_TEMPLATE/grid_issue.md`**

Create `grid_issue.md` tailored for CollectIt (Listing Studio grids, eBay templates, 7-layer contract, and bedrock engine ownership).

- [ ] **Step 3: Update `feature_task.md` and `out_of_scope_bug.md`**

Update `feature_task.md` to incorporate platform boundary verification and brainstorming context. Update `out_of_scope_bug.md` with systematic-debugging root-cause isolation.

- [ ] **Step 4: Update `config.yml` and `PULL_REQUEST_TEMPLATE.md`**

Ensure `config.yml` links to `CLAUDE.md` standards and `PULL_REQUEST_TEMPLATE.md` reflects the 11 audit gates and §S1–S9 standards checklist.

- [ ] **Step 5: Run CollectIt maintenance audits**

```bash
cd c:/Dev/CollectIt
python scripts/maintenance/audit_guidance.py
python scripts/maintenance/check_claude_md_length.py
```

- [ ] **Step 6: Verify `ci.yml` was untouched**

Run `git status` in `c:/Dev/CollectIt` to confirm `.github/workflows/` was unmodified.

- [ ] **Step 7: Commit**

```bash
cd c:/Dev/CollectIt
git add .github/ISSUE_TEMPLATE/ .github/PULL_REQUEST_TEMPLATE.md
git commit -m "feat(github): deploy defect template and synchronize issue/PR templates"
```

---

### Task 4: Deploy and Synchronize Template Suite in `MLBTracker`

**Files:**

- Create: `c:/Dev/MLBTracker/.github/ISSUE_TEMPLATE/defect.md`
- Modify: `c:/Dev/MLBTracker/.github/ISSUE_TEMPLATE/grid_issue.md`
- Modify: `c:/Dev/MLBTracker/.github/ISSUE_TEMPLATE/feature_task.md`
- Modify: `c:/Dev/MLBTracker/.github/ISSUE_TEMPLATE/out_of_scope_bug.md`
- Modify: `c:/Dev/MLBTracker/.github/ISSUE_TEMPLATE/config.yml`
- Modify: `c:/Dev/MLBTracker/.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**

- Consumes: MLBTracker standards §S1–S9 from `CLAUDE.md`.
- Produces: Synchronized templates conforming to `/issue-triage` and `/implement-issue`.

- [ ] **Step 1: Write `c:/Dev/MLBTracker/.github/ISSUE_TEMPLATE/defect.md`**

Create `defect.md` with the systematic-debugging structure tailored to MLBTracker.

- [ ] **Step 2: Update `grid_issue.md`**

Update `grid_issue.md` to highlight bedrock platform architecture ownership for DataGrid and hook primitives.

- [ ] **Step 3: Update `feature_task.md` and `out_of_scope_bug.md`**

Update `feature_task.md` with platform boundary validation and brainstorming context. Update `out_of_scope_bug.md` with systematic-debugging root-cause isolation.

- [ ] **Step 4: Update `config.yml` and `PULL_REQUEST_TEMPLATE.md`**

Verify `config.yml` and synchronize `PULL_REQUEST_TEMPLATE.md` with repo standards §S1–S9.

- [ ] **Step 5: Run MLBTracker maintenance audits**

```bash
cd c:/Dev/MLBTracker
python scripts/maintenance/audit_guidance.py
python scripts/maintenance/check_claude_md_length.py
```

- [ ] **Step 6: Verify `ci.yml` was untouched**

Run `git status` in `c:/Dev/MLBTracker` to confirm `.github/workflows/` was unmodified.

- [ ] **Step 7: Commit**

```bash
cd c:/Dev/MLBTracker
git add .github/ISSUE_TEMPLATE/ .github/PULL_REQUEST_TEMPLATE.md
git commit -m "feat(github): deploy defect template and synchronize issue/PR templates"
```

---

### Task 5: Final Cross-Repository Verification

**Files:**

- Audit all files created across all 4 locations.

- [ ] **Step 1: Verify all template files and skill file exist**

Verify presence and formatting of:

- `c:/dev/claude-kit/plugins/dev-doctrine/skills/issue-triage/SKILL.md`
- `c:/Dev/bedrock/.github/ISSUE_TEMPLATE/{config.yml,defect.md,feature_task.md,out_of_scope_bug.md}`
- `c:/Dev/CollectIt/.github/ISSUE_TEMPLATE/{config.yml,defect.md,feature_task.md,out_of_scope_bug.md,grid_issue.md}`
- `c:/Dev/MLBTracker/.github/ISSUE_TEMPLATE/{config.yml,defect.md,feature_task.md,out_of_scope_bug.md,grid_issue.md}`

- [ ] **Step 2: Verify `workflows/ci.yml` untouched in all repos**

Confirm zero diffs in `.github/workflows/ci.yml` across `bedrock`, `CollectIt`, and `MLBTracker`.
