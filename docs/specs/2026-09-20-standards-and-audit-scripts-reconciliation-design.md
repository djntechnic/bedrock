# Standards & Audit Scripts Reconciliation Design

**Date:** 2026-09-20  
**Status:** Approved  
**Topic:** Reconciling `docs/standards/` S001–S014, S100 with `bedrock.tools`, `scripts/audit/`, and Deploying Across Ecosystem (`bedrock`, `bedrock-ai-kit`, `CollectIt`, `MLBTracker`)

---

## 1. Executive Summary

Bedrock platform standards (§S001–§S014, §S100) define non-negotiable architectural and engineering contracts.

This design reconciles standards documents and audit scripts, and defines the multi-repository deployment plan across the entire Bedrock ecosystem:
1. **Script Naming Standard:** Standardize all audit Python scripts to the number-first snake_case pattern **`s###_audit_[description].py`** (ensuring valid Python module imports and CLI entry points).
2. **Dual Layer Placement:** 
   - Platform audit source code lives in `packages/bedrock-api/bedrock/tools/s###_audit_[description].py` so downstream repos receive them via `pip install bedrock-api`.
   - Executable 1:1 runner shims live in `scripts/audit/s###_audit_[description].py` in Bedrock.
3. **Consolidate & Prune Legacy Duplicates:**
   - Merge missing checks (direct `axios` import ban, `@shadows <Name>` annotation parsing, `@djntechnic/bedrock-ui` collision detection) from `audit_s1_duplicates.py` into `s001_audit_duplicates.py`, then delete `audit_s1_duplicates.py`.
   - Delete legacy unpadded `audit_design_tokens.py` in favor of `s009_audit_design_tokens.py`.
   - Implement the missing S100 audit `s100_audit_domain_registry.py` (and matching runner shim) to mechanically enforce standards authoring and domain standard numbering.
4. **Multi-Repository Deployment:**
   - **`bedrock`:** Core implementation, runner shims, updated `run_all.py`, updated `run_qa.py`, and test suite.
   - **`bedrock-ai-kit`:** Update mirrored rules in `rules/`, align ecosystem sync scripts (`Sync-AgenticTooling.ps1`, `Audit-AgenticTooling.ps1`), and verify ecosystem lifecycle hooks.
   - **`CollectIt`:** Sync updated platform standards `S001`–`S014`, `S100`; standardize domain audit naming in `scripts/audit/` (`s101_audit_...`, `s102_audit_...`, `s103_audit_...`); verify `run_qa.py` and `run_audit.ps1`.
   - **`MLBTracker`:** Sync updated platform standards `S001`–`S014`, `S100`; standardize domain audit in `scripts/audit/s101_audit_stat_invariants.py`; verify `run_qa.py` and `run_audit.ps1`.
5. **Evolution Documentation:** Document formal lifecycle rules and checklists for authoring future platform (`S0##`) and domain (`S1##`) standards.

---

## 2. File Layout & 1:1 Parity Matrix

Every standard in `docs/standards/` pairs 1:1 with an audit module in `packages/bedrock-api/bedrock/tools/` and a runner shim in `scripts/audit/`.

| Standard ID | Standard Markdown (`docs/standards/`) | Bedrock Tool Module (`bedrock.tools`) | Root Runner Shim (`scripts/audit/`) |
| :--- | :--- | :--- | :--- |
| **S001** | `s001-no-duplicate-ui-code.md` | `s001_audit_duplicates.py` | `s001_audit_duplicates.py` |
| **S002** | `s002-all-grids-wired-to-admin-config.md` | `s002_audit_grids.py` | `s002_audit_grids.py` |
| **S003** | `s003-logging-protocol.md` | `s003_audit_logging.py` | `s003_audit_logging.py` |
| **S004** | `s004-no-hardcoded-config-settings.md` | `s004_audit_config.py` | `s004_audit_config.py` |
| **S005** | `s005-test-coverage-mandatory.md` | `s005_audit_testing.py` | `s005_audit_testing.py` |
| **S006** | `s006-sdlc-and-pr-workflow.md` | `s006_audit_pr_workflow.py` | `s006_audit_pr_workflow.py` |
| **S007** | `s007-schema-catalog.md` | `s007_audit_schema_catalog.py` | `s007_audit_schema_catalog.py` |
| **S008** | `s008-documentation-layout-and-naming.md` | `s008_audit_guidance.py` | `s008_audit_guidance.py` |
| **S009** | `s009-design-system.md` | `s009_audit_design_tokens.py` | `s009_audit_design_tokens.py` |
| **S010** | `s010-granular-security-model.md` | `s010_audit_security.py` | `s010_audit_security.py` |
| **S011** | `s011-config-driven-navigation.md` | `s011_audit_navigation.py` | `s011_audit_navigation.py` |
| **S012** | `s012-dual-pin-platform-governance.md` | `s012_audit_pins.py` | `s012_audit_pins.py` |
| **S013** | `s013-api-standards.md` | `s013_audit_api_docs.py` | `s013_audit_api_docs.py` |
| **S014** | `s014-issue-logging-and-ecosystem-governance.md` | `s014_audit_ledger_freshness.py` | `s014_audit_ledger_freshness.py` |
| **S100** | `s100-domain-standard-authoring.md` | `s100_audit_domain_registry.py` | `s100_audit_domain_registry.py` |

