# Bedrock Platform Standards

## Architectural Role

The standards in this folder are bedrock's non-negotiable engineering
contracts — platform-wide invariants that apply to every consumer
application installing `bedrock-api` and `@djntechnic/bedrock-ui`. They hold
no business domain: nothing here knows what a consumer's application-layer
data represents (see [`docs/extension_points.md`](../extension_points.md)
for the registry/provider boundary that keeps it that way).

Each standard follows the identical five-section schema — `Purpose &
Objective`, `Non-Negotiable Invariants`, `Architecture & Code Contracts`,
`Exceptions & Audit Exemptions`, `Verification & Enforcement Gate` — and maps
1:1 to a `bedrock.tools.audit_s###` module that mechanically checks it.
Standards are never retired; they are amended in place.

`S001`–`S099` is the platform range, authored and amended only in this
repository. `S101`–`S199` is reserved for consumer domain standards — see
[`s100-domain-standard-authoring.md`](s100-domain-standard-authoring.md)
before adding one in a consumer repository. `S100` itself is not a domain
slot.

Citations in prose and code comments use the 3-digit padded form: `§S001`,
not `§S1` or `§S01`.

## Standards Index

| Standard | Title | Status | Enforced By | Scope |
| -------- | ----- | ------ | ------------ | ----- |
| [S001](s001-no-duplicate-ui-code.md) | No Duplicate UI Code | active | `bedrock.tools.audit_s001_duplicates` | platform |
| [S002](s002-all-grids-wired-to-admin-config.md) | All Grids Wired to Admin Config | active | `bedrock.tools.audit_s002_grids` | platform |
| [S003](s003-logging-protocol.md) | Logging Protocol | active | `bedrock.tools.audit_s003_logging` | platform |
| [S004](s004-no-hardcoded-config-settings.md) | No Hardcoded Config Settings | active | `bedrock.tools.audit_s004_config` | platform |
| [S005](s005-test-coverage-mandatory.md) | Test Coverage Mandatory | active | `bedrock.tools.audit_s005_testing` | platform |
| [S006](s006-defect-isolation-and-pr-workflow.md) | Defect Isolation & PR Workflow | active | `bedrock.tools.audit_s006_pr_workflow` | platform |
| [S007](s007-schema-catalog.md) | Schema Catalog | active | `bedrock.tools.audit_s007_schema_catalog` | platform |
| [S008](s008-documentation-layout-and-naming.md) | Documentation Layout & Naming | active | `bedrock.tools.audit_s008_guidance` | platform |
| [S009](s009-design-system.md) | Design System | active | `bedrock.tools.audit_s009_design_tokens` | platform |
| [S010](s010-granular-security-model.md) | Granular Security Model | active | `bedrock.tools.audit_s010_security` | platform |
| [S011](s011-config-driven-navigation.md) | Config-Driven Navigation | active | `bedrock.tools.audit_s011_navigation` | platform |
| [S012](s012-dual-pin-platform-governance.md) | Dual-Pin Platform Governance | active | `bedrock.tools.audit_s012_pins` | platform |
| [S100](s100-domain-standard-authoring.md) | Domain Standard Authoring Guide | active | `bedrock.tools.audit_s100_domain_registry` | platform |

## Downstream Synchronization

A consumer repository mirrors this index rather than copying standard bodies
by hand:

```bash
python -m bedrock.tools.sync_standards --target C:\Dev\<consumer>
```

This copies the current `S001`–`S012` and `S100` documents into the
consumer's own `docs/standards/`, verbatim, alongside the consumer's own
`S101`–`S199` domain standards. Re-run it after every bedrock pin bump
(§S012) so a consumer's mirrored copies never drift from the tag its
`requirements.txt` / `package.json` actually pin.
