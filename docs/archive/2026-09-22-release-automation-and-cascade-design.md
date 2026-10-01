# Release Automation & Downstream Cascade Design

**Date:** 2026-09-22
**Author:** Pair Programming Agent & djntechnic
**Status:** Approved (design only — no implementation landed by this document)
**Governing Standards:** §S006 (SDLC & PR Workflow), §S008 (Documentation Layout & Naming), §S012 (Dual-Pin Platform Governance), §S014 (Issue Logging & Ecosystem Governance) — introduces §S015 (Release Automation & Changelog Contract)
**Source Input:** `scratch/release-automation-draft-q&a.md` (canonical), reconciled against `scratch/release-automation-draft.md` (superseded draft)

---

## 1. Executive Summary & Core Invariants

The future state unifies upstream release execution into an idempotent
pipeline that compiles categorized release notes from merged-PR deltas,
enforces a structured consumer-adoption contract, and tags `master` using the
full 40-character commit SHA. Three invariants anchor every decision in this
document and override anything in the superseded draft that conflicts with
them:

1. **`.github/workflows/cascade.yml` remains the sole downstream-cascade
   mechanism**, authenticated via `secrets.CASCADE_TOKEN` (a repo secret with
   cross-repo issue-filing permission `GITHUB_TOKEN` does not carry). No local
   script, PowerShell or otherwise, files adoption issues in `CollectIt` or
   `MLBTracker` directly — doing so races `cascade.yml` and produces duplicate
   issues with mismatched titles. Local tooling's only job is to produce a
   release whose body contains a well-formed `## For consumers` section for
   `cascade.yml` to extract.
2. **Dual-heading contract:** the committed `CHANGELOG.md` entry uses
   `### For consumers` (a third-level heading, sibling to `### Fixed` /
   `### Added / Changed` inside one `##`-level version block). When the
   release body is assembled for `gh release create`, that heading is
   promoted one level to `## For consumers` — matching the level
   `cascade.yml`'s `awk` extractor (line 36 of that workflow) already scans
   for. These are the same content at two heading depths for two different
   documents, not two different schemas — the pre-tag audit validates the
   `CHANGELOG.md` form; the promotion is a mechanical string transform applied
   once, at release-body assembly time.
3. **Immutable commit anchoring:** every release tag is created against the
   full 40-character SHA of the `master` commit being released
   (`git rev-parse HEAD`), never a branch name or abbreviated SHA — a released
   tag must be traceable to one immutable commit regardless of what happens to
   `master` afterward.

Everything else in this document — the audit's exact schema, the local/server
execution split, the resumption state machine — is downstream of those three
invariants and is designed to not violate them even under partial failure.

---

## 2. Release Notes & Changelog Contracts (Standard §S015)

This design introduces a new platform standard, `docs/standards/s015-release-
automation-and-changelog-contract.md`, registered in §S008's four-tier
taxonomy under `docs/standards/` (never `docs/specs/` — a standard is a
non-negotiable contract, not a design in flight) and added to the index table
in `docs/standards/README.md` alongside `[tool.bedrock.audit.s015]` in
`bedrock.toml`. §S015 does not fold into §S006: this repository's §S006 is
scoped to defect isolation and the PR branch/merge workflow, and already does
not own changelog-format rules — that territory is closer to §S014's
ecosystem-governance concern, but distinct enough (it governs a document
format and a release-time gate, not issue taxonomy) to warrant its own
number rather than becoming an ad hoc subsection of either.

### 2.1 Mandatory section structure

Every `CHANGELOG.md` version entry contains, in order:

```markdown
## vX.Y.Z - YYYY-MM-DD

### Breaking Changes
<bulleted list, or a single line reading "None">

### Fixed
<defect entries — see §2.2>

### Added / Changed
<feature/task entries>

### Platform Maintenance
<refactor/chore/documentation entries>

### For consumers
<structured adoption block — see §2.3>
```

`### Breaking Changes` is mandatory and must immediately precede
`### For consumers` in document order (it is the last content section before
the consumer-facing contract, mirroring the pattern already present in the
three most recent real entries at the time of writing — v0.10.1, v0.10.3, and
the PR #97 pin-bump record). It is never omitted; a release with no breaking
change still emits the header with the literal body `None`. `### Added /
Changed` and `### Platform Maintenance` map directly from `.github/
release.yml`'s label categories (§5.1) and may be empty (header present, body
`None`) but are never dropped from the template — a consistently-shaped
document is what makes the audit's structural checks (§2.4) possible in the
first place.

### 2.2 `### Fixed` entry metadata

