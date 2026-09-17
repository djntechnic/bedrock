---
id: S014
title: "Issue Logging & Ecosystem Governance"
status: active
tier: platform
enforced_by: bedrock.tools.audit_ledger_freshness
cli_command: "python -m bedrock.tools.audit_ledger_freshness docs/reference/bedrock_issues_to_file.md"
---

# Standard S014: Issue Logging & Ecosystem Governance

## Purpose & Objective

Vague, symptom-only bug reports ("X crashed with error Y") waste engineering capacity by forcing the next contributor or autonomous agent to repeat root-cause discovery from scratch. Furthermore, when issues cross the boundary between platform primitives and consumer applications, uncoordinated tracking results in orphaned workarounds, unadopted upstream fixes, and broken dependency pins.

Standard S014 establishes a closed, rigorous protocol for authoring, triaging, and coordinating work items across Bedrock (`djntechnic/bedrock`), consumer applications (`djntechnic/MLBTracker`, `djntechnic/CollectIt`), and ecosystem tooling (`djntechnic/bedrock-ai-kit`). It separates work-item governance from code modification lifecycles (governed by S006), enforces root-cause investigations before ticket submission, mandates out-of-scope bug decoupling, and formalizes the cross-repository dual-issue protocol.

## Non-Negotiable Invariants

1. **Closed Issue Taxonomy & GitHub Templates:** Every work item filed in the Bedrock ecosystem must strictly adhere to one of four canonical GitHub issue templates:
   - **Standard Defect (`.github/ISSUE_TEMPLATE/defect.md`):** Active in-scope bugs, regressions, or production defects.
   - **Out-of-Scope Defect (`.github/ISSUE_TEMPLATE/out_of_scope_bug.md`):** Non-blocking bugs discovered mid-task that are unrelated to the active branch scope.
   - **Feature / Task (`.github/ISSUE_TEMPLATE/feature_task.md`):** New functional capabilities, refactors, schema migrations, or config additions.
   - **Grid Issue (`.github/ISSUE_TEMPLATE/grid_issue.md`):** Bugs, gaps, or extensions across the 7-layer data grid contract.
   *Free-form, untyped, or template-less issues are strictly prohibited.*
2. **Mandatory 4-Phase Root Cause Analysis:** A defect issue must not be opened until Phases 1 & 2 of systematic debugging are completed. Submitting an issue that describes only observed symptoms without an origin trace is a doctrine violation:
   - **Phase 1 (Origin & Trace):** Identify exact file path and line number where invalid state originates. Provide a copy-paste reproduction command (`pytest tests/...`, `npm run test:run`, curl, CLI). Trace data flow backward across layer boundaries to the mutation point.
   - **Phase 2 (Pattern Analysis):** Compare the broken implementation against working reference patterns in the repository. Identify discrepancies in configuration, environment, dependencies, or schema.
   - **Phase 3 (Root-Cause Hypothesis):** Formulate a minimal, source-level fix hypothesis (symptom-patching is banned). Verify platform boundaries: does the fix belong in domain code or platform packages (`bedrock-api` / `@djntechnic/bedrock-ui`)?
   - **Phase 4 (Test Specification Contract):** Specify target test file, input scenarios, expected outputs, and edge cases (null, empty, boundary values) to implement before applying the fix.
