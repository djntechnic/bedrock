# Unified Issue Tracking & Triage Architecture Design

**Date:** 2026-09-01  
**Status:** Approved  
**Scope:** `djntechnic/bedrock`, `djntechnic/CollectIt`, `djntechnic/MLBTracker`, `claude-kit`

---

## 1. Problem Statement & Motivation

The `bedrock` platform ecosystem powers multiple downstream applications (`CollectIt`, `MLBTracker`). While `CollectIt` and `MLBTracker` have partially implemented GitHub issue templates, there are critical gaps across the ecosystem:

1. **Missing Platform Templates in `bedrock`**: `bedrock` lacks an `.github/ISSUE_TEMPLATE/` directory, `config.yml`, and `PULL_REQUEST_TEMPLATE.md`.
2. **Defect vs. Feature Confusion**: Neither `CollectIt` nor `MLBTracker` contains a standard in-scope defect template. Bugs are shoehorned into `feature_task.md` (which lacks diagnostic fields) or filed into `out_of_scope_bug.md` (§S6 defect isolation).
3. **Lack of Root-Cause Discipline**: Issues are frequently filed with surface-level symptoms rather than root-cause investigations. A junior engineer or automated agent picking up the issue must re-investigate the failure from scratch.
4. **Platform Boundary Visibility**: Grid issues and architectural changes in consumer repos frequently touch `bedrock`, but lack explicit cross-repo boundary traceability.

---

## 2. Architecture & Components

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         claude-kit: dev-doctrine                               │
│                         /issue-triage Skill                                    │
│                                                                                │
│   ┌─────────────────────────────┐        ┌────────────────────────────────┐    │
│   │   Defect / Bug Workflow     │        │  Feature / Refactor Workflow   │    │
│   │  (embeds systematic-debug)  │        │     (embeds brainstorming)     │    │
│   └──────────────┬──────────────┘        └───────────────┬────────────────┘    │
└──────────────────┼───────────────────────────────────────┼─────────────────────┘
                   │                                       │
                   ▼                                       ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                   Target Repository GitHub Template Suite                      │
│            (bedrock, CollectIt, MLBTracker without modifying ci.yml)           │
│                                                                                │
│  ├── .github/ISSUE_TEMPLATE/                                                   │
│  │   ├── config.yml            (prohibits blank issues, links CLAUDE.md)       │
│  │   ├── defect.md             (in-scope defect with root-cause breakdown)     │
│  │   ├── feature_task.md       (feature/enhancement with boundary check)       │
│  │   ├── out_of_scope_bug.md   (§S6 isolation for mid-task discoveries)        │
│  │   └── grid_issue.md         (7-layer DataGrid contract; CollectIt/MLB)      │
│  └── .github/PULL_REQUEST_TEMPLATE.md (tailored standards & quality gates)     │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Template Specifications

### 3.1 `config.yml`

Deployed across `bedrock`, `CollectIt`, and `MLBTracker`.

- Sets `blank_issues_enabled: false`.
- Provides contact links to the repository's `CLAUDE.md` non-negotiable standards.

### 3.2 `defect.md` (Standard Defect / In-Scope Bug)

Embedded with the 4 phases of `systematic-debugging`:

- **Title format**: `[P<phase>.<block>] <Concise Defect Summary>`
- **Labels**: `["type:defect"]`
- **Sections**:
  1. `## Goal`: One-sentence summary of the fix's outcome.
  2. `## Severity & Blast Radius`: Severity rating (P1–P4), affected environments, regression status.
  3. `## Reproduction Path`:
     - Clean execution command / test invocation.
     - Expected Behavior vs. Observed Behavior.
     - Raw error footprints, exception traces, or HTTP response payloads.
  4. `## Root Cause Analysis (systematic-debugging Phase 1 & 2)`:
     - **Origin Point & Call Stack**: Exact file path and line number where invalid state originates.
     - **Data Flow / Component Boundary**: Tracing data flow across boundaries (API → schema validation → service → DB).
     - **Pattern Analysis**: Comparison with working reference implementations.
  5. `## Proposed Resolution & Hypothesis (systematic-debugging Phase 3)`:
     - Minimal root cause fix hypothesis (avoiding symptom masking).
     - Platform boundary assessment (is this domain-only or does it require a `bedrock` update?).
  6. `## Files Impacted & Test Contract (Phase 4)`:
     - Explicit list of files and expected changes.
     - Failing test requirements (happy path, edges, nulls, error states).
  7. `## Success Criteria`:
     - Testable checklist for `/implement-issue` (Pytest, Vitest, `tsc -b`, structured logging).