Every defect entry under `### Fixed` is a top-level bullet matching
`^-\s+\[#\d+\]` followed by two indented child bullets carrying fixed keys:

```markdown
- **[#101] Fix route collision on wildcard admin paths**
  - **Origin / Root Cause:** <why the defect existed — the actual originating
    file/line or mechanism, not a restatement of the symptom>
  - **Prevention / Test:** <the specific regression test file/assertion added
    to prevent recurrence>
```

This survives automation by design, not by exception: the narrative is
**authored once, at merge time, by the PR's own author**, not reconstructed
by the release tooling after the fact. The PR template gains a required
`### Changelog Entry` block:

```markdown
### Changelog Entry
- **Root Cause & Escape:** Why existing tests missed it.
- **Prevention:** Specific regression tests added.
```

The release generator extracts this block verbatim from each merged
defect-labeled PR and maps it onto the `Origin / Root Cause` /
`Prevention / Test` keys when composing the `### Fixed` entry — the house
style (a human explaining *why the suite didn't catch it*) is preserved
because a human still writes it, just once, earlier in the pipeline, instead
of being re-derived by a script from a diff. **A merged PR labeled
`type:defect` that lacks this block halts the release script for interactive
confirmation** (§4.1) rather than silently emitting an incomplete entry.

### 2.3 `### For consumers` structured schema

The consumer block is not prose-free — it is a fixed three-key schema,
enforced by key prefix, with prose freedom preserved only inside each
bullet's value:

```markdown
### For consumers
- **Resolves Upstream Issues:** #101, #104 (or the literal `None`)
- **Target Downstream Repositories:** `djntechnic/CollectIt`, `djntechnic/MLBTracker`
- **Expected Pin Migration:** `/bump-bedrock-pin vX.Y.Z`
```

`Target Downstream Repositories` is never a literal hardcoded in a second
place — see §5.1 for its single source of truth. `Expected Pin Migration`
must contain a `/bump-bedrock-pin <tag>` invocation with the tag matching the
release being cut; the audit rejects a mismatched or missing tag the same way
it rejects a missing section.

### 2.4 Audit gate scope

`s015_audit_release_notes.py` validates the **committed `CHANGELOG.md`
entry**, at the `###` heading level, during pre-tag quality gates — not the
composed release body. This is deliberate, not an oversight the earlier draft
left unaudited: validating pre-heading-promotion keeps the gate a pure
file-read (no dependency on the in-flight release-body string the script is
still assembling) and keeps the audit runnable standalone
(`python -m bedrock.tools.s015_audit_release_notes vX.Y.Z --root .`) against
any historical entry, not only the one being cut right now. The heading
promotion (`### For consumers` → `## For consumers`) happens downstream of
the audit, at release-payload assembly, and is a single, tested string
transform — it does not need its own gate because it has no branching logic
to get wrong.

The audit enforces, per §2.1–§2.3, all of:

- The target version's `##` block exists in `CHANGELOG.md`.
- `### Breaking Changes` is present, immediately preceding `### For
  consumers`.
- Every `### Fixed` top-level bullet matches `^-\s+\[#\d+\]` and has both
  `Origin / Root Cause` and `Prevention / Test` indented children.
- `### For consumers` is present and contains all three required keys
  (`Resolves Upstream Issues`, `Target Downstream Repositories`, `Expected
  Pin Migration`), with `Expected Pin Migration` containing a
  `/bump-bedrock-pin <tag>` string whose tag matches the version under audit.

Exit codes follow the platform convention: `0` compliant, `1` a structural or
missing-contract violation (file and section reported), `2` a configuration
error (missing `CHANGELOG.md`, malformed `bedrock.toml`).

---

## 3. Local vs. Server-Side Execution Boundaries

The single biggest correction this Q&A makes to the superseded draft is
moving cross-repository mutation entirely into CI. The draft's
`Cut-BedrockRelease.ps1` closed upstream issues *and* filed downstream
adoption issues from the operator's own `gh auth login` session (draft steps
11–12). That is rejected: cross-repo mutation needs the audit trail and
permission isolation that only running inside GitHub Actions under
`secrets.CASCADE_TOKEN` provides, and running it locally risks duplicate
dispatch against `cascade.yml`, which already does this unconditionally on
every `release: published` event.

### 3.1 Local Orchestrator — `Cut-BedrockRelease.ps1` / `/cut-release`

Scope is strictly **repository-local preparation**. It never touches another
GitHub repository and never closes or files an issue anywhere:

1. **Working tree validation** — refuse to proceed on a dirty tree or a
   branch other than `master`; `git pull origin master` and
   `git fetch --tags origin` to establish a known-good baseline.
