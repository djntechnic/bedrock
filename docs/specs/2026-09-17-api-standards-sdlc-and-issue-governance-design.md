# API Standards, SDLC Workflow & Ecosystem Issue Governance Architecture Design

- **Date:** 2026-09-17
- **Status:** Approved
- **Scope:** Bedrock Platform (`djntechnic/bedrock`), Consumer Repositories (`MLBTracker`, `CollectIt`), and Ecosystem Tooling (`bedrock-ai-kit`).
- **Target Standards:** `S013` (New), `S006` (Refactored), `S014` (New), `README.md` Index Update.
- **Target Skills:** `issue-triage` (Upgrade in `bedrock-ai-kit` & Consumer Mirrors).

---

## 1. Executive Summary & Problem Statement

As the Bedrock ecosystem expands across multiple consumer applications, engineering contracts must remain mechanically enforced and unambiguous:
1. **API Drift & Documentation Gaps:** Backend endpoints across consumer applications risk drifting in envelope structure, authentication rules, status code semantics, and data isolation patterns. Furthermore, without an enforceable platform invariant, consumer admin portals can fail to expose, document, or provide interactive testing for all versioned APIs.
2. **Conflation in S006:** Standard `S006` previously conflated two distinct engineering concerns: code lifecycle execution (branching, TDD, CI gating, PR workflows) and work-item management (issue authoring, 4-phase root cause analysis, out-of-scope bug isolation).
3. **Cross-Repository Governance Gaps:** When defects or enhancements span the platform boundary (`bedrock` vs. consumer domain), inconsistent ticket authoring, missing upstream/downstream links, and unmanaged consumer ledgers (`bedrock-issues-to-file.md`) lead to untracked workarounds and uncoordinated version bumps.

This specification addresses these deficiencies by authoring **`S013` (API Standards & Admin Interactivity)**, refactoring **`S006` (SDLC & PR Workflow)**, establishing **`S014` (Issue Logging & Ecosystem Governance)**, and updating the **`issue-triage`** skill across the ecosystem.

---

## 2. Standard S013: API Standards & Admin Interactivity

### 2.1 Purpose & Objective
`S013` establishes the non-negotiable architecture, security, validation, documentation, and operator inspection contracts for all HTTP APIs across Bedrock and consumer applications. Every API route must adhere to uniform RESTful conventions, return standardized response envelopes, enforce granular security, be fully documented in the OpenAPI specification, and be directly inspectable and testable within the application's Admin Console.

### 2.2 Non-Negotiable Invariants

#### Architecture & Route Conventions
- **Uniform Prefixing:** All versioned HTTP endpoints must be mounted under `/api/v1/...`.
- **Resource Naming:** URL paths must use lowercase kebab-case for resource collections (e.g. `/api/v1/user-preferences`, `/api/v1/collection/cards`). Verbs are prohibited in resource paths except for specialized action controllers (e.g. `/api/v1/auth/change-password`, `/api/v1/transactions/{id}/complete`).
- **Response Envelope Contract:** All endpoints must return data wrapped in the canonical `ApiResponse[T]` schema:
  ```json
  {
    "status": "ok",
    "data": { ... },
    "message": "Optional user-facing confirmation",
    "errors": []
  }
  ```
- **Strict HTTP Status Code Semantics:**
  - `200 OK`: Successful read, calculation, or update returning a response body.
  - `201 Created`: Successful creation of a new resource, returning the created entity.
  - `204 No Content`: Successful deletion or state change that returns no response body.
  - `400 Bad Request`: Domain guardrail violation or business rule rejection (e.g., selling more cards than held in inventory, modifying an edit-locked transaction). Must include an actionable error message.
  - `401 Unauthorized`: Missing, expired, invalid, or revoked Bearer JWT. Response must include `WWW-Authenticate: Bearer`.
  - `403 Forbidden`: Authenticated user lacks required role (`require_role`) or disabled module (`require_module`). Response body must return `{"detail": {"code": "insufficient_role" | "module_disabled", ...}}`.
  - `404 Not Found`: Resource does not exist **or belongs to another user** (existence-hiding invariant).
  - `409 Conflict`: Business state collision, duplicate unique key (e.g., duplicate email), or administrative self-protection (e.g., admin self-deactivation attempt).
  - `422 Unprocessable Entity`: Request body or parameter failed Pydantic schema validation.
  - `429 Too Many Requests`: Rate limit exceeded. Must return `{"detail": {"code": "rate_limit_exceeded", "limit": "<slug>"}}` and header `Retry-After: 60`.