3. **Out-of-Scope Defect Isolation Rule:** Any unrelated defect discovered during active task execution that does not block current deliverables must **never be patched inline**. Inline fixes violate one-branch-one-concern (§S006). The defect must be immediately documented and decoupled via `.github/ISSUE_TEMPLATE/out_of_scope_bug.md`, and the active feature branch must proceed without delay. An out-of-scope filing can never be used to bypass a currently failing test in the active PR diff.
4. **Cross-Repository Dual-Issue Protocol:** When a work item spans domain application code and Bedrock platform primitives:
   - **Upstream Bedrock Ticket (`djntechnic/bedrock`):** Must be strictly domain-agnostic (zero baseball, collectibles, or domain tables). Tagged with `origin:<repo>` (e.g. `origin:mlbtracker`, `origin:collectit`) and `bug` or `enhancement`. Details impacted platform files in `packages/bedrock-api` or `packages/bedrock-ui`, platform boundary validation, extension point classification (`Registry` vs `Provider` vs `N/A`), and reproduction test contracts.
   - **Downstream Application Ticket (`djntechnic/<app>`):** Specifies application-side domain wiring, extension point registration, seed migrations, and test fixtures. Explicitly states `Blocked by djntechnic/bedrock#<id>` and tracks the dual-pin upgrade (`/bump-bedrock-pin <tag>`).
   - **Consumer Ledger Tracking:** The consumer repository must immediately record an entry in `docs/reference/bedrock-issues-to-file.md` containing entry number, Markdown issue link (`[bedrock#<id>](https://...)`), discovery date, symptom, impact, upstream fix required, and applied local workaround.
   - **Ledger Deletion Invariant:** A ledger entry is removed **only** after the upstream Bedrock release tag is published **and** both pins have been upgraded and adopted downstream.

## Architecture & Code Contracts

### Consumer Ledger Entry Contract:
```markdown
## 14. `AppSidebar` ignores `item.tooltip` from dynamic nav settings

- **Status:** Fixed in bedrock v0.9.2.
- **Found:** 2026-09-05, during punchlist review of menu navigation tooltip overrides.
- **Symptom:** In `AppSidebar.tsx`, the collapsed rail mode hardcodes `{disabled ? ... : item.label}`, ignoring `item.tooltip`.
- **Impact:** Custom tooltips configured via `tooltip_override` in `app_nav_item_settings` are omitted from the sidebar.
- **Fix in bedrock:** In `packages/bedrock-ui/src/components/AppSidebar.tsx`, render `item.tooltip` in collapsed `<TooltipContent>` and pass `title={item.tooltip}` on links.
- **MLBTracker workaround (applied):** Tooltip overrides remain configured in `app_nav_item_settings`; awaiting upstream Bedrock release to display.
- **Filed:** [bedrock#75](https://github.com/djntechnic/bedrock/issues/75).
```

### Upstream Bedrock Issue Header Contract:
```markdown
---
name: Bedrock Defect / Enhancement
about: Platform issue originating from a consumer repository.
title: "[<Component>] <Concise Platform Capability or Fix>"
labels: ["origin:mlbtracker", "type:defect"]
---

## Goal
<!-- Concise platform mechanism or bug fix to deliver -->

## Platform Boundary Validation
- [x] No Domain Logic (zero application tables referenced)
- [x] Extension Point Classification: Registry | Provider | Core Component
- [x] Applicable across multiple consumer applications
```

### Downstream Application Issue Header Contract:
```markdown
---
name: Consumer Domain Adoption
about: Consume upstream Bedrock feature or bug fix.
title: "[P<phase>.<block>] Adopt Bedrock <Feature/Fix>"
labels: ["type:enhancement", "bedrock-dependency"]
---

## Goal
Adopt upstream Bedrock capability once published.

**Dependency:** Blocked by djntechnic/bedrock#75 (Target Release: v0.9.2).
**Pin Upgrade:** Requires `/bump-bedrock-pin v0.9.2`.
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s014]
exemptions = [
  "docs/**",           # Documentation adjustments not requiring formal defect tracking
]
```

Emergency production hotfixes resolving active catastrophic operational outages (P1 Critical: data corruption, security breach) may bypass preliminary issue authoring provided an incident issue is retroactively opened and linked in the post-mortem within 24 hours.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_ledger_freshness docs/reference/bedrock_issues_to_file.md
```

- **Exit 0:** All ledger entries cite active, open Bedrock issues, or explicitly record the release tag that resolved them (`fixed in bedrock vX.Y.Z`).
- **Exit 1:** An entry lacks an upstream issue reference (`unfiled`), or references a closed Bedrock issue without recording the fixing release tag.
