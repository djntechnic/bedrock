# scripts/

Developer and CI entrypoints for the bedrock monorepo.

## Root entrypoints

| Script | Purpose |
|---|---|
| `run_qa.py` | Tiered QA orchestrator: `--mode fast` (delta, before commit), `--mode scoped` (touched layer, before PR), `--mode full` (everything plus audits, pre-merge/CI). Exit 0 = all steps passed or skipped, 1 = a step failed. Add `--json` for machine-readable output. |
| `clean_branches.py` | Prunes local branches that are merged or whose remote is gone. `clean_branches.bat` is the Windows launcher. |

## `audit/`

Runner shims for the platform standards (S001-S015, plus `s100_audit_domain_registry.py`).
Each shim only imports `main` from the matching `bedrock.tools` module and exits with its
code, so the standards can be run from a checkout without installing the package:

```bash
python scripts/audit/s005_audit_testing.py --root .
```

Exit codes: 0 = pass, 1 = violation, 2 = configuration error.

## `maintenance/`

| File | Purpose |
|---|---|
| `Cut-BedrockRelease.ps1` | Local release orchestrator: validates clean master, resolves the version, builds the CHANGELOG entry, runs pre-tag gates, tags, pushes, and publishes the GitHub Release. Supports `-TargetVersion`, `-Resume`, `-Force`. |
| `CutBedrockRelease.Helpers.psm1` | Helper module for the release script (tests in `CutBedrockRelease.Helpers.Tests.ps1`). |
| `vulture_whitelist.py` | Dead-code whitelist used by `run_qa.py --dead-code`. |

`maintenance/platform/` holds synced platform tooling (runner scripts) and is gitignored.