2. **Tag baseline & target version resolution** — resolve the latest
   `vX.Y.Z` tag, compute the target version (§4.3 covers semver-segment
   selection), and confirm neither the tag nor the release already exists
   before doing any local mutation (idempotency entry point — see §4.1).
3. **GraphQL delta analysis** — fetch all merged PRs and their
   `closingIssuesReferences` between the baseline tag and `master` HEAD in
   **one** `gh api graphql` round-trip, not one `gh pr view` call per PR.
   This both avoids the rate-limit exposure the per-PR loop had (§4.2) and
   gives the script every fact it needs — labels for semver selection
   (§4.3), closing issues for the consumer block, and PR bodies for the
   `### Changelog Entry` block (§2.2) — before it commits to any decision.
4. **CHANGELOG.md prepend** — assemble the full `###`-structured entry
   (§2.1–§2.3) from the GraphQL payload and prepend it to `CHANGELOG.md`.
   Also synchronizes `package.json`, `pyproject.toml`, and `README.md`
   version references in the same working-tree pass.
5. **Local pre-tag quality gates** — run, in order: `s015_audit_release_notes`
   against the freshly-written `CHANGELOG.md` entry, `s012_audit_pins`,
   the `bedrock-api` pytest suite, `npm test`, `npm run typecheck`. Any
   non-zero exit halts the script before a single git mutation happens
   (§4.2).
6. **Commit, tag, push** — commit the manifest/CHANGELOG changes, resolve
   `$sha = git rev-parse HEAD` post-commit, `git tag -a <tag> <sha>`, push
   both `master` and the tag, then verify the tag's remote visibility with
   `git ls-remote --tags origin <tag>` per this repo's existing `/cut-release`
   contract (`CLAUDE.md`'s "If `git push origin <tag>` returns HTTP 403..."
   clause).
7. **`gh release create`** — publish the GitHub Release with the
   heading-promoted body (§1, invariant 2) targeting `master` at the tag.

Nothing past step 7 runs locally. The script's own output ends at "release
published"; it does not report on downstream cascade or issue closure
because it did not perform either.

### 3.2 Server-Side Orchestrator — GitHub Actions on `release: published`

Two server-side responsibilities, both triggered by the same
`release: published` event, both authenticated appropriately for their own
blast radius:

1. **Upstream issue closure** (new job, added to `cascade.yml` or a sibling
   workflow in the same file — not a second workflow file, so the two stay
   visibly coupled to the same trigger). Runs under the default
   `GITHUB_TOKEN`, scoped to `djntechnic/bedrock` only: for each issue number
   discovered during delta analysis (§3.1 step 3) and echoed into the
   release body's `Resolves Upstream Issues` key, comment "Resolved and
   verified in bedrock release `<tag>`" and close with reason `completed`.
   This is a same-repo, low-privilege operation — it does not need
   `CASCADE_TOKEN`.
2. **Downstream adoption dispatch** — unchanged, existing `cascade.yml`
   behavior (§1, invariant 1): one adoption issue per consumer per release,
   unconditionally, sourced from the release body's `## For consumers`
   section, authenticated via `secrets.CASCADE_TOKEN` against the
   `matrix.consumer` list.

Both jobs are triggered by the release publish event that step 7 of the local
orchestrator produces — the local script's entire contract with the server
side is "publish a release whose body has a well-formed `## For consumers`
section and an accurate `Resolves Upstream Issues` list." It has no other
coupling to `cascade.yml` and does not need to know that workflow's
internals beyond that one output contract.

---

## 4. Failure Modes & Idempotency Engine

### 4.1 State-machine recovery (`-Resume`)

`Cut-BedrockRelease.ps1` has no single "did this already run" flag; it
derives resumption state by checking three independent, externally
observable facts in order, and skips forward past whichever prefix of steps
already happened:

1. **Does `$TargetVersion` exist on `origin` as a tag?**
   (`git ls-remote --tags origin <tag>`). If not, start from step 1 of §3.1.
2. **If the tag exists remotely, does a GitHub Release exist at that tag?**
   (`gh release view <tag>`, tolerating a not-found exit). If the tag exists
   but no release does, skip version-bump/tag/push and resume directly at
   `gh release create` (§3.1 step 7) — this is the exact gap identified in
   the source Q&A (Question 11): a failure between tag-push and
   release-create must not re-run version computation or attempt a second
   tag.
