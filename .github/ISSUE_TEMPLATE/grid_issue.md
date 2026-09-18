---
name: Grid Issue
about: Report a DataGrid or Admin Grid Editor issue across the 7-layer contract.
title: "[GRID] <Grid ID or Surface>: <Concise Summary>"
labels: ["type:grid", "area:ui"]
assignees: []
---

## Summary & Impact
- **Grid Identifier:** `<grid_id>`
- **Consumer Application:** `Bedrock Core` | `MLBTracker` | `CollectIt`
- **Affected Surface:** Admin Grid Editor | Presentational Grid | DataGrid Primitive
- **Severity:** Blocker | Critical | Normal | Low

## 7-Layer Contract Audit
- [ ] **Layer 1 (Database Schema):** Table, columns, and indexes verified.
- [ ] **Layer 2 (Migrations & Seeds):** Schema migrations, default fixtures, and `app_grid_configs` registered.
- [ ] **Layer 3 (Backend API / Pydantic):** Route handlers (`GET /api/v1/...`), filter/sort params, and response envelopes adhere to §S013.
- [ ] **Layer 4 (Grid Preview Endpoint):** Admin preview route registered and returning live/seed rows.
- [ ] **Layer 5 (TypeScript Models):** Column schema, interfaces, and field types aligned with backend models.
- [ ] **Layer 6 (State & Config Hooks):** `useGridConfig` runtime resolution and layout persistence intact (§S002).
- [ ] **Layer 7 (UI Component / Rendering):** `@djntechnic/bedrock-ui` `<DataGrid>` rendering, cell formatters, and theme tokens (§S001, §S009).

## Layer Ownership Breakdown
- **Platform Primitive (`bedrock`):** Hook logic, DataGrid engine, base styles, or cell selection.
- **Domain Consumption (Host App):** SQL queries, domain registries, and business schemas.

## Systematic Reproduction
1. **Reproduction Command / Step:** `<test command or UI navigation flow>`
2. **Observed Behavior:** `<error stack or visual layout failure>`
3. **Expected Behavior:** `<expected column rendering or mutation result>`

## Standards & Architectural Checklist
- [ ] Complies with §S001 (No duplicate UI; uses Bedrock primitives).
- [ ] Complies with §S002 (Wired via `useGridConfig` and `<DataGrid>`).
- [ ] Complies with §S013 (API envelopes and preview endpoint binding).
- [ ] Complies with §S014 (Issue taxonomy and cross-repo protocol).