#### Security & Tenancy Invariants
- **Token Security:** HS256 JWT tokens validated exclusively in centralized middleware. Every issued token `jti` is tracked; revoked sessions are logged to `user_sessions` and `session_revocations`.
- **Existence-Hiding Invariant:** Row-level multi-tenant and user-owned data (e.g. private collections, inventories, drafts, preferences) must strictly enforce owner isolation. When a user requests a resource ID owned by another user, the handler must return **404 Not Found, never 403 Forbidden**, preventing foreign ID enumeration.
- **Declarative Route Boundaries:** Security requirements must be declared statically at the route definition using dependencies (`require_role(...)`, `require_module(...)`, `get_current_user`). Ad hoc `if current_user.role == ...` checks inside route handlers are strictly prohibited (§S010).
- **Audit Logging:** Every mutating administrative action, role modification, or rate-limit trip must emit structured telemetry to `auth_activity_log`.

#### Validation & Documentation Invariants
- **Pydantic Model Authority:** All request bodies and structured responses must be typed using Pydantic models. Raw `dict` inputs without schema validation are prohibited.
- **Mandatory Route Docstrings:** Every route handler function must include an enriched Python docstring providing:
  1. A one-line functional summary.
  2. Detailed behavioral description, business logic constraints, and query/path parameter semantics.
  3. Explicit notes on error conditions and access requirements.
- **Zero Undocumented Routes:** 100% of `/api/v1` routes must be fully documented in the generated OpenAPI schema. An endpoint lacking a description or parameter schema is considered a breaking defect.

#### Admin Portal Interactivity & Testing Invariants
Every Bedrock consumer application must expose an interactive Admin Health portal at `/admin?tab=health` providing two dedicated surfaces:
1. **API Routes Explorer Panel (`activeSection === "routes"`)**:
   - Backed by platform endpoint `GET /api/v1/admin/api-health`.
   - Aggregates operational telemetry: Total Hits, Hits (24h), Total Errors, Error Rate, and Undocumented Route Count.
   - Provides live text search filtering and an "Undocumented only" toggle.
   - Renders collapsible route cards detailing HTTP method badge, URL path, route summary, parameter schema tables (Name, In, Type, Required, Default, Description), request body fields, response schema model, tags, and documentation status (`Docs ✓` vs `No Docs`).
2. **Interactive Spec Panel (`activeSection === "spec"`, `ApiSpecPanel.tsx`)**:
   - Renders a theme-matched, embedded Swagger UI instance (`swagger-ui-react`) pointed directly at the live `/openapi.json` endpoint.
   - Supports live in-browser execution with automatic Bearer token injection from the admin's session.
   - Provides one-click action buttons to download:
     - The live backend OpenAPI schema (`export OpenAPI Spec` -> `.json`).
     - The committed Postman collection asset (`export Postman Collection` -> `.json`).

### 2.3 Verification & Enforcement Gate
- **Static Reconciliation Gate:**
  ```bash
  python -m bedrock.tools.audit_s013_api_docs --app api.main:app --doc docs/guide/api_reference.md
  ```
  - **Exit 0:** All registered `/api/v1` routes are documented in `api_reference.md`, and all documented paths exist in the app.
  - **Exit 1:** Unshipped routes documented, or shipped routes missing documentation.
  - **Exit 2:** Environment or import error.
- **Automated Test Gate:**
  A mandatory unit test (`test_no_versioned_route_is_undocumented`) asserting that `/api/v1/admin/api-health` reports zero undocumented routes and that `/openapi.json` successfully validates.

