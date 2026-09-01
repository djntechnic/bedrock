---
name: Defect / Bug
about: Report a platform bug with verified root-cause analysis, reproduction steps, and proposed resolution for engineer hand-off.
title: "[P<phase>.<block>] <Concise Defect Summary>"
labels: ["type:defect"]
assignees: []
---

<!--
  CANONICAL DEFECT WORK-ITEM CONTRACT.
  
  Governed by: dev-doctrine/issue-triage & systematic-debugging.
  Title convention: [Phase Key].[Requirement Block] Concise Defect Summary
    e.g. "[P5.02] Fix sqlite date serialization in audit log middleware"

  Issue numbering: new tickets take Max(existing issue # in active phase) + 1.
  Labels: apply priority:P1|P2|P3|P4, type:defect, and relevant module label.

  Every defect must have Phase 1 (Root Cause) completed before filing.
  Do NOT submit surface-level symptoms without origin tracing.
-->

## Goal

<!-- One sentence: what fixing this defect accomplishes for platform baseline stability. -->

## Severity & Blast Radius

- **Priority:** <!-- P1 Critical · P2 Major · P3 Normal · P4 Minor -->
- **Affected Surface:** <!-- bedrock-api, @djntechnic/bedrock-ui, schema migrations, admin engine -->
- **Consumer Blast Radius:** <!-- Will downstream apps (CollectIt, MLBTracker) fail on install, build, or runtime? -->

## Systematic Reproduction

<!-- Exact, deterministic steps to reproduce the defect. -->

1. Execute the reproduction command or test case:
   ```bash
   <exact terminal command, test invocation, or curl script>
   ```
2. **Observed Behavior:**
   ```
   <Paste exact error stack trace, HTTP error code, or unexpected output>
   ```
3. **Expected Behavior:**
   <!-- Exact expected output, return type, or clean execution status -->

## Root Cause Analysis (systematic-debugging Phase 1 & 2)

- **Origin Point:** `packages/bedrock-.../path/to/file.py:Lxx` (function/method name)
- **Data Flow & Boundary Breakdown:**
  <!--
    Trace data flow backward from failure point to corrupted origin.
    e.g. "Route /admin/logs receives ISO string -> schema parses correctly -> DB adapter assumes datetime object -> fails sqlite serialization."
  -->
- **Pattern Comparison:**
  <!-- Compare against a working reference in bedrock or standard practice. What is different? -->

## Proposed Resolution & Hypothesis (systematic-debugging Phase 3)

<!--
  The minimal, direct root-cause fix. Fix at source, never patch symptoms.
-->

- **Fix Hypothesis:** 
- **Platform vs Consumer Impact:** <!-- Is this an internal fix behind stable export or a breaking surface change? -->

## Files Impacted & Test Specification (Phase 4)

<!-- Target files to modify and failing test contract to implement before fixing. -->

- `path/to/file` — what changes and why
- **Failing Test Case to Add:**
  - File: `tests/...` or `packages/bedrock-ui/src/...test.tsx`
  - Scenarios: Happy path, edge cases, null/empty state, invalid inputs

## Success Criteria

- [ ] Failing test case created and verified failing before fix
- [ ] Root-cause fix implemented cleanly
- [ ] Backend tests green: `cd packages/bedrock-api && pytest`
- [ ] Frontend tests green: `npm test` from root (Vitest)
- [ ] Frontend type check clean: `npm run typecheck` (`tsc -b --noEmit`)
- [ ] No `console.*` / `print()` — structured Pino/Loguru logging only
- [ ] CHANGELOG updated if breaking export or consumer-facing contract
