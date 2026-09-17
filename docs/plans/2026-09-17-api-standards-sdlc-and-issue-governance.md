# API Standards, SDLC Workflow & Ecosystem Issue Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish platform standards `S013` (API Standards & Admin Interactivity) and `S014` (Issue Logging & Ecosystem Governance), refactor `S006` (SDLC & PR Workflow), upgrade the `issue-triage` skill in `bedrock-ai-kit`, and remediate downstream gaps across `MLBTracker` and `CollectIt`.

**Architecture:** Split developer lifecycle execution (`S006`) from work-item authoring & cross-repo governance (`S014`). Establish `S013` requiring uniform `/api/v1` routes, `ApiResponse[T]` envelopes, existence-hiding 404s, Pydantic schemas, and interactive Admin Console spec/routes inspection. Promote interactive API spec testing to `@djntechnic/bedrock-ui` to eliminate consumer UI duplication, synchronize standards downstream, and establish missing API documentation in `CollectIt`.

**Tech Stack:** Python (FastAPI, Pydantic, Loguru, pytest), TypeScript/React (Vite, `@djntechnic/bedrock-ui`, `swagger-ui-react`, lucide-react), Markdown/GitHub Actions, PowerShell 7 (`pwsh`).

**Spec:** [`c:\dev\bedrock\docs\specs\2026-09-17-api-standards-sdlc-and-issue-governance-design.md`](file:///c:/dev/bedrock/docs/specs/2026-09-17-api-standards-sdlc-and-issue-governance-design.md)

## Global Constraints
- Platform range is `S001`–`S099`; consumer domain range is `S101`–`S199`.
- Standard citations in prose and code must strictly use the 3-digit padded form: `§S001`–`§S014`, `§S100`.
- All standards documents must follow kebab-case naming (`s###-<topic>.md`) and adhere to the canonical 5-section schema per `S100`.
- Zero UI duplication (§S001): reusable components belong in `@djntechnic/bedrock-ui`.
- All shell commands must inspect exit codes directly (`echo "exit=$LASTEXITCODE"` / `$LASTEXITCODE`).
- Zero broken tests on master (§S005).

---

### Task 1: Refactor Standard S006 (`s006-sdlc-and-pr-workflow.md`)

**Files:**
- Rename/Modify: `c:\dev\bedrock\docs\standards\s006-defect-isolation-and-pr-workflow.md` -> `c:\dev\bedrock\docs\standards\s006-sdlc-and-pr-workflow.md`
- Verify: `c:\dev\bedrock\packages\bedrock-api\bedrock\tools\audit_s006_pr_workflow.py`

**Interfaces:**
- Consumes: Existing S006 frontmatter and audit gate `audit_s006_pr_workflow`.
- Produces: Pure SDLC & PR Workflow standard document covering feature branching, one-concern-per-branch, reproduce-then-fix TDD, tiered test verification, draft PRs, background CI monitoring (`gh pr checks --watch`), and post-merge clean tree sync.

- [ ] **Step 1: Draft refactored S006 standard**
  Refactor `s006-sdlc-and-pr-workflow.md` with:
  - Title: `"SDLC & PR Workflow"`
  - Status: `active`, Tier: `platform`
  - 5 canonical sections: Purpose & Objective, Non-Negotiable Invariants, Architecture & Code Contracts, Exceptions & Audit Exemptions, Verification & Enforcement Gate.
  - Strictly remove out-of-scope bug isolation and issue taxonomy (delegated to S014).
  - Add explicit invariants for background CI monitoring (`gh pr checks <pr> --watch`), zero broken tests to master, and post-merge clean tree verification (`git status --porcelain` empty).

- [ ] **Step 2: Remove old S006 filename if renamed**
  Ensure git tracks the file rename: `git mv s006-defect-isolation-and-pr-workflow.md s006-sdlc-and-pr-workflow.md`.

- [ ] **Step 3: Run S006 audit gate to verify compliance**
  Run: `python -m bedrock.tools.audit_s006_pr_workflow --root .`
  Expected: Exit 0.

- [ ] **Step 4: Commit**
  Run: `git add docs/standards/s006-sdlc-and-pr-workflow.md && git commit -m "docs(standards): refactor S006 into pure SDLC and PR workflow standard"`

---

### Task 2: Author Standard S013 (`s013-api-standards.md`)

**Files:**
- Create: `c:\dev\bedrock\docs\standards\s013-api-standards.md`
- Reference: `c:\dev\bedrock\packages\bedrock-api\bedrock\tools\audit_api_docs.py`

**Interfaces:**
- Consumes: Specifications from `2026-09-17-api-standards-sdlc-and-issue-governance-design.md`, `MLBTracker` API reference & authentication docs.
- Produces: Standard S013 document defining URL blueprint, `ApiResponse[T]`, HTTP status codes, security/existence-hiding 404s, Pydantic schemas, docstrings, and Admin portal testability (API Routes Explorer + Spec Swagger UI).

- [ ] **Step 1: Write `s013-api-standards.md`**
  Author the file following the 5-section schema:
  - Header frontmatter: `id: S013`, `title: "API Standards & Admin Interactivity"`, `enforced_by: bedrock.tools.audit_api_docs`, `cli_command: "python -m bedrock.tools.audit_api_docs --app api.main:app"`.
  - Non-negotiable invariants:
    1. Uniform `/api/v1` prefix and lowercase kebab-case resource paths.
    2. Canonical `ApiResponse[T]` envelope (`status`, `data`, `message`, `errors`).
    3. Strict HTTP status codes: 200, 201, 204, 400, 401, 403, 404 (existence hiding), 409, 422, 429.
    4. Row-level existence-hiding: foreign-owned resource requests must return 404, never 403.
    5. Declarative security boundary checks (`require_role`, `require_module`); ad hoc checks inside handlers banned.
    6. Strict Pydantic models for request bodies and response schemas.
    7. Mandatory route docstrings with summary, behavioral description, parameter notes, and return schemas.
    8. 100% route documentation in OpenAPI schema (zero undocumented routes).
    9. Admin Portal Interactivity: `/admin?tab=health` must expose API Routes Explorer (`/api-health`) and Spec Panel (Swagger UI + OpenAPI/Postman exports) with live authenticated testing.

- [ ] **Step 2: Verify S008 doc naming and layout**
  Run: `python -m bedrock.tools.audit_s008_guidance`
  Expected: Exit 0.

- [ ] **Step 3: Commit**
  Run: `git add docs/standards/s013-api-standards.md && git commit -m "docs(standards): author S013 API standards and admin interactivity"`

---

### Task 3: Author Standard S014 (`s014-issue-logging-and-ecosystem-governance.md`)

**Files:**
- Create: `c:\dev\bedrock\docs\standards\s014-issue-logging-and-ecosystem-governance.md`
- Reference: `c:\dev\bedrock\packages\bedrock-api\bedrock\tools\audit_ledger_freshness.py`

**Interfaces:**
- Consumes: Design spec Section 4, GitHub template specifications, and consumer ledger rules.
- Produces: Standard S014 document defining closed issue taxonomy, mandatory 4-phase root cause analysis, out-of-scope bug isolation, Bedrock + domain cross-repo dual-issue protocol, and consumer ledger lifecycle.

- [ ] **Step 1: Write `s014-issue-logging-and-ecosystem-governance.md`**
  Author the file following the 5-section schema:
  - Header frontmatter: `id: S014`, `title: "Issue Logging & Ecosystem Governance"`, `enforced_by: bedrock.tools.audit_ledger_freshness`, `cli_command: "python -m bedrock.tools.audit_ledger_freshness docs/reference/bedrock_issues_to_file.md"`.
  - Non-negotiable invariants:
    1. Closed issue taxonomy: Standard Defect (`defect.md`), Out-of-Scope Defect (`out_of_scope_bug.md`), Feature/Task (`feature_task.md`), Grid Issue (`grid_issue.md`).
    2. Mandatory 4-Phase Root Cause Analysis: Phase 1 (file:line origin, reproduction command, backward data flow), Phase 2 (pattern analysis against working code), Phase 3 (minimal source-level fix hypothesis), Phase 4 (test specification contract). Symptom-only issues are banned.
    3. Out-of-Scope Defect Isolation: mid-task discoveries must never be patched inline; file to `out_of_scope_bug.md` and decouple from active PR.
    4. Cross-Repository Dual-Issue Protocol:
       - Upstream Bedrock ticket in `djntechnic/bedrock` (`origin:<repo>` tag, domain-agnostic, platform files).
       - Downstream Domain ticket in `djntechnic/<app>` (`Blocked by bedrock#<id>`, domain wiring, pin bump).
       - Consumer ledger entry in `docs/reference/bedrock-issues-to-file.md` (entry #, issue link, date, symptom, impact, upstream fix, local workaround).
       - Deletion Rule: ledger entries deleted only after upstream release tag is published AND adopted downstream.

- [ ] **Step 2: Verify S008 doc naming and layout**
  Run: `python -m bedrock.tools.audit_s008_guidance`
  Expected: Exit 0.

- [ ] **Step 3: Commit**
  Run: `git add docs/standards/s014-issue-logging-and-ecosystem-governance.md && git commit -m "docs(standards): author S014 issue logging and ecosystem governance"`

---

### Task 4: Update Standards Index (`docs/standards/README.md`) & Verify Platform Gates

**Files:**
- Modify: `c:\dev\bedrock\docs\standards\README.md`
- Verify: All platform audit scripts in `c:\dev\bedrock\packages\bedrock-api\bedrock\tools\`

- [ ] **Step 1: Update Standards Table in `docs/standards/README.md`**
  Add rows for `S013` and `S014`, update `S006` title to "SDLC & PR Workflow":
  ```markdown
  | [S006](s006-sdlc-and-pr-workflow.md) | SDLC & PR Workflow | active | `bedrock.tools.audit_s006_pr_workflow` | platform |
  | [S013](s013-api-standards.md) | API Standards & Admin Interactivity | active | `bedrock.tools.audit_api_docs` | platform |
  | [S014](s014-issue-logging-and-ecosystem-governance.md) | Issue Logging & Ecosystem Governance | active | `bedrock.tools.audit_ledger_freshness` | platform |
  ```

- [ ] **Step 2: Run platform audit suite on bedrock**
  Run:
  ```powershell
  python -m bedrock.tools.audit_s008_guidance
  python -m bedrock.tools.audit_taxonomy_and_casing
  python -m bedrock.tools.audit_release_version
  ```
  Expected: All exit 0.

- [ ] **Step 3: Commit**
  Run: `git add docs/standards/README.md && git commit -m "docs(standards): update standards index with S006, S013, and S014"`

---

### Task 5: Promote `ApiSpecPanel` & API Routes Explorer to `@djntechnic/bedrock-ui`

**Files:**
- Create: `c:\dev\bedrock\packages\bedrock-ui\src\components\admin\ApiSpecPanel.tsx`
- Create: `c:\dev\bedrock\packages\bedrock-ui\src\components\admin\ApiRoutesPanel.tsx`
- Modify: `c:\dev\bedrock\packages\bedrock-ui\src\components\admin\PlatformHealthPanel.tsx`
- Modify: `c:\dev\bedrock\packages\bedrock-ui\src\components\admin\index.ts` (and barrel exports)
- Modify: `c:\dev\bedrock\packages\bedrock-ui\package.json` (ensure `swagger-ui-react` is declared or loaded as optional peer/dynamic import)
- Test: `c:\dev\bedrock\packages\bedrock-ui\src\components\admin\ApiSpecPanel.test.tsx`

**Interfaces:**
- Consumes: `/openapi.json` and `GET /api/v1/admin/api-health` via `useApiHealth`.
- Produces: Reusable `<ApiSpecPanel>` and `<ApiRoutesPanel>` components exported from `@djntechnic/bedrock-ui`, allowing `PlatformHealthPanel` to offer Overview, API Routes, and Spec tabs.

- [ ] **Step 1: Author failing test for `ApiSpecPanel` export and rendering**
  Create `packages/bedrock-ui/src/components/admin/ApiSpecPanel.test.tsx` verifying component renders action bar download buttons and Swagger UI container.
  Run: `npm --prefix packages/bedrock-ui run test:run ApiSpecPanel`
  Expected: FAIL (component not found).

- [ ] **Step 2: Add `swagger-ui-react` dependency and CSS to `bedrock-ui`**
  Add `"swagger-ui-react": "^5.18.2"` (or appropriate version) to `packages/bedrock-ui/package.json` dependencies/peerDependencies.

- [ ] **Step 3: Implement `ApiSpecPanel.tsx` and `ApiRoutesPanel.tsx` in `bedrock-ui`**
  Port the robust implementation from MLBTracker into `packages/bedrock-ui/src/components/admin/`:
  - Lazy-loaded `swagger-ui-react` with theme-matched wrapper.
  - Action bar with OpenAPI JSON download and Postman Collection download anchors.
  - Rich filterable API Routes accordion with telemetry cards, parameter tables, request body schemas, response types, and doc status badges.

- [ ] **Step 4: Integrate into `PlatformHealthPanel.tsx` and export from barrel**
  Update `PlatformHealthPanel.tsx` to include internal tabs (Overview, API Routes, Spec) or export `<ApiSpecPanel>` and `<ApiRoutesPanel>` so consumer admin pages can mount them directly.
  Export from `packages/bedrock-ui/src/components/admin/index.ts` and `src/index.ts`.

- [ ] **Step 5: Run tests and build `bedrock-ui`**
  Run: `npm --prefix packages/bedrock-ui run test:run`
  Run: `npm --prefix packages/bedrock-ui run build`
  Expected: All tests pass, build succeeds without TS errors.

- [ ] **Step 6: Commit**
  Run: `git add packages/bedrock-ui/ && git commit -m "feat(bedrock-ui): export ApiSpecPanel and ApiRoutesPanel for S013 admin parity"`

---

### Task 6: Add Missing `grid_issue.md` Template to Bedrock `.github/`

**Files:**
- Create: `c:\dev\bedrock\.github\ISSUE_TEMPLATE\grid_issue.md`
- Modify: `c:\dev\bedrock\.github\ISSUE_TEMPLATE\defect.md`
- Modify: `c:\dev\bedrock\.github\ISSUE_TEMPLATE\out_of_scope_bug.md`

**Interfaces:**
- Consumes: S014 standards and canonical template contracts.
- Produces: Complete GitHub issue template suite in `bedrock` citing `§S001`–`§S014`.

- [ ] **Step 1: Create `grid_issue.md` in `bedrock`**
  Create `.github/ISSUE_TEMPLATE/grid_issue.md` covering the 7-layer contract audit.

- [ ] **Step 2: Update citations in Bedrock issue templates**
  Update `defect.md` and `out_of_scope_bug.md` to reference `§S014` for defect isolation & authoring, and use 3-digit padded citations (`§S001`–`§S014`).

- [ ] **Step 3: Commit**
  Run: `git add .github/ISSUE_TEMPLATE/ && git commit -m "chore(github): add grid_issue template and update citations to S001-S014"`

---

### Task 7: Upgrade `issue-triage` Skill in `bedrock-ai-kit`

**Files:**
- Modify: `c:\Dev\bedrock-ai-kit\skills\issue-triage\SKILL.md`

**Interfaces:**
- Consumes: Standard S014 and the 5 operational modes defined in the design spec.
- Produces: Comprehensive `issue-triage` skill enforcing root-cause investigation, template selection, and cross-repo dual-issue workflow.

- [ ] **Step 1: Refactor `issue-triage/SKILL.md`**
  - Remove duplicate classification tables.
  - Update all standard citations to canonical `§S001`–`§S014` and `§S100`.
  - Update out-of-scope defect references to cite `§S014`.
  - Organize into 5 explicit operational modes:
    - Mode A: Standard Defect (In-Scope)
    - Mode B: Out-of-Scope Defect Isolation
    - Mode C: Feature / Task
    - Mode D: Grid Issue (7-Layer Audit)
    - Mode E: Cross-Repo Bedrock + Domain Dual-Issue Workflow (Upstream Bedrock ticket, Downstream Domain ticket, Ledger entry formatting, Freshness verification).

- [ ] **Step 2: Commit in `bedrock-ai-kit`**
  Run: `git -C c:\Dev\bedrock-ai-kit add skills/issue-triage/SKILL.md && git -C c:\Dev\bedrock-ai-kit commit -m "feat(skills): upgrade issue-triage to enforce S014 and dual-issue protocol"`

---

### Task 8: Synchronize Tooling & Skills across Workspaces

**Files:**
- Modify: `c:\Dev\CollectIt\.agents\skills\issue-triage\SKILL.md`
- Script: `c:\Dev\bedrock\scripts\sync_standards.py` / `Sync-AgenticTooling.ps1`

- [ ] **Step 1: Propagate `issue-triage` skill to consumer mirrors**
  Sync `c:\Dev\bedrock-ai-kit\skills\issue-triage\SKILL.md` to `c:\Dev\CollectIt\.agents\skills\issue-triage\SKILL.md` and any active `.gemini\skills` mirrors.

- [ ] **Step 2: Commit mirror updates in `CollectIt`**
  Run: `git -C c:\Dev\CollectIt add .agents/skills/issue-triage/SKILL.md && git -C c:\Dev\CollectIt commit -m "chore(doctrine): update issue-triage skill mirror to match bedrock-ai-kit"`

---

### Task 9: Synchronize Standards Downstream to `MLBTracker` and `CollectIt`

**Files:**
- Modify: `c:\Dev\MLBTracker\docs\standards\*`
- Modify: `c:\Dev\CollectIt\docs\standards\*`

- [ ] **Step 1: Execute `sync_standards` for `MLBTracker`**
  Run: `python -m bedrock.tools.sync_standards --target c:\Dev\MLBTracker`
  Expected: Copies `S001`–`S014` and `S100` into `c:\Dev\MLBTracker\docs\standards\`.

- [ ] **Step 2: Execute `sync_standards` for `CollectIt`**
  Run: `python -m bedrock.tools.sync_standards --target c:\Dev\CollectIt`
  Expected: Copies `S001`–`S014` and `S100` into `c:\Dev\CollectIt\docs\standards\`.

- [ ] **Step 3: Commit standards synchronization in both consumer repos**
  - In `MLBTracker`: `git add docs/standards/ && git commit -m "chore(standards): sync S006, S013, S014 from bedrock"`
  - In `CollectIt`: `git add docs/standards/ && git commit -m "chore(standards): sync S006, S013, S014 from bedrock"`

---

### Task 10: Remediate GitHub Issue Templates in `MLBTracker` and `CollectIt`

**Files:**
- Modify: `c:\Dev\MLBTracker\.github\ISSUE_TEMPLATE\defect.md`
- Modify: `c:\Dev\MLBTracker\.github\ISSUE_TEMPLATE\out_of_scope_bug.md`
- Modify: `c:\Dev\CollectIt\.github\ISSUE_TEMPLATE\defect.md`
- Modify: `c:\Dev\CollectIt\.github\ISSUE_TEMPLATE\out_of_scope_bug.md`

- [ ] **Step 1: Update `MLBTracker` templates**
  Update `defect.md` and `out_of_scope_bug.md` to reference `§S014` (replacing `§S06`), and update the standards checklist to cite `§S001`–`§S014`.
  Commit: `git -C c:\Dev\MLBTracker add .github/ISSUE_TEMPLATE/ && git -C c:\Dev\MLBTracker commit -m "chore(github): align issue templates with S014 and S001-S014 standards"`

- [ ] **Step 2: Update `CollectIt` templates**
  Update `defect.md` and `out_of_scope_bug.md` to reference `§S014`, and update checklist to cite `§S001`–`§S014`.
  Commit: `git -C c:\Dev\CollectIt add .github/ISSUE_TEMPLATE/ && git -C c:\Dev\CollectIt commit -m "chore(github): align issue templates with S014 and S001-S014 standards"`

---

### Task 11: Remediate `MLBTracker` Admin Page UI Duplication

**Files:**
- Modify: `c:\Dev\MLBTracker\frontend\src\pages\AdminPage.tsx`
- Delete/Retire: `c:\Dev\MLBTracker\frontend\src\components\admin\ApiSpecPanel.tsx`
- Test: `c:\Dev\MLBTracker\frontend\src\components\admin\ApiSpecPanel.test.tsx`

- [ ] **Step 1: Refactor `AdminPage.tsx` in `MLBTracker` to import `<PlatformHealthPanel>` or `<ApiSpecPanel>` from `@djntechnic/bedrock-ui`**
  Replace local accordion rendering and local `ApiSpecPanel.tsx` with the platform export from `@djntechnic/bedrock-ui`.

- [ ] **Step 2: Run frontend test suite in `MLBTracker`**
  Run: `npm --prefix c:\Dev\MLBTracker\frontend run test:run AdminPage`
  Expected: PASS.

- [ ] **Step 3: Run `audit_s1_duplicates` in `MLBTracker`**
  Run: `python -m bedrock.tools.audit_s1_duplicates` from `c:\Dev\MLBTracker`.
  Expected: PASS (zero duplicate twins detected).

- [ ] **Step 4: Commit in `MLBTracker`**
  Run: `git -C c:\Dev\MLBTracker add frontend/ && git commit -m "refactor(admin): consume ApiSpecPanel and ApiRoutesPanel from bedrock-ui (§S001)"`

---

### Task 12: Remediate `CollectIt` API Reference Documentation & Admin Spec Tab

**Files:**
- Create: `c:\Dev\CollectIt\docs\guide\api-reference.md`
- Create: `c:\Dev\CollectIt\docs\guide\api-authentication.md`
- Create: `c:\Dev\CollectIt\api\tests\test_api_docs.py`
- Modify: `c:\Dev\CollectIt\frontend\src\pages\AdminPage.tsx`

- [ ] **Step 1: Author `docs/guide/api-authentication.md` in `CollectIt`**
  Document JWT authentication, role/module gating, password/OAuth login flows, and rate limiting error shapes.

- [ ] **Step 2: Author `docs/guide/api-reference.md` in `CollectIt`**
  Document every `/api/v1/...` route shipped by `CollectIt` (`dashboard`, `entities`, `exporting`, `images`, `items`, `items_bulk`, `libraries`, `listing_templates`, `settings`, `templates`, `variables`, `vault`, `vocabularies`).

- [ ] **Step 3: Add `test_api_docs.py` in `CollectIt`**
  Add unit test verifying:
  - `iter_route_specs` yields all `/api/v1` routes.
  - Zero versioned routes undocumented (`test_no_versioned_route_is_undocumented`).
  Run: `pytest c:\Dev\CollectIt\api\tests\test_api_docs.py`
  Expected: PASS.

- [ ] **Step 4: Run `audit_api_docs` on `CollectIt`**
  Run: `python -m bedrock.tools.audit_api_docs --repo-root c:\Dev\CollectIt --doc docs/guide/api-reference.md --app api.main:app`
  Expected: Exit 0 (all routes documented).

- [ ] **Step 5: Verify AdminPage in `CollectIt`**
  Verify that `AdminPage.tsx` mounts `<PlatformHealthPanel />` (which now renders API Routes and Spec sub-tabs from `@djntechnic/bedrock-ui`).

- [ ] **Step 6: Commit in `CollectIt`**
  Run: `git -C c:\Dev\CollectIt add docs/guide/ api/tests/ && git commit -m "docs(api): add api-reference, api-authentication, and api_docs verification gate (§S013)"`

---

### Task 13: Full Ecosystem Verification & Gates Run

**Files:**
- All repositories

- [ ] **Step 1: Run Bedrock audit suite**
  From `c:\Dev\bedrock`:
  ```bash
  python -m bedrock.tools.audit_s008_guidance
  python -m bedrock.tools.audit_taxonomy_and_casing
  python -m bedrock.tools.audit_release_version
  ```
  Expected: Exit 0.

- [ ] **Step 2: Run MLBTracker audit and ledger freshness gates**
  From `c:\Dev\MLBTracker`:
  ```bash
  python -m bedrock.tools.audit_api_docs --app api.main:app
  python -m bedrock.tools.audit_ledger_freshness docs/reference/bedrock-issues-to-file.md
  python -m bedrock.tools.audit_s008_guidance
  ```
  Expected: Exit 0.

- [ ] **Step 3: Run CollectIt audit and ledger freshness gates**
  From `c:\Dev\CollectIt`:
  ```bash
  python -m bedrock.tools.audit_api_docs --app api.main:app --doc docs/guide/api-reference.md
  python -m bedrock.tools.audit_ledger_freshness docs/reference/bedrock-issues-to-file.md
  python -m bedrock.tools.audit_s008_guidance
  ```
  Expected: Exit 0.
