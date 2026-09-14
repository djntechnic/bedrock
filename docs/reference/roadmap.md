# Roadmap

This document holds shape, not state. It records what each milestone contains
and who asked for it. Anything that changes as work progresses — which issues
are open, which are closed, whether a milestone is done — lives in GitHub
milestones, not here. Read this table to see what a release is *for*; read
the milestone on GitHub to see where it stands.

## Milestones

| Milestone | Tag | Contents | Asked for by | CollectIt gets | MLBTracker gets |
| --- | --- | --- | --- | --- | --- |
| M1 | `v0.6.0` | #20 baseline bootstrap, #14 ESM build output, cascade machinery | CollectIt (both defects); MLBTracker (both blockers) | A dev server that needs no hand-derived `optimizeDeps.include` | A fresh database that boots, and a viable pin jump |
| M2 | — | MLBTracker boards `v0.6.0` | — | Nothing directly; a second consumer to judge platform changes against | Three releases of platform work, and its local twins deleted |
| M3 | `v0.7.0` | #22, #23, #25, #26, #35, #36, #40, unkeyed `<SelectContent>` | CollectIt (#22, #23, #25, #35, #36, unkeyed `<SelectContent>`); MLBTracker (#26, #40) | `create_app()`, a wider StorageProvider, visible row order, an honest dashboard pin | Its residue removed from the platform, plus a canonical viewer for `useSecurityEvents` |
| M4 | `v0.8.0` | Ledger-freshness gate; promotion of the platform-universal audit gates | Both | One fewer locally-maintained gate | Gates it never had |

The "what each consumer gets" columns are the point of this table: they make
a milestone that serves only one consumer visible as such, rather than
leaving it to be inferred from the issue list.

**M3 and M4 ship together as `v0.8.0`.** No `v0.7.0` tag exists. M3's last two
items (#36, #40) and the whole of M4 landed in one branch, and both consumers
adopt them in a single pin bump — cutting two tags off that branch would have
sent each consumer two adoption issues for one piece of work. The `v0.7.0`
column above is kept as written because this table records what a milestone
was *for*, and that has not changed; where a tag is what you need, `v0.8.0` is
the one that carries M3 and M4 both.

## M4 — which audit gates belong to the platform

M4 promotes the consumers' audit gates that turn out to enforce properties of
*consuming bedrock* rather than properties of an app's own domain. The split
below was a hypothesis in the design; this is the result of reading all six
scripts, and it is recorded here before any code moved, because the
classification is the deliverable and the move is mechanical.

The test: **a gate is platform-universal when the property it enforces would
be worth enforcing in any bedrock consumer, and meaningless in a repo that
does not depend on bedrock.**

| Gate | Owner today | Verdict | Why |
| --- | --- | --- | --- |
| `audit_s1_duplicates.py` | CollectIt | **Promote** | Its whole subject is the boundary between an app and `@djntechnic/bedrock-ui`: no local twin of a platform export, one query-key factory, one route map, one HTTP client. It reads the *installed* package rather than a name list, so it tightens itself on every pin bump — which is exactly the behaviour a consumer cannot get from a copy that drifts. |
| `audit_design_tokens.py` | CollectIt | **Promote** | It enforces that the documented design system matches what bedrock's `ThemeProvider` actually writes onto `<html>` — a property of consuming the platform's theming, not of collectibles. The CollectIt-specific parts (file paths, which hex fields are editable) are configuration, not logic. It must exit clean when a consumer registers no palettes, so a repo mid-migration is not blocked by a gate it cannot yet satisfy. |
| `audit_api_docs.py` | MLBTracker | **Promote** | It reconciles the shipped `/api/v1` surface against the reference doc, and it already reads that surface through `bedrock.core.stats.iter_route_specs` — the platform's own flattener, which it needs precisely because a naive walk of `app.routes` misses every included route. Every consumer has that surface and that hazard. The doc path and route prefix become parameters. |
| `audit_ebay_compliance.py` | CollectIt | **App-local** | eBay's HTML sanitizer is a fact about a marketplace, not about bedrock. Nothing in the platform knows what a listing is. |
| `audit_framework_boundary.py` | MLBTracker | **App-local, and temporary** | It tracks one repo's unfinished extraction: no file destined for the platform may import a file that stays behind. CollectIt completed that move and has nothing for it to check. Its own header says to delete it when the frontend lands in the package — that has not happened yet (see the finding below), so it stays where it is and is deleted when it reaches zero. |
| `audit_project.py` | MLBTracker | **App-local** | A 1168-line grab-bag — comment coverage, hardcoded values, endpoint reconciliation — bound to MLBTracker's own `schema_catalog` and severity conventions. Individual checks inside it overlap with the promoted gates; the overlap is worth resolving when it is retired, not by promoting the container. |

**A finding surfaced by this reading, filed rather than fixed here.**
MLBTracker pins `@djntechnic/bedrock-ui` at `v0.6.2`, but
`audit_framework_boundary.py --list` still reports **16 platform-destined
files in-tree** — `AuthProvider.tsx`, `ThemeContext`, `queryKeys.ts`, several
stores and `ui/` primitives among them. Its frontend migration is partial:
the components moved, some of their tests and all of these did not. That is
also why `audit_design_tokens.py` cannot run there yet: MLBTracker has a
`.stitch/DESIGN.md` but no registered palettes for it to be checked against.
Filed as
[MLBTracker#387](https://github.com/djntechnic/MLBTracker/issues/387); the
promoted gates are written to tolerate that state rather than to fail it.

## The cascade contract

A bedrock release doesn't reach a consumer just by existing. Each tagged
release carries a release note with an **adoption section**, naming the
issues it closes and the pin move it expects downstream. That adoption
section is what a consumer acts on: an **adoption issue** is opened in the
consumer's repo, tracked with `cascade:pending`, and closed one of two ways —
**boarded** (the pin moved, the release is in use) or **declined-with-reason**
(the consumer explains why it isn't taking this tag yet). Nothing here
tracks which releases are boarded or declined; that state lives on the
adoption issues themselves.

As of M1 this contract is enforced by `.github/workflows/cascade.yml`, not
left to a human to remember. On every published release, it lifts the
`## For consumers` section out of the release body verbatim and files it as
an issue — labelled `cascade:pending` — in both `djntechnic/CollectIt` and
`djntechnic/MLBTracker`. A release published without that section fails the
workflow loudly rather than filing an empty issue. It runs on a
`CASCADE_TOKEN` repository secret — a fine-grained PAT with `Issues: write`
on both consumer repos — stored by hand, deliberately outside CI's reach.
Should that token be missing or expire, the job fails at the
`gh issue create` step for lack of credentials, and that failure surfaces
only when someone happens to check the release's Actions run, since nothing
currently watches this workflow's status.

## Inputs

This roadmap is written from two ledgers, one per consumer, that record each
repo's outstanding asks of the platform — both at the same path, `docs/reference/bedrock_issues_to_file.md`:

- CollectIt's ledger: `docs/reference/bedrock_issues_to_file.md` in
  `djntechnic/CollectIt`.
- MLBTracker's ledger: `docs/reference/bedrock_issues_to_file.md` in
  `djntechnic/MLBTracker`.

When either ledger changes, the milestone contents above may need to change
with it — but the ledgers themselves, not this document, are the record of
what is currently owed.
