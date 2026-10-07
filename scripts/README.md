# scripts/

Developer and CI entrypoints for the bedrock monorepo.

## Root entrypoints

| Script | Purpose |
|---|---|
| `run_qa.py` | Shim for `python -m bedrock.tools.run_qa` (layout from `[tool.bedrock.qa]` in `bedrock.toml`): `--mode fast` (testmon delta, before commit), `--mode scoped` (touched layers vs `master`, before PR), `--mode full` (everything plus audits and dead-code, pre-merge). Backend, frontend, typecheck and audit lanes run concurrently. Exit 0 = all steps passed or skipped, 1 = a step failed, 2 = a step could not run. `--json` for machine-readable output. Everything it writes lives under `.qa/` (gitignored): the testmon cache in `.qa/testmon/`, and `.qa/reports/` with `last-<mode>.json`, a rotating `history.jsonl`, and `index.html` - a self-contained viewer with filters, duration trends and per-step history (rebuild with `python -m bedrock.tools.qa_report --root .`). |
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
| `Cut-BedrockRelease.ps1` | Local release orchestrator: validates clean tree, ensures a dedicated feature branch, resolves the version, builds the CHANGELOG entry, runs pre-tag gates (`run_qa -q`), tags, pushes, ensures release PR, and publishes the GitHub Release. Supports `-TargetVersion`, `-Resume`, `-Force`. |
| `CutBedrockRelease.Helpers.psm1` | Helper module for the release script (tests in `CutBedrockRelease.Helpers.Tests.ps1`). |
| `vulture_whitelist.py` | Dead-code whitelist used by `run_qa.py --dead-code`. |

`maintenance/platform/` holds synced platform tooling (runner scripts) and is gitignored.
