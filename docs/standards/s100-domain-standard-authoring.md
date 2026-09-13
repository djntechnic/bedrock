---
id: S100
title: "Domain Standard Authoring Guide"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s100_domain_registry
cli_command: "python -m bedrock.tools.audit_s100_domain_registry --root ."
---

# Standard S100: Domain Standard Authoring Guide

## Purpose & Objective

Bedrock holds no business domain — a standard about a consumer's own domain
models does not belong in `bedrock/docs/standards/`. But a consumer
application legitimately needs its own non-negotiable contracts, and those
contracts need the same machine-checkable shape platform standards have:
numbered ID, frontmatter, an audit tool, an exemption path. This standard
defines the numbering range, the audit contract, and the declaration
mechanism a consumer uses to extend the standards system without colliding
with the platform's own `S001`–`S099` range or with another consumer's
numbers.

## Non-Negotiable Invariants

- The numeric range **S101–S199** is reserved for consumer domain standards.
  `S001`–`S099` is platform-owned (bedrock authors and amends these; a
  consumer never edits them). `S100` itself — this document — is the platform
  contract that governs how S101+ is authored; it is not itself a domain slot.
- Each consumer repository owns a disjoint sub-range by convention
  (documented in that consumer's own `docs/standards/README.md`) to avoid
  cross-repo ID collisions if standards are ever compared side by side —
  e.g. one consumer uses `S101`–`S149`, another uses `S150`–`S199`.
  Renumbering on collision is a breaking change to every citation of the
  moved ID and is avoided by reserving the range up front.
- Every domain standard follows the identical schema this document and
  `S001`–`S012` use: the same frontmatter contract, the same five mandatory
  sections (`Purpose & Objective`, `Non-Negotiable Invariants`,
  `Architecture & Code Contracts`, `Exceptions & Audit Exemptions`,
  `Verification & Enforcement Gate`).
- A domain standard's audit tool subclasses the platform's `AuditReporter`
  base class (`bedrock.tools._reporter.AuditReporter`) rather than
  reimplementing pass/fail/exit-code bookkeeping — the platform substrate is
  a registry extension point (any number of domain audits may run), not a
  provider a consumer replaces.
- A consumer declares which domain rules are active via its own
  `agentic.toml` `rules = [...]` list, and configures exemptions for both
  platform and domain audits in its own `bedrock.toml`, using the identical
  `[tool.bedrock.audit.s###]` section shape platform standards use.

## Architecture & Code Contracts

**`AuditReporter` base class contract (consumed, not reimplemented):**

```python
from pathlib import Path
from bedrock.tools._reporter import AuditReporter

class AuditS101CanonicalEntityIdentity(AuditReporter):
    def __init__(self, repo_root: Path, config_file: Path):
        super().__init__(
            audit_code="S101",
            audit_name="Canonical Entity Identity",
            repo_root=repo_root,
            config_file=config_file,
        )

    def run(self) -> int:
        self.start_check("every domain row resolves its entity id through the canonical lookup")
        violations = self._scan_for_bare_entity_lookups()
        if violations:
            for file_path, line in violations:
                self.fail_check(
                    "bare entity-name lookup bypasses canonical_entity_id()",
                    file_path=file_path,
                    line=line,
                    hint="import canonical_entity_id from api.services.entities",
                )
        else:
            self.pass_check()
        return self.finish()
```

**Consumer `agentic.toml` — declaring a domain rule:**

```toml
[runtime]
rules = [
  "s003-logging-protocol",             # platform rule, mounted from bedrock
  "s101-canonical-entity-identity",    # domain rule, authored in-repo
]
```

**Consumer `bedrock.toml` — exempting a domain audit, same shape as platform:**

```toml
[tool.bedrock.audit.s101]
exempt_paths = [
  "scripts/backfill/**",
]
```

**Frontmatter for a new domain standard — identical contract to S001–S012:**

```markdown
---
id: S101
title: "Canonical Entity Identity"
status: active
tier: domain
enforced_by: consumer_app.tools.audit_s101_entity_identity
cli_command: "python -m consumer_app.tools.audit_s101_entity_identity --root ."
---
```

Note `tier: domain` (not `tier: platform`) — the frontmatter's `tier` field is
what lets a cross-repo standards index distinguish platform contracts from
consumer extensions at a glance.

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s100]
exempt_paths = []
reserved_ranges = { platform = "S001-S099", domain = "S101-S199" }
```

There is no legitimate exemption from the numbering range itself — a
consumer proposing a standard that genuinely belongs platform-side (it holds
no domain vocabulary and would benefit every consumer) is authored in
`bedrock` directly as the next available `S0##`, not smuggled into the domain
range at a low number.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s100_domain_registry --root .
```

- **Exit 0** — every domain standard found under a consumer's
  `docs/standards/` uses an ID in `S101`–`S199`, follows the five-section
  schema, declares `tier: domain`, and its `enforced_by` audit subclasses
  `AuditReporter`.
- **Exit 1** — a domain standard uses an ID outside the reserved range,
  is missing a mandatory section, or its audit tool does not subclass
  `AuditReporter`; the audit reports the standard file and the specific
  violation.
- **Exit 2** — configuration error (malformed `bedrock.toml`, unresolvable
  `enforced_by` module path).