---

## 3. Standard S006: SDLC & PR Workflow

### 3.1 Purpose & Objective
`S006` governs the software development lifecycle from branch creation to post-merge synchronization. It guarantees that every code modification is isolated, thoroughly tested before implementation, verified through tiered gates, and integrated through clean, atomic pull requests without stalling master or bypassing CI checks.

### 3.2 Non-Negotiable Invariants
1. **Feature Branch Isolation:** All development must occur on dedicated feature branches cut from `master` (`feat/<name>`, `fix/<name>`, `chore/<name>`). Direct commits to `master` are strictly prohibited.
2. **One-Branch-One-Concern:** A pull request addresses exactly one concern (one defect, one feature, or one refactor). Diff pollution—such as mixing a large reformatting chore or dependency bump into a bug-fix PR—is prohibited; polluted branches must be split prior to merge.
3. **Reproduce-Then-Fix (TDD Invariant):** Every bug fix commit must ship with an automated reproduction test that fails against pre-fix code and passes against post-fix code. A fix diff that touches no test files is presumed unverified.
4. **Failing Test Classification:** Failing tests must never be merged around:
   - **Class A (Minor Regression):** Addressed inline in the active feature branch before opening or updating the PR.
   - **Class B (Architectural Blocker):** Halts the branch; requires explicit escalation and formal issue logging.
5. **Tiered Verification Protocol:**
   - *During iteration:* Fast, lean delta tests only (`vitest related`, `pytest --testmon -q`).
   - *Before PR creation/merge:* Comprehensive scoped test suites (`pytest -m "not integration"`, `npm run test:run`, `npx tsc -b --noEmit`) and domain/platform audit gates.
6. **PR Creation & Templates:** Open as a Draft PR targeting `master` via GitHub CLI or IDE tools. Populate `.github/PULL_REQUEST_TEMPLATE.md` with requirement summary, root-cause analysis, and reproduction/verification commands run. Commits must adhere to Conventional Commits.
7. **Non-Blocking CI Gating:** CI execution must be monitored using background task `gh pr checks <pr> --watch` (yielding the turn). Status-polling loops and `sleep` scripts are banned. All checks must pass (exit 0) before draft status is removed or squash-merge is performed.
8. **Zero Broken Tests on Master:** Broken tests on master are never tolerated (§S005).
9. **Post-Merge Clean Tree Verification:** Following merge, the local checkout must be synchronized (`git pull origin master`) and verified clean (`git status --porcelain` must be 100% empty) before finishing the task.

### 3.3 Verification & Enforcement Gate
```bash
python -m bedrock.tools.audit_s006_pr_workflow --root .
```
- **Exit 0:** All fix commits contain accompanying test modifications; no concern mixing detected.
- **Exit 1:** Fix commits without tests or mixed concerns identified.

---

## 4. Standard S014: Issue Logging & Ecosystem Governance

### 4.1 Purpose & Objective
`S014` establishes an unambiguous protocol for logging, triaging, and managing work items across the Bedrock ecosystem. It enforces rigorous root-cause investigation for defects, provides a closed taxonomy of issue templates, mandates isolation for out-of-scope discoveries, and defines the dual-issue coordination protocol for cross-repository platform dependencies.

### 4.2 Non-Negotiable Invariants

#### Closed Taxonomy & GitHub Templates
All issues filed in `bedrock`, `MLBTracker`, or `CollectIt` must strictly use one of four canonical GitHub issue templates:
1. **Defect (`.github/ISSUE_TEMPLATE/defect.md`):** For active in-scope bugs, regressions, or production defects.
2. **Out-of-Scope Defect (`.github/ISSUE_TEMPLATE/out_of_scope_bug.md`):** For defects discovered mid-task that are unrelated to the active branch scope and non-blocking.
3. **Feature / Task (`.github/ISSUE_TEMPLATE/feature_task.md`):** For new features, architectural refactors, schema migrations, or config additions.
4. **Grid Issue (`.github/ISSUE_TEMPLATE/grid_issue.md`):** For DataGrid or Admin Grid Editor issues, enforcing the 7-layer contract audit.

