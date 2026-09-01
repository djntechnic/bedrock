---
name: Out-of-Scope Defect (S6)
about: Log a defect uncovered mid-task that is unrelated to the active feature scope and does not block it. Follows §S6 defect isolation.
title: "[P<phase>.<block>] <Title Summary Detail>"
labels: ["type:defect", "out-of-scope"]
assignees: []
---

<!--
  §S6 DEFECT ISOLATION CONTRACT.

  Use this ONLY for a defect found during a development/testing loop that is unrelated
  to the current feature scope and does not block completing the active requirement.
  Do NOT inline-patch such defects — log them here and preserve branch context.

  Title convention: [Phase Key].[Requirement Block] Title Summary Detail
-->

## Goal

<!-- One sentence: what fixing this bug accomplishes for platform baseline stability. -->

## Priority and Impact

- **Severity Score:** <!-- e.g., P2 Critical, P3 Moderate, P4 Minor -->
- **Operational Blast Radius:** <!-- How this affects compilation, build pipelines, or test runs -->
- **Decoupling Rationale:** <!-- Why it was safe to decouple from the current branch without regressions -->

## Reproducible Step Path & Root Cause

Steps to encounter and surface the defect:

1. Execute the reproduction command or test run:
   ```bash
   <exact terminal string>
   ```
2. Observe the trace log or error output:
   ```
   <Paste exact traceback, compiler error, or exception snippet>
   ```
3. **Initial Root-Cause Hypothesis:** <!-- What is the suspected origin/trigger point? -->

## Test Coverage Gaps & Remediation

- **The Coverage Deficit:** <!-- Why existing automated tests missed this failure state -->
- **Future Quality Gate Instruction:** <!-- The test/CI hook that must trap this going forward -->
- **Impacted Files Surface Map:** <!-- Files requiring changes under this fix -->