### 3.3 `out_of_scope_bug.md` (§S6 Defect Isolation)

Maintains the contract for defects discovered mid-task:

- **Title format**: `[P<phase>.<block>] <Title Summary Detail>`
- **Labels**: `["type:defect", "out-of-scope"]`
- **Sections**:
  1. `## Goal`: Baseline fix outcome.
  2. `## Priority & Decoupling Rationale`: Why it is safe to decouple from the current branch.
  3. `## Systematic Reproduction & Trace`: Exact terminal string and traceback.
  4. `## Root Cause Hypothesis & Test Gap`: Why existing tests missed it and proposed remediation.
  5. `## Impacted Files Surface Map`: Target files.

### 3.4 `feature_task.md` (Feature / Enhancement / Refactor)

- **Title format**: `[P<phase>.<block>] <Concise Title Summary Detail>`
- **Labels**: `["type:feature"]`
- **Sections**:
  1. `## Goal`: What this delivers and why it matters.
  2. `## Context & Requirements`: User stories, constraints, and architecture decisions (Registry vs Provider).
  3. `## Platform Boundary Validation`: Verification of domain vs. platform (`bedrock`) ownership.
  4. `## Files Impacted`: Expected file mutation map.
  5. `## Success Criteria`: Verifiable checklist for `/implement-issue`.

### 3.5 `grid_issue.md` (CollectIt & MLBTracker)

- Standardized across the 7 layers:
  1. DB Schema (`schema_sqlite.sql` / `schema.sql`)
  2. Migration (`migrations/` / `bedrock/core/migrations.py`)
  3. Pydantic Schemas (`api/schemas/admin.py`)
  4. API GET / PATCH (`api/routes/admin.py`)
  5. TypeScript Interface (`useAdmin.ts`)
  6. Runtime Mapping (`buildGridConfig` in `useGridConfig.ts`)
  7. Consumers (DataGrid Display + Admin Editor)
- Highlights bedrock architecture ownership: Any changes to `<DataGrid>` or `useGridConfig` engine logic must land in `bedrock` first.

### 3.6 `PULL_REQUEST_TEMPLATE.md`

Standardized across all three repositories with customized standards (§S1–S9) and test commands appropriate for each repo, leaving existing `.github/workflows/ci.yml` files completely untouched.

---

## 4. New Skill Specification: `/issue-triage`

**Path:** `c:\dev\claude-kit\plugins\dev-doctrine\skills\issue-triage\SKILL.md`

### 4.1 Metadata

```yaml
---
name: issue-triage
description: "Triage and author high-detail GitHub issues across the bedrock ecosystem. Enforces systematic-debugging for defects and brainstorming for enhancements so tasks are ready for junior engineer hand-off."
category: workflow
tags: [issues, triage, systematic-debugging, brainstorming, bedrock]
---
```

### 4.2 Behavior & Execution Pipeline

1. **Intake & Classification**:
   - Determine issue intent: `defect` (in-scope or standalone), `out-of-scope-defect` (§S6), `feature-task`, or `grid-issue`.
2. **Defect Triage Routine (`systematic-debugging`)**:
   - **Phase 1: Investigation**: Must extract full stack trace, examine git diffs, locate the exact file/line where invalid state originates.
   - **Phase 2: Pattern Analysis**: Locate working references in the repo.
   - **Phase 3: Formulate Resolution**: Formulate a single, minimal root-cause fix hypothesis.
   - **Phase 4: Test Specification**: Define the exact failing test needed.
3. **Enhancement Triage Routine (`brainstorming`)**:
   - Refines goals, scope boundaries, and architectural patterns (Registry vs. Provider).
4. **Platform Boundary Verification**:
   - Evaluates whether the change belongs in `bedrock` or the host consumer (`CollectIt` / `MLBTracker`).
5. **Issue Generation**:
   - Pre-populates the chosen GitHub markdown template with complete, high-fidelity data.
   - Outputs the formatted markdown or writes/creates the issue via MCP GitHub tools if requested.

---

## 5. Verification Plan

1. **File Existence & Syntax**: Verify that all templates in `bedrock/.github`, `CollectIt/.github`, `MLBTracker/.github`, and `claude-kit` have valid frontmatter and formatting.
2. **Workflow Integrity**: Confirm zero modifications were made to `.github/workflows/ci.yml` across all repositories.
3. **Audit Script Compatibility**: Run `python scripts/maintenance/audit_guidance.py` and `python scripts/maintenance/check_claude_md_length.py` in `CollectIt` and `MLBTracker` to confirm clean maintenance audits.