### Runner Shim Template (`scripts/audit/s###_audit_[name].py`)
```python
#!/usr/bin/env python
"""Runner shim for Standard S### audit."""
import sys
from bedrock.tools.s001_audit_duplicates import main

if __name__ == "__main__":
    sys.exit(main())
```

---

## 3. Duplicate Reconciliation & Logic Consolidation

### 3.1 S001 Consolidation (`audit_s1_duplicates.py` -> `s001_audit_duplicates.py`)
`audit_s1_duplicates.py` contained essential invariants missing from `audit_s001_duplicates.py`. We merge these into `s001_audit_duplicates.py` using `AuditReporter`:
1. **Direct Axios Import Ban:** Detects bare `axios` imports in UI sources; mandates using platform `apiClient`.
2. **`@shadows <Name>` Annotation:** Exempts deliberate local component forks when accompanied by a machine-readable `@shadows` header.
3. **Collision with `@djntechnic/bedrock-ui`:** Inspects installed bedrock-ui export barrel to detect unshadowed local collisions in component/page directories.
4. **Pruning:** Remove `packages/bedrock-api/bedrock/tools/audit_s1_duplicates.py` and merge tests into `test_audit_s001_to_s004.py`.

### 3.2 S009 Reconciliation (`audit_design_tokens.py` -> `s009_audit_design_tokens.py`)
`s009_audit_design_tokens.py` is the official standard implementation using `AuditReporter`. Delete `audit_design_tokens.py` and update `test_audit_design_tokens.py` to target `s009_audit_design_tokens`.

### 3.3 S100 Implementation (`s100_audit_domain_registry.py`)
Implement `s100_audit_domain_registry.py` with `AuditReporter`:
- Validates all standards in `docs/standards/`:
  - `S001`–`S099` (and `S100`) must declare `tier: platform`.
  - `S101`–`S199` must declare `tier: domain`.
  - Frontmatter must include: `id`, `title`, `status`, `tier`, `enforced_by`, `cli_command`.
  - Standard markdown must include the 5 mandatory sections.
- Accompanied by unit tests in `packages/bedrock-api/tests/test_audit_s100_domain_registry.py`.

---

## 4. Orchestrator, Runner, and Test Suite Updates

### 4.1 Suite Orchestrator (`packages/bedrock-api/bedrock/tools/run_all.py`)
Update `AUDIT_MODULES` to explicitly import and dispatch all 15 audit modules:
```python
AUDIT_MODULES: list[tuple[str, _AuditModule]] = [
    ("s001", s001_audit_duplicates),
    ("s002", s002_audit_grids),
    ("s003", s003_audit_logging),
    ("s004", s004_audit_config),
    ("s005", s005_audit_testing),
    ("s006", s006_audit_pr_workflow),
    ("s007", s007_schema_catalog),
    ("s008", s008_audit_guidance),
    ("s009", s009_audit_design_tokens),
    ("s010", s010_audit_security),
    ("s011", s011_audit_navigation),
    ("s012", s012_audit_pins),
    ("s013", s013_audit_api_docs),
    ("s014", s014_audit_ledger_freshness),
    ("s100", s100_audit_domain_registry),
]
```

### 4.2 Local QA Runner (`scripts/run_qa.py`)
`run_qa.py` invokes `python -m bedrock.tools.run_all --root .` under full/audit mode, automatically executing the complete 15-audit platform suite.

### 4.3 Downstream Sync (`packages/bedrock-api/bedrock/tools/sync_standards.py`)
`sync_standards.py` canonical range recognizes `1 <= number <= 14 or number == 100` and syncs standards with the updated `s###_audit_` frontmatter.

