<!--
  Bedrock Platform PR — target branch is always `master`.
  Fill every section. The checklist mirrors the standards indexed in CLAUDE.md.
-->

## Summary

<!-- What changed and why, in a few sentences. -->

Closes #<!-- issue number -->

## Changes

<!-- Bulleted list of concrete changes in this PR. -->

-

## Test Plan

<!-- How you verified this. Both suites block merge in CI. -->

- [ ] Backend: `cd packages/bedrock-api && pytest` — green
- [ ] Frontend: `npm test` from root (Vitest) — green
- [ ] Type Check: `npm run typecheck` (`tsc -b --noEmit`) — clean

## Platform Standards Checklist

- [ ] **Platform Boundary** — zero business domain logic added; application-specific behaviors exposed via extension points (Registry or Provider)
- [ ] **Extension Points** — documented in `docs/extension_points.md` if added or changed
- [ ] **Security & Navigation Models** — honors Granular Security Model (tri-state module capability matrix/overrides, audit logging) and Config-Driven Navigation (`app_nav_item_settings`, in-place `<PermissionDenied>`) contracts
- [ ] **Logging** — structured Pino logging in UI (`log`), Loguru in API; no `console.*` / `print()`
- [ ] **Typing** — precise TypeScript typing; zero `any` casts, `@ts-ignore`, or `@ts-expect-error`
- [ ] **Version & Changelog** — `CHANGELOG.md` updated if breaking export or consumer-facing contract
- [ ] **PR target** — `master`

## Notes

<!-- Anything reviewers or downstream consumers should know. -->