#### Mandatory 4-Phase Root Cause Analysis (Defects)
Every defect issue must complete Phases 1 & 2 of `systematic-debugging` prior to filing. Filing an issue containing only symptoms (e.g. "X crashed with error Y") is strictly forbidden:
- **Phase 1 (Origin & Trace):** Identify exact file path and line number where invalid state originates. Provide a copy-paste reproduction command (`pytest tests/...`, `npm run test:run`, curl). Trace data flow backward across architectural layer boundaries.
- **Phase 2 (Pattern Analysis):** Compare the broken implementation against a working reference in the repository or platform package. Note discrepancies in config, dependencies, or schema.
- **Phase 3 (Root-Cause Hypothesis):** Formulate a minimal, source-level fix hypothesis (symptom-patching is banned). Check platform boundaries: does this belong in domain code or `bedrock-api` / `@djntechnic/bedrock-ui`?
- **Phase 4 (Test Specification Contract):** Specify target test file, input vectors, expected outputs, and edge case assertions (null, empty, boundary conditions).

#### Out-of-Scope Defect Isolation Rule
Any unrelated, non-blocking defect discovered during feature development must **never be patched inline**. Doing so violates §S006 (one-branch-one-concern). Instead:
1. The defect is documented and decoupled immediately using `.github/ISSUE_TEMPLATE/out_of_scope_bug.md`.
2. The issue records priority, operational blast radius, decoupling rationale, reproduction trace, and test coverage gaps.
3. The active branch proceeds uninterrupted.

#### Cross-Repository Bedrock + Domain Dual-Issue Protocol
When a defect, enhancement, or grid capability crosses repository boundaries between an application (`MLBTracker`, `CollectIt`) and `bedrock`, two linked issues and a ledger entry must be created:
1. **Upstream Bedrock Issue (`djntechnic/bedrock`)**:
   - Scope: Strictly domain-agnostic platform code (`packages/bedrock-api` or `packages/bedrock-ui`). Zero baseball or collectibles domain tables.
   - Labels: `origin:<repo>` (e.g. `origin:mlbtracker`, `origin:collectit`) and `bug` or `enhancement`.
   - Content: Platform boundary validation, extension point classification (`Registry` vs `Provider` vs `N/A`), platform files impacted, and reproduction test spec.
2. **Downstream Application Issue (`djntechnic/<app>`)**:
   - Scope: Domain wiring, extension point registration, seed migrations, and consumer test fixtures.
   - Dependency Link: Explicitly states `Blocked by djntechnic/bedrock#<id>`.
   - Task: Tracks the dual-pin upgrade (`/bump-bedrock-pin <tag>`) once upstream Bedrock is released.
3. **Consumer Ledger Synchronization**:
   - The consumer repository's ledger at `docs/reference/bedrock-issues-to-file.md` (or `bedrock_issues_to_file.md`) must be updated with an entry containing:
     - Entry number and Markdown issue link (`[bedrock#<id>](https://...)`).
     - Discovery date.
     - Symptom & Impact descriptions.
     - Upstream fix required in Bedrock.
     - Applied local workaround in the consumer application.
   - **Deletion Rule:** An entry is deleted from the ledger **only** after the upstream Bedrock release tag is published **and** both pins in the consumer application have been upgraded and adopted.

### 4.3 Verification & Enforcement Gate
```bash
python -m bedrock.tools.audit_s014_ledger_freshness docs/reference/bedrock-issues-to-file.md
```
- **Exit 0:** All ledger entries cite active, open Bedrock issues, or explicitly record `fixed in bedrock vX.Y.Z`.
- **Exit 1:** Stale, unfiled, or closed issues found without recorded fixing release tags.

---

## 5. Ecosystem Tooling Architecture: `issue-triage` Skill Upgrade

### 5.1 Skill Overview
The `issue-triage` skill in `bedrock-ai-kit` (`c:\Dev\bedrock-ai-kit\skills\issue-triage\SKILL.md`) is upgraded to enforce `S014` and `S006` interactively.