3. **If both the tag and the release exist, has cascade already fired?**
   This is not independently checkable from the local script (cascade state
   lives in server-side workflow runs and downstream issue lists, not in
   anything local `git`/`gh` state exposes cheaply) — so a script invoked
   with `-Resume` against a fully-published release takes no further local
   action and reports success. Re-cascading a release that has already
   dispatched adoption issues is handled by `cascade.yml`'s own
   `workflow_dispatch` re-run path (`inputs.tag`), not by the local script,
   consistent with §3's boundary that cascade is exclusively server-side.

The `-Resume` switch makes this check-then-skip behavior explicit rather than
implicit in every run — a bare re-invocation without `-Resume` still performs
the same remote-state checks defensively (refusing to double-tag or
double-publish) but `-Resume` is the documented, intentional recovery
entry point an operator reaches for after a failure, rather than relying on
the script happening to no-op correctly on every step.

### 4.2 Pre-mutation network safety

All GitHub API discovery and notes compilation (delta analysis, PR-label
scan, changelog-narrative extraction) happens **before** any local git
mutation — no commit, no tag, no push occurs until every remote read this
release needs has already succeeded. A rate-limit or transient network
failure during discovery therefore leaves the working tree exactly as it
started: no partial tag, no partial commit, nothing for a human to clean up
before retrying. This is the direct fix for the failure mode in source
Question 12 (a rate limit hitting mid-loop with tag already pushed and no
release published) — it is prevented structurally by ordering, not
recovered from after the fact. Combined with the single-round-trip GraphQL
query in §3.1 step 3 (replacing the draft's one-`gh pr view`-call-per-PR
loop), the number of network calls capable of failing mid-discovery drops
from O(merged PRs) to a small constant, further shrinking the window in
which a transient failure can occur at all.

### 4.3 Semver segment selection

Version selection is derived from merged-PR labels discovered during the
same delta analysis pass (§3.1 step 3), not left as an always-manual
`-TargetVersion` argument:

- Any merged PR carrying `semver:major` or `breaking` → major bump.
- Any merged PR carrying `semver:minor`, `type:feature`, or `enhancement`
  (and no major-triggering label) → minor bump.
- Otherwise (only defect/chore-labeled PRs in the delta) → patch bump.
- An explicit `-TargetVersion vX.Y.Z` always overrides the computed value;
  if it contradicts what the labels imply (e.g., a manual patch bump
  requested while a `breaking`-labeled PR is in the delta), the script
  halts for interactive confirmation unless `-Force` is passed — silently
  under-bumping past a labeled breaking change is treated as a defect class
  of its own, not a permitted operator shortcut.

---

## 5. Tooling, Scripts & Configuration

### 5.1 `.github/release.yml` label-mapping schema

```yaml
changelog:
  categories:
    - title: "### Fixed"
      labels: ["type:defect", "bug"]
    - title: "### Added / Changed"
      labels: ["type:feature", "type:task", "enhancement"]
    - title: "### Platform Maintenance"
      labels: ["type:refactor", "chore", "documentation"]
  exclude:
    labels: ["duplicate", "invalid", "wontfix"]
```

This declares the same three body categories §2.1 mandates in
`CHANGELOG.md`, so the GitHub-generated notes payload (`gh api
repos/{owner}/{repo}/releases/generate-notes`) and the committed changelog
entry never diverge in shape — the local script's `### Fixed` / `### Added /
Changed` / `### Platform Maintenance` headers are populated directly from
this categorization rather than re-derived by separate logic.

The downstream consumer matrix (`Target Downstream Repositories`, §2.3) is
declared once, as data, in `bedrock.toml`:

```toml
[tool.bedrock.ecosystem]
consumers = ["CollectIt", "MLBTracker"]
```

Both the local release-body assembly step (§3.1 step 4) and `cascade.yml`'s
own `matrix.consumer` read from — or are kept in parity with — this single
array. It is never a second hardcoded literal in the PowerShell script, the
audit, and the workflow independently.

### 5.2 Audit module placement

Following the platform's existing 1:1 dual-location convention (§S008 /
`docs/standards/README.md`'s "Adding a New Platform Standard" lifecycle):

- **Core implementation:**
  `packages/bedrock-api/bedrock/tools/s015_audit_release_notes.py`,
  subclassing `AuditReporter` per the pattern every other `s0##_audit_*`
  module follows (`_reporter.AuditReporter`, `start_check` /
  `fail_check` / `pass_check` / `finish`).
- **CLI shim:** `scripts/audit/s015_audit_release_notes.py`, a thin
  delegate to the core module — the same shape as every other numbered
  standard's runner shim.
