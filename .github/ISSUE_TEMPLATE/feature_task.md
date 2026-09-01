---
name: Feature / Task
about: Standard scoped platform work item — a new capability, enhancement, or architectural refactor in bedrock.
title: "[P<phase>.<block>] <Concise Title Summary Detail>"
labels: ["type:feature"]
assignees: []
---

<!--
  CANONICAL PLATFORM WORK-ITEM CONTRACT.

  Governed by: dev-doctrine/issue-triage & superpowers/brainstorming.
  Title convention: [Phase Key].[Requirement Block] Title Summary Detail
    e.g. "[P5.01] Dynamic Navigation Registry — admin CRUD and visibility filter"

  Issue numbering: new tickets take Max(existing issue # in active phase) + 1.
  Labels: apply priority:P1|P2|P3|P4, type:feature, and relevant package label.
-->

## Goal

<!-- One or two sentences: what this delivers for the platform foundation and why it matters. -->

## Context & Brainstorming Summary

<!--
  The motivation, architectural context, and background.
  Link to design doc if architectural (e.g., docs/superpowers/specs/YYYY-MM-DD-*.md).
  Be concrete — quote components, hooks, routes, and schemas.
-->

## Platform Boundary Validation

<!-- Apply the platform boundary test before proceeding: -->
- [ ] **No Domain Logic**: Contains zero business domain code (no trading cards, baseball stats, etc.).
- [ ] **Extension Point Check**:
  - [ ] **Registry** (Additive contributions, e.g. health counters, nav entries)
  - [ ] **Provider** (Single implementation active via app_config_settings)
  - [ ] **Not Applicable** (Core UI component / internal engine)

## Files Impacted

<!-- Every file you expect to touch, each with a short note on the change. -->

- `packages/bedrock-api/...` — what changes and why
- `packages/bedrock-ui/src/...` — what changes and why

## Success Criteria

<!-- A checklist of verifiable, testable outcomes. -->

- [ ] Platform behavior implemented and verified
- [ ] Backend tests cover new behavior: `pytest` in `packages/bedrock-api`
- [ ] Frontend tests cover new behavior: `npm test` from repo root
- [ ] `npm run typecheck` clean (`tsc -b --noEmit`)
- [ ] Structured logging only: Pino (`log`) in UI, Loguru in API
- [ ] Extension points documented in `docs/extension_points.md` if applicable
- [ ] Breaking changes called out in `CHANGELOG.md`
