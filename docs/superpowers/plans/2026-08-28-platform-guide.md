# Bedrock Platform Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a comprehensive, authoritative technical guide (`docs/platform_guide.md`) in the Bedrock repository to onboard and guide development teams working across Bedrock, CollectIt, and MLBTracker on architecture, boundaries, decision rubrics, dual-pin mechanics, and release workflows.

**Architecture:** Monolithic technical handbook in `docs/platform_guide.md` with 9 exhaustive sections covering invariants, ecosystem topology, change evaluation decision trees, backend/frontend contracts, dual-pin package dynamics, cross-repo dev loops, release cascading, consumer divergence matrices, and CI audit gates. Bedrock's root `README.md` and `CLAUDE.md` are updated to index the handbook.

**Tech Stack:** Markdown (GFM), Python (FastAPI), TypeScript/React, npm, pip/setuptools, Vite, Tailwind CSS v4, GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-08-28-platform-guide-design.md`](file:///C:/Dev/bedrock/docs/superpowers/specs/2026-08-28-platform-guide-design.md)

## Global Constraints

- Bedrock holds **zero** domain vocabulary or business logic (no cards, listings, players, teams, pricing).
- A backend file belongs to the host app iff it touches an application table.
- All extension point registrations must be eager module-import side-effects (`import api.domain`), never inside lifespan hooks.
- Dual pins must name the exact same git release tag (`v0.X.X`) across `requirements.txt` and `package.json`.
- All SQL parameter placeholders must use `%s`, never `?`.

---

## Agent & Model Allocation Guide

| Task Type | Recommended Models | Thinking Level | Rationale |
| :--- | :--- | :--- | :--- |
| **Comprehensive Handbook Authoring (Task 1)** | Sonnet 3.7 / Opus 4.6 / Gemini 3.1 Pro | **High** | Requires deep cross-repository architectural synthesis, technical writing rigor, exact syntax, and nuanced multi-repo contract mapping. |
| **Index & Navigation Integration (Task 2)** | Gemini 3.7 Flash / Claude 3.5 Sonnet | **Medium** | Focused file edits with strict line ceilings and reference management (e.g. keeping `CLAUDE.md` under 200 lines). |
| **Verification & Link Auditing (Task 3)** | Gemini 3.5/3.6/3.7 Flash | **Low** | Fast mechanical validation, path checking, link reconciliation, and markdown syntax verification. |

---

## Tasks

### Task 1: Author the Comprehensive Platform Guide (`docs/platform_guide.md`)

**Recommended Agent:** Claude 3.7 Sonnet / Opus 4.6 / Gemini 3.1 Pro (Thinking: High)  
**Files:**
- Create: `docs/platform_guide.md`

**Interfaces:**
- Consumes: [`docs/superpowers/specs/2026-08-28-platform-guide-design.md`](file:///C:/Dev/bedrock/docs/superpowers/specs/2026-08-28-platform-guide-design.md), [`CollectIt/docs/reference/bedrock.md`](file:///c:/dev/CollectIt/docs/reference/bedrock.md), [`MLBTracker/docs/reference/bedrock.md`](file:///c:/dev/MLBTracker/docs/reference/bedrock.md), [`docs/extension_points.md`](file:///C:/Dev/bedrock/docs/extension_points.md), [`docs/app_assembly.md`](file:///C:/Dev/bedrock/docs/app_assembly.md), [`docs/roadmap.md`](file:///C:/Dev/bedrock/docs/roadmap.md)
- Produces: The primary technical handbook for all Bedrock ecosystem developers.

- [ ] **Step 1: Write `docs/platform_guide.md`**

Create `docs/platform_guide.md` with complete content across all 9 sections:
1. Executive Summary & Core Platform Invariant (Zero domain logic, table ownership test, safe degradation).
2. The Repository Ecosystem (Bedrock, CollectIt, MLBTracker, extraction history, consumer independence).
3. Change Evaluation Rubric & Decision Matrix (Visual flowchart, Rule of Two against premature generalization, Registry vs Provider vs Dotted-path matrix).
4. Backend Platform Architecture & Lifespan Contract (`create_app` factory, boot sequence, hook purposes, eager import side-effect invariant).
5. Frontend Platform Architecture & Build System (Barrel import contract `@djntechnic/bedrock-ui`, `<DataGrid>` subsystem, design tokens `tokens.css`, Vite config, Tailwind v4 `@source` scanning).
6. The Dual-Pin Dependency Contract (Simultaneous git tag pinning, repo-root npm packaging layout, `prepare` build step, lockfile traps, audit rules).
7. Cross-Repository Development & Release Lifecycle (Local editable pip installs, strict land order: Bedrock first $\to$ `/cut-release` $\to$ Cascade GitHub Action $\to$ `## For consumers` $\to$ `/bump-bedrock-pin` downstream $\to$ boarded/declined).
8. Consumer Profiles & Divergence Matrix (CollectIt vs MLBTracker: deliberate absences vs legacy residue, season resolver, dashboard pin host, storage provider nuances).
9. Guardrails, Common Pitfalls & Audit Gates (SQL `%s` rule, schema drift union verification, `audit_bedrock_pins.py`, `audit_s1_duplicates.py`, `audit_design_tokens.py`, `audit_api_docs.py`).

