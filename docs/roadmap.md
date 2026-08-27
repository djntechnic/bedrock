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
workflow loudly rather than filing an empty issue. The workflow is inert
until a `CASCADE_TOKEN` repository secret (a fine-grained PAT with
`Issues: write` on both consumer repos) is stored by hand — that step is
deliberately outside CI's reach, and until it's set the job fails at the
`gh issue create` step for lack of credentials — a failure that surfaces
only when someone happens to check the next release's Actions run, since
nothing currently watches this workflow's status.

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
