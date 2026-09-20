# Standards & Audit Scripts Reconciliation Design

**Date:** 2026-09-20  
**Status:** Approved  
**Topic:** Reconciling `docs/standards/` S001–S014, S100 with `bedrock.tools` and `scripts/audit/`

---

## 1. Executive Summary

Bedrock platform standards (§S001–§S014, §S100) define the non-negotiable engineering contracts across the Bedrock monorepo and its consumer repositories (`CollectIt`, `MLBTracker`). 

This design reconciles standards documents and audit scripts by:
1. Standardizing audit Python script filenames to the number-first snake_case pattern **`s###_audit_[description].py`**.
2. Maintaining implementation in `packages/bedrock-api/bedrock/tools/` for consumer distribution via `pip install bedrock-api`, while providing 1:1 executable runner shims in `scripts/audit/s###_audit_[description].py`.
3. Consolidating and pruning legacy duplicate scripts:
   - Folding missing valid checks (axios ban, `@shadows`, installed package collision) from `audit_s1_duplicates.py` into `s001_audit_duplicates.py`, then deleting `audit_s1_duplicates.py`.
   - Removing legacy unpadded `audit_design_tokens.py` in favor of `s009_audit_design_tokens.py`.
   - Implementing the missing standard S100 enforcement tool `s100_audit_domain_registry.py`.
4. Updating runners (`run_all.py`, `run_qa.py`), CI workflows, test suites, and standards frontmatter.
5. Documenting the formal lifecycle and checklists for authoring future platform and domain standards.

---

## 2. File Layout & 1:1 Parity Matrix

All standards documents in `docs/standards/` pair 1:1 with an audit module in `packages/bedrock-api/bedrock/tools/` and a runner shim in `scripts/audit/`.

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

### Runner Shim Implementation (`scripts/audit/s###_audit_[name].py`)
Every root shim uses the standard wrapper pattern:
```python
#!/usr/bin/env python
"""Runner shim for Standard S### audit."""
import sys
from bedrock.tools.s001_audit_duplicates import main

if __name__ == "__main__":
    sys.exit(main())
```

---

## 3. Duplicate Reconciliation & Implementation Details

### 3.1 S001 Consolidation (`audit_s1_duplicates.py` -> `s001_audit_duplicates.py`)
`audit_s1_duplicates.py` was the early prototype; `audit_s001_duplicates.py` adopted `AuditReporter`. We merge the missing invariants from `audit_s1_duplicates.py` into `s001_audit_duplicates.py`:
1. **Direct Axios Import Ban:** Detects `import axios ...` or namespace imports; requires using `apiClient`.
2. **`@shadows <Name>` Marker:** Bypasses duplicate warning when a deliberate local component shadow includes a valid `@shadows` header.
3. **Collision with `@djntechnic/bedrock-ui`:** If node_modules / package is resolvable, scans exported package surface to detect unannotated collisions.
4. **Pruning:** Remove `packages/bedrock-api/bedrock/tools/audit_s1_duplicates.py` and merge test assertions into `test_audit_s001_to_s004.py`.

### 3.2 S009 Reconciliation (`audit_design_tokens.py` -> `s009_audit_design_tokens.py`)
`s009_audit_design_tokens.py` is the official standard implementation using `AuditReporter`. `audit_design_tokens.py` is deleted. Tests in `test_audit_design_tokens.py` are updated to assert on `s009_audit_design_tokens`.

### 3.3 S100 Enforcement (`s100_audit_domain_registry.py`)
Implement `s100_audit_domain_registry.py` with `AuditReporter`:
- Inspects `docs/standards/`:
  - `S001`–`S099` (and `S100`) must specify `tier: platform`.
  - `S101`–`S199` must specify `tier: domain`.
  - Rejects standard IDs outside allowed numeric ranges.
  - Validates required YAML frontmatter: `id`, `title`, `status`, `tier`, `enforced_by`, `cli_command`.
  - Validates presence of the 5 required markdown sections.
- Returns: `0` clean, `1` violation, `2` config/runtime error.
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
Summary reports and banner titles will reflect `Platform Audit Suite (S001-S014, S100)`.

### 4.2 Local QA Runner (`scripts/run_qa.py`)
`run_qa.py` invokes `python -m bedrock.tools.run_all --root .` under full/audit mode. Because `run_all.py` handles the new suite modules, `run_qa.py` runs the updated suite transparently.

### 4.3 Downstream Sync (`packages/bedrock-api/bedrock/tools/sync_standards.py`)
Ensure `_is_canonical` recognizes `1 <= number <= 14 or number == 100` and syncs standards with the updated frontmatter.

### 4.4 Test Suites (`packages/bedrock-api/tests/`)
- Rename test imports across:
  - `test_audit_s001_to_s004.py`
  - `test_audit_s005_to_s008.py`
  - `test_audit_s009_to_s012.py`
  - `test_audit_api_docs.py`
  - `test_audit_ledger_freshness.py`
- Add `test_audit_s100_domain_registry.py`.
- Delete obsolete standalone test files: `test_audit_s1_duplicates.py` and `test_audit_design_tokens.py`.

---

## 5. Standards Evolution & Authoring Process

Documented in `docs/standards/README.md` and `docs/standards/s100-domain-standard-authoring.md`.

### 5.1 Adding a New Platform Standard (`S0##`)
1. **Spec:** Author `docs/standards/s0##-[kebab-name].md` with 5 mandatory sections and YAML frontmatter (`enforced_by: bedrock.tools.s0##_audit_[name]`, `cli_command: "python scripts/audit/s0##_audit_[name].py --root ."`).
2. **Audit Module:** Author `packages/bedrock-api/bedrock/tools/s0##_audit_[name].py` subclassing `AuditReporter`.
3. **Runner Shim:** Author `scripts/audit/s0##_audit_[name].py` delegating to `bedrock.tools`.
4. **Register in Orchestrator:** Add `("s0##", s0##_audit_[name])` to `AUDIT_MODULES` in `run_all.py`.
5. **Sync Invariant:** Update `_is_canonical` range in `sync_standards.py`.
6. **Tests & Docs:** Add unit test in `packages/bedrock-api/tests/` and register in `docs/standards/README.md` index table.

### 5.2 Adding a Consumer Domain Standard (`S101`–`S199`)
1. Create `docs/standards/s1##-[kebab-name].md` in the consumer repo with `tier: domain`.
2. Implement `scripts/audit/s1##_audit_[name].py` subclassing `bedrock.tools._reporter.AuditReporter`.
3. Declare the standard in `agentic.toml` `rules = [...]` and exemptions in `bedrock.toml` under `[tool.bedrock.audit.s1##]`.
4. Verify with `python -m bedrock.tools.s100_audit_domain_registry --root .`.