- [ ] **Step 2: Verify markdown formatting and structure**

Run verification check to ensure no placeholder tags (`TODO`, `TBD`), all code snippets are syntax-highlighted, and markdown headers are properly nested.

- [ ] **Step 3: Commit**

```bash
git add docs/platform_guide.md
git commit -m "docs: create comprehensive cross-repository platform guide"
```

---

### Task 2: Update Bedrock Index and Reference Documentation

**Recommended Agent:** Gemini 3.7 Flash / Claude 3.5 Sonnet (Thinking: Medium)  
**Files:**
- Modify: `CLAUDE.md:115-125`
- Modify: `README.md:25-35`

**Interfaces:**
- Consumes: `docs/platform_guide.md`
- Produces: Updated navigation index in `CLAUDE.md` and `README.md` pointing developers directly to `docs/platform_guide.md`.

- [ ] **Step 1: Update `CLAUDE.md`**

In `CLAUDE.md` under `## Reference Docs`, add `docs/platform_guide.md` as the primary cross-repository handbook while respecting the 200-line hard ceiling of `CLAUDE.md`.

- [ ] **Step 2: Update `README.md`**

In `README.md`, add reference links to `docs/platform_guide.md` under `## Assembling an application` and `## The contract`.

- [ ] **Step 3: Verify line limit in `CLAUDE.md`**

Run: `wc -l CLAUDE.md` (or equivalent line count script) to confirm `CLAUDE.md` is strictly under 200 lines.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: reference platform guide in CLAUDE.md and README.md"
```

---

### Task 3: Cross-Reference Verification and Validation

**Recommended Agent:** Gemini 3.5/3.6/3.7 Flash (Thinking: Low)  
**Files:**
- Verify: `docs/platform_guide.md`, `CLAUDE.md`, `README.md`, `docs/superpowers/specs/2026-08-28-platform-guide-design.md`

**Interfaces:**
- Consumes: All updated docs
- Produces: Verified link graph and documentation consistency.

- [ ] **Step 1: Check internal links and paths**

Verify that all referenced doc paths (`docs/extension_points.md`, `docs/app_assembly.md`, `docs/deployment.md`, `docs/roadmap.md`, `docs/media.md`, `docs/mail.md`) resolve accurately.

- [ ] **Step 2: Verify code syntax and tables**

Inspect markdown rendering of tables, code blocks (`python`, `typescript`, `json`, `bash`), and decision trees.

- [ ] **Step 3: Commit any minor polishing**

```bash
git add docs/
git commit -m "docs: polish cross-repository references and platform guide links"
```