### 5.2 Operating Modes
The skill guides users and autonomous agents through 5 distinct workflows:
1. **Mode A: Standard Defect (In-Scope):** Guides the 4-phase root-cause investigation, checks platform boundaries, and drafts `.github/ISSUE_TEMPLATE/defect.md`.
2. **Mode B: Out-of-Scope Defect Isolation:** Captures mid-task discoveries, validates that they are decoupled from the active branch, and drafts `.github/ISSUE_TEMPLATE/out_of_scope_bug.md`.
3. **Mode C: Feature / Task:** Enforces the platform boundary test (*A backend file belongs to the application iff it touches an application table*), identifies extension point types, and drafts `.github/ISSUE_TEMPLATE/feature_task.md`.
4. **Mode D: Grid Issue (7-Layer Audit):** Systematically walks the 7 grid layers (DB schema -> migrations -> Pydantic schema -> API routes -> TS interfaces -> runtime mapping -> display component), determining Bedrock engine vs. domain ownership, and drafts `.github/ISSUE_TEMPLATE/grid_issue.md`.
5. **Mode E: Cross-Repo Dual-Issue Protocol:**
   - Coordinates authoring the upstream Bedrock issue with `origin:<repo>` tagging.
   - Coordinates authoring the downstream application issue with `Blocked by bedrock#<id>` and pin bump requirements.
   - Formats the exact Markdown entry for `docs/reference/bedrock-issues-to-file.md`.
    - Runs `audit_s014_ledger_freshness` to verify ledger compliance.

### 5.3 Standards Harmonization
The skill and all agent configuration files (`CLAUDE.md`, `GEMINI.md`) will reference the canonical 3-digit padded platform standards:
- `§S001` (No Duplicate UI Code)
- `§S002` (All Grids Wired to Admin Config)
- `§S003` (Logging Protocol)
- `§S004` (No Hardcoded Config Settings)
- `§S005` (Test Coverage Mandatory)
- `§S006` (SDLC & PR Workflow)
- `§S007` (Schema Catalog)
- `§S008` (Documentation Layout & Naming)
- `§S009` (Design System Tokens)
- `§S010` (Granular Security Model)
- `§S011` (Config-Driven Navigation)
- `§S012` (Dual-Pin Platform Governance)
- `§S013` (API Standards & Admin Interactivity)
- `§S014` (Issue Logging & Ecosystem Governance)
- `§S100` (Domain Standard Authoring Guide)

### 5.4 Distribution Mechanics
- **Canonical Repository:** Maintained in `bedrock-ai-kit` at `skills/issue-triage/SKILL.md`.
- **Ecosystem Propagation:** Distributed to consumer workspaces (`CollectIt`, `MLBTracker`, `bedrock`) via directory junctions or `Sync-AgenticTooling.ps1`.

---

## 6. Implementation & Rollout Plan

1. **Platform Standards Updates (`c:\dev\bedrock\docs\standards/`)**:
   - Refactor `s006-defect-isolation-and-pr-workflow.md` -> `s006-sdlc-and-pr-workflow.md`.
   - Author `s013-api-standards.md`.
   - Author `s014-issue-logging-and-ecosystem-governance.md`.
   - Update `c:\dev\bedrock\docs\standards\README.md` to register `S013` and `S014`, and update `S006`.
2. **Ecosystem Tooling Updates (`c:\dev\bedrock-ai-kit\skills\issue-triage/`)**:
   - Update `SKILL.md` with the 5 operational modes, updated citations (`§S001`–`§S014`), and dual-issue templates.
3. **Consumer Standards Synchronization**:
   - Run `python -m bedrock.tools.sync_standards` across consumer repositories (`CollectIt`, `MLBTracker`).
4. **Verification**:
   - Execute `audit_s008_guidance` to ensure kebab-case doc compliance.
   - Run `audit_s013_api_docs` and `audit_s014_ledger_freshness` across repositories.
