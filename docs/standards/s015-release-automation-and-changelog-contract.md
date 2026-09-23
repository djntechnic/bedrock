---
id: S015
title: "Release Automation & Changelog Contract"
status: active
tier: platform
enforced_by: bedrock.tools.s015_audit_release_notes
cli_command: "python scripts/audit/s015_audit_release_notes.py --root ."
---

# Standard S015: Release Automation & Changelog Contract

## Purpose & Objective

A release whose notes are reconstructed by hand from a diff loses the one
piece of information a diff cannot recover: *why the existing test suite
didn't already catch this*. Bedrock's release pipeline (`Cut-BedrockRelease
.ps1`, `.github/workflows/cascade.yml`) compiles `CHANGELOG.md` entries and
downstream adoption issues automatically from merged-PR metadata — but
automation only works if every PR that needs a changelog entry supplies one
in a fixed, machine-parseable shape at merge time. This standard is that
shape: the section structure every `CHANGELOG.md` version block follows,
the `Origin / Root Cause` / `Prevention / Test` metadata every defect entry
carries, and the `### For consumers` schema that drives downstream cascade.

## Non-Negotiable Invariants

- Every `CHANGELOG.md` version entry contains, in this order:
  `### Breaking Changes`, `### Fixed`, `### Added / Changed`,
  `### Platform Maintenance`, `### For consumers`. `### Breaking Changes`
  is never omitted — a release with no breaking change still emits the
  header with the literal body `None` — and it immediately precedes
  `### For consumers` in document order.
- `### Added / Changed` and `### Platform Maintenance` map directly to
  `.github/release.yml`'s label categories and are never dropped from the
  template, even when empty (header present, body `None`).
- Every `### Fixed` top-level bullet matches `^-\s+(?:\*\*)?\[#\d+\]`
  (optional markdown bold around the issue reference) and has two indented
  child bullets: `Origin / Root Cause` and `Prevention / Test`.
- The `Origin / Root Cause` / `Prevention / Test` narrative is authored
  once, at merge time, by the PR's own author, via a required `###
  Changelog Entry` block in the PR template — never reconstructed by
  release tooling after the fact from a diff.
- `### For consumers` is a fixed three-key schema: `Resolves Upstream
  Issues`, `Target Downstream Repositories`, `Expected Pin Migration`.
  `Expected Pin Migration` contains a `/bump-bedrock-pin vX.Y.Z` string
  whose tag matches the version entry it lives in.
- `Target Downstream Repositories` is never a second hardcoded literal —
  its single source of truth is `bedrock.toml`'s `[tool.bedrock.ecosystem]`
  `consumers` list.
- The audit (`s015_audit_release_notes`) validates the committed
  `CHANGELOG.md` entry at the `###` heading level, during pre-tag quality
  gates — never the composed, heading-promoted release body. The
  `### For consumers` → `## For consumers` promotion is a release-time
  string transform downstream of the audit, not a second schema.

## Architecture & Code Contracts

**Markdown — correct `CHANGELOG.md` version entry:**

```markdown
## v0.11.0 - 2026-09-22

### Breaking Changes
None

### Fixed
- **[#101] Fix route collision on wildcard admin paths**
  - **Origin / Root Cause:** the wildcard route was registered before the
    literal `/admin/users` route, so FastAPI's first-match resolution order
    shadowed it.
  - **Prevention / Test:** `test_admin_routes.py::test_literal_route_wins_over_wildcard`

### Added / Changed
- **[#104] Add bulk CSV export to the Grid Editor**

### Platform Maintenance
None

### For consumers
- **Resolves Upstream Issues:** #101, #104
- **Target Downstream Repositories:** `djntechnic/CollectIt`, `djntechnic/MLBTracker`
- **Expected Pin Migration:** `/bump-bedrock-pin v0.11.0`
```

**Violation — missing `Origin / Root Cause` child, wrong section order:**

```markdown
## v0.11.0 - 2026-09-22

### Fixed
- [#101] Fix route collision on wildcard admin paths

### Breaking Changes
None
```

Both the missing metadata children and `### Breaking Changes` appearing
after `### Fixed` instead of immediately before `### For consumers` are
audit failures.

**Python — audit check shape:**

```python
def audit_fixed_entry_metadata(entry_text: str) -> list[str]:
    violations = []
    for bullet, children in parse_fixed_bullets(entry_text):
        if "Origin / Root Cause" not in children:
            violations.append(f"{bullet}: missing Origin / Root Cause")
        if "Prevention / Test" not in children:
            violations.append(f"{bullet}: missing Prevention / Test")
    return violations
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s015]
changelog_path = "CHANGELOG.md"
exemptions = []
```

Historical `CHANGELOG.md` entries predating this standard are never
retroactively audited — the audit only validates the *target* version
under release, resolved by tag argument, not the whole file.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.s015_audit_release_notes vX.Y.Z --root .
```

- **Exit 0** — the target version's `##` block exists with all five
  mandatory sections in order, every `### Fixed` bullet has both metadata
  children, and `### For consumers` has all three keys with a matching
  `/bump-bedrock-pin` tag.
- **Exit 1** — a structural or missing-contract violation was found; the
  audit reports the file and section.
- **Exit 2** — configuration error (missing `CHANGELOG.md`, malformed
  `bedrock.toml`).
