# Out-of-Scope & Pre-Existing Defect Backlog — Bedrock Platform Ecosystem

## Overview
This backlog logs defects, technical debt, and test isolation limitations encountered during the Granular Security Model implementation and ecosystem audits. These items are tracked independently with strict triage priority to prevent scope-creep across active feature branches.

---

## Triage Matrix

| Defect ID | Target Repo | Component / File | Severity / Priority | Description | Proposed Remediation Strategy |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **BUG-001** | `MLBTracker` | `api/tests/test_player_profile.py` (`TestTwoWayProfile`) | **Medium (P2)** | 5 unit tests assert against synthetic fixture IDs (`700004 Shohei Ohtani`, `700002 Luis Arraez`, `510001 Stub Player 1`) declared in `api/tests/fixtures/ci_seed_fixture.sql`. When running the full suite locally against an existing `data/mlbtracker.db`, `conftest.py` skips the CI seed fixture to preserve dev data, returning 404s for those specific stub IDs (clean CI runs pass 100%). | Implement a `@pytest.mark.synthetic_fixture` test decorator or localized in-memory SQLite fixture to load dual-discipline stub player rows on-demand during local test execution. |
| **BUG-002** | `MLBTracker` | `api/tests/test_rankings.py` (`test_trigger_sync_returns_200`) | **Low (P3)** | `POST /api/v1/rankings/sync/trigger` returns `409 Conflict` if an unfinished `running` sync job row exists from a previous aborted local dev session within the 2-hour window. | Wrapped in-test pre-cleanup to reset stale `running` jobs; recommend adding a configurable background sync timeout/reaper in `rankings_service.py` to auto-expire orphaned jobs. |
| **BUG-003** | `CollectIt` | `frontend/src/components/listing-studio/InboxPath.test.tsx` | **Low (P3)** | JSDOM Clipboard API warning in Vitest console output (`Error: denied at InboxPath.test.tsx:69:45`). Test passes, but logs a mock clipboard denial warning. | Provide a standard clipboard mock fixture in `src/setupTests.ts` to suppress JSDOM clipboard permission warnings. |
| **BUG-004** | `Bedrock` / `All` | GitHub Actions CI Workflows (`.github/workflows/*.yml`) | **Low (P3)** | GitHub Actions annotations warn that Node.js 20 actions (`actions/checkout@v4`, `actions/setup-python@v5`, `actions/setup-node@v4`, `dorny/paths-filter@v3`) are being forced to run on Node 24 runtime ahead of deprecation. | Update workflow action pins to latest releases supporting native Node 24 when available. |
