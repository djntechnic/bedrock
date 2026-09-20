# Bedrock Platform Standards

## Architectural Role

The standards in this folder are bedrock's non-negotiable engineering
contracts — platform-wide invariants that apply to every consumer
application installing `bedrock-api` and `@djntechnic/bedrock-ui`. They hold
no business domain: nothing here knows what a consumer's application-layer
data represents (see [`docs/reference/extension-points.md`](../reference/extension-points.md)
for the registry/provider boundary that keeps it that way).

Each standard follows the identical five-section schema — `Purpose &
Objective`, `Non-Negotiable Invariants`, `Architecture & Code Contracts`,
`Exceptions & Audit Exemptions`, `Verification & Enforcement Gate` — and maps
1:1 to a `bedrock.tools.s###_audit_[name]` module and runner shim in `scripts/audit/`
that mechanically checks it. Standards are never retired; they are amended in place.

`S001`–`S099` is the platform range, authored and amended only in this
repository. `S101`–`S199` is reserved for consumer domain standards — see
[`s100-domain-standard-authoring.md`](s100-domain-standard-authoring.md)
before adding one in a consumer repository. `S100` itself is the platform contract
governing domain standard authoring.

Citations in prose and code comments use the 3-digit padded form: `§S001`,
not `§S1` or `§S01`.

## Standards Index

| Standard                                               | Title                                | Status | Enforced By                                 | Scope    |
| ------------------------------------------------------ | ------------------------------------ | ------ | ------------------------------------------- | -------- |
| [S001](s001-no-duplicate-ui-code.md)                   | No Duplicate UI Code                 | active | `bedrock.tools.s001_audit_duplicates`       | platform |
| [S002](s002-all-grids-wired-to-admin-config.md)        | All Grids Wired to Admin Config      | active | `bedrock.tools.s002_audit_grids`            | platform |
| [S003](s003-logging-protocol.md)                       | Logging Protocol                     | active | `bedrock.tools.s003_audit_logging`          | platform |
| [S004](s004-no-hardcoded-config-settings.md)           | No Hardcoded Config Settings         | active | `bedrock.tools.s004_audit_config`           | platform |
| [S005](s005-test-coverage-mandatory.md)                | Test Coverage Mandatory              | active | `bedrock.tools.s005_audit_testing`          | platform |
| [S006](s006-sdlc-and-pr-workflow.md)                   | SDLC & PR Workflow                   | active | `bedrock.tools.s006_audit_pr_workflow`      | platform |
| [S007](s007-schema-catalog.md)                         | Schema Catalog                       | active | `bedrock.tools.s007_audit_schema_catalog`   | platform |
| [S008](s008-documentation-layout-and-naming.md)        | Documentation Layout & Naming        | active | `bedrock.tools.s008_audit_guidance`         | platform |
| [S009](s009-design-system.md)                          | Design System                        | active | `bedrock.tools.s009_audit_design_tokens`    | platform |
| [S010](s010-granular-security-model.md)                | Granular Security Model              | active | `bedrock.tools.s010_audit_security`         | platform |
| [S011](s011-config-driven-navigation.md)               | Config-Driven Navigation             | active | `bedrock.tools.s011_audit_navigation`       | platform |
| [S012](s012-dual-pin-platform-governance.md)           | Dual-Pin Platform Governance         | active | `bedrock.tools.s012_audit_pins`             | platform |
| [S013](s013-api-standards.md)                          | API Standards & Admin Interactivity  | active | `bedrock.tools.s013_audit_api_docs`         | platform |
| [S014](s014-issue-logging-and-ecosystem-governance.md) | Issue Logging & Ecosystem Governance | active | `bedrock.tools.s014_audit_ledger_freshness` | platform |
| [S100](s100-domain-standard-authoring.md)              | Domain Standard Authoring Guide      | active | `bedrock.tools.s100_audit_domain_registry`  | platform |

## Downstream Synchronization

A consumer repository mirrors this index rather than copying standard bodies
by hand:

```bash
python -m bedrock.tools.sync_standards --target C:\Dev\<consumer>
```

This copies the current `S001`–`S014` and `S100` documents into the
consumer's own `docs/standards/`, verbatim, alongside the consumer's own
`S101`–`S199` domain standards. Re-run it after every bedrock pin bump
(§S012) so a consumer's mirrored copies never drift from the tag its
`requirements.txt` / `package.json` actually pin.

## Standards Evolution & Authoring Lifecycle

### Adding a New Platform Standard (`S0##`)
1. **Spec:** Author `docs/standards/s0##-[kebab-name].md` with 5 mandatory sections and YAML frontmatter (`enforced_by: bedrock.tools.s0##_audit_[name]`, `cli_command: "python scripts/audit/s0##_audit_[name].py --root ."`).
2. **Audit Module:** Author `packages/bedrock-api/bedrock/tools/s0##_audit_[name].py` subclassing `AuditReporter`.
3. **Runner Shim:** Author `scripts/audit/s0##_audit_[name].py` delegating to `bedrock.tools`.
4. **Register in Orchestrator:** Add `("s0##", s0##_audit_[name])` to `AUDIT_MODULES` in `run_all.py`.
5. **Sync Invariant:** Update `_is_canonical` range in `sync_standards.py`.
6. **Tests & Docs:** Add unit test in `packages/bedrock-api/tests/` and register in the index table above.
7. **Deploy:** Deploy updates to `bedrock-ai-kit`, `CollectIt`, and `MLBTracker`.

### Adding a Consumer Domain Standard (`S101`–`S199`)
1. Create `docs/standards/s1##-[kebab-name].md` in the consumer repo with `tier: domain`.
2. Implement `scripts/audit/s1##_audit_[name].py` subclassing `bedrock.tools._reporter.AuditReporter`.
3. Declare the standard in `agentic.toml` `rules = [...]` and exemptions in `bedrock.toml` under `[tool.bedrock.audit.s1##]`.
4. Verify with `python scripts/audit/s100_audit_domain_registry.py --root .`.