### 4.4 Test Suites (`packages/bedrock-api/tests/`)
- Update imports across:
  - `test_audit_s001_to_s004.py`
  - `test_audit_s005_to_s008.py`
  - `test_audit_s009_to_s012.py`
  - `test_audit_api_docs.py`
  - `test_audit_ledger_freshness.py`
- Add `test_audit_s100_domain_registry.py`.
- Delete obsolete `test_audit_s1_duplicates.py` and `test_audit_design_tokens.py`.

---

## 5. Multi-Repository Deployment Plan

### 5.1 Repository: `bedrock` (Platform Source of Truth)
- Rename modules in `packages/bedrock-api/bedrock/tools/` to `s###_audit_[description].py`.
- Create runner shims in `scripts/audit/s###_audit_[description].py`.
- Consolidate S001, prune S1 and design tokens duplicates, implement S100.
- Update `run_all.py`, `run_qa.py`, `docs/standards/*.md`, and unit tests.
- Run full QA: `python scripts/run_qa.py --mode full`.

### 5.2 Repository: `bedrock-ai-kit` (`c:\Dev\bedrock-ai-kit`)
- Sync updated standards documents into `rules/` (`s001-no-duplicate-ui-code.md` through `s014...`, `s100...`).
- Verify and update `scripts/Sync-AgenticTooling.ps1` and `scripts/Audit-AgenticTooling.ps1` to reflect the `s###_audit_` naming contract and ensure rules/audit consistency.
- Validate `Invoke-EcosystemLifecycle.ps1` passes cleanly.

### 5.3 Repository: `CollectIt` (`c:\Dev\CollectIt`)
- Run `python -m bedrock.tools.sync_standards --target C:\Dev\CollectIt` to refresh platform standards.
- Rename/align domain audit folder and scripts:
  - Ensure directory is `scripts/audit/` (normalizing from `scripts/audits/` if present).
  - Rename domain scripts to standard pattern: `s101_audit_ebay_compliance.py`, `s102_audit_listing_templates.py`, `s103_audit_variables.py`.
- Verify `scripts/run_qa.py` and `scripts/run_audit.ps1` pass with zero failures.

### 5.4 Repository: `MLBTracker` (`c:\Dev\MLBTracker`)
- Run `python -m bedrock.tools.sync_standards --target C:\Dev\MLBTracker` to refresh platform standards.
- Establish/align domain audit script: `scripts/audit/s101_audit_stat_invariants.py`.
- Verify `scripts/run_qa.py` and `scripts/run_audit.ps1` pass with zero failures.

---

## 6. Standards Evolution & Authoring Process

Documented in `docs/standards/README.md` and `docs/standards/s100-domain-standard-authoring.md`.

### 6.1 Adding a New Platform Standard (`S0##`)
1. **Spec:** Author `docs/standards/s0##-[kebab-name].md` with 5 mandatory sections and YAML frontmatter (`enforced_by: bedrock.tools.s0##_audit_[name]`, `cli_command: "python scripts/audit/s0##_audit_[name].py --root ."`).
2. **Audit Module:** Author `packages/bedrock-api/bedrock/tools/s0##_audit_[name].py` subclassing `AuditReporter`.
3. **Runner Shim:** Author `scripts/audit/s0##_audit_[name].py` delegating to `bedrock.tools`.
4. **Register in Orchestrator:** Add `("s0##", s0##_audit_[name])` to `AUDIT_MODULES` in `run_all.py`.
5. **Sync Invariant:** Update `_is_canonical` range in `sync_standards.py`.
6. **Tests & Docs:** Add unit test in `packages/bedrock-api/tests/` and register in `docs/standards/README.md` index table.
7. **Deploy:** Deploy updates to `bedrock-ai-kit`, `CollectIt`, and `MLBTracker`.

### 6.2 Adding a Consumer Domain Standard (`S101`–`S199`)
1. Create `docs/standards/s1##-[kebab-name].md` in the consumer repo with `tier: domain`.
2. Implement `scripts/audit/s1##_audit_[name].py` subclassing `bedrock.tools._reporter.AuditReporter`.
3. Declare the standard in `agentic.toml` `rules = [...]` and exemptions in `bedrock.toml` under `[tool.bedrock.audit.s1##]`.
4. Verify with `python -m bedrock.tools.s100_audit_domain_registry --root .`.