- **Registration:** added to `AUDIT_MODULES` in `run_all.py`, to
  `_is_canonical` in `sync_standards.py` so the standard mirrors correctly
  into `CollectIt`/`MLBTracker`, and to the index table in
  `docs/standards/README.md`.
- **Unit tests:** `packages/bedrock-api/tests/test_audit_s015_release_
  notes.py`, covering: a fully compliant entry; a missing `### For
  consumers` section; a missing target-version entry; a `### Fixed` bullet
  missing `Origin / Root Cause` or `Prevention / Test`; a missing or
  mismatched `/bump-bedrock-pin` tag; a missing `### Breaking Changes`
  header.

### 5.3 `docs/standards/s015-release-automation-and-changelog-contract.md`

Authored under §S008's `docs/standards/` tier (a non-negotiable engineering
contract, not a spec-in-flight — this document, by contrast, correctly lives
under `docs/specs/` because it is the design record preceding that
standard's authorship). It follows the mandatory five-section schema every
other standard uses (`Purpose & Objective`, `Non-Negotiable Invariants`,
`Architecture & Code Contracts`, `Exceptions & Audit Exemptions`,
`Verification & Enforcement Gate`) and is registered in two places in the
same PR that creates it:

- `docs/standards/README.md`'s index table (row: `S015 | Release Automation
  & Changelog Contract | active | bedrock.tools.s015_audit_release_notes |
  platform`).
- `bedrock.toml`'s `[tool.bedrock.audit.s015]` section, declaring any
  exemptions (e.g., historical `CHANGELOG.md` entries predating the
  standard, which the audit only validates against the *target* version
  being released, not retroactively against the whole file).

This document does not author `s015-release-automation-and-changelog-
contract.md` itself — that authorship, the audit module, the `.github/
release.yml` file, and `Cut-BedrockRelease.ps1` are implementation work
that follows this design, consistent with the working-mode boundary this
document operates under (design record only).

---

## 6. Summary of Resolved Design Questions

| # | Question | Resolution |
|---|---|---|
| 1 | Keep `cascade.yml` as sole dispatcher? | Yes; issue-closing layers on top, does not replace it |
| 2 | Trust model for cross-repo mutation | CI-only, `CASCADE_TOKEN`; local session never mutates other repos |
| 3 | Should issue-closing be server-side? | Yes; new job on `release: published`, `GITHUB_TOKEN`, same-repo scope |
| 4 | `###` vs `##` — which does the audit validate? | Audit validates committed `### For consumers`; promotion to `##` happens at body-assembly time only |
| 5 | Is there a machine-readable consumer-block schema? | Yes — three fixed keys, prose free within each value |
| 6 | Where does the consumer repo list live? | `bedrock.toml`'s `[tool.bedrock.ecosystem]`, single source |
| 7 | Unlinked issues via `closingIssuesReferences` | Also parse a PR-body `Resolves:` trailer; allow manual `-AdditionalIssues` override |
| 8 | Close issues per-PR or per-release? | Per-release (batched at tag time), matching "fixed in vX.Y.Z" ledger semantics |
| 9 | Does auto-close also update consumer ledgers? | No — ledger update is consumer-side, performed by `/bump-bedrock-pin` |
| 10 | Is root-cause/regression metadata a hard gate? | Yes — `[#<id>]`, `Origin / Root Cause`, `Prevention / Test` are structurally enforced |
| 11 | Resume/rollback after partial failure? | Three-fact remote-state check (`tag exists` → `release exists` → cascade is server-owned) plus `-Resume` |
| 12 | Mid-loop rate-limit/network failure? | All discovery (single GraphQL call) happens before any local git mutation |
| 13 | Who picks the semver segment? | PR labels drive it automatically; manual override always available, contradiction requires `-Force` |
| 14 | New standard number and dual-location convention? | §S015, `bedrock/tools/s015_audit_release_notes.py` + `scripts/audit/` shim |
| 15 | Does the root-cause narrative survive automation? | Yes — authored once by the PR author via a required PR-template block, extracted verbatim, not regenerated |

---

## 7. Explicitly Out of Scope for This Document

Per the operating context's working-mode boundary, this document is a design
record only. It does not:

- Create `.github/release.yml`, `s015_audit_release_notes.py`,
  `Cut-BedrockRelease.ps1`, or `docs/standards/s015-....md`.
- Modify `bedrock.toml`, `package.json`, `pyproject.toml`, or `CHANGELOG.md`.
- Modify `.github/workflows/cascade.yml` or any other workflow file.
- Cut, tag, or publish any release.

Implementation of the above is tracked as follow-on work once this design is
accepted.
