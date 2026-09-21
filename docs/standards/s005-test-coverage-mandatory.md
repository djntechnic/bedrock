---
id: S005
title: "Test Coverage Mandatory"
status: active
tier: platform
enforced_by: bedrock.tools.s005_audit_testing
cli_command: "python scripts/audit/s005_audit_testing.py --root ."
---

# Standard S005: Test Coverage Mandatory

## Purpose & Objective

A green build that ships a known-broken test is worse than a red build: it
tells the next person the suite is trustworthy when it is not, and the defect
resurfaces in production instead of in review. This standard makes "zero
broken tests ship to master" a structural property of the repository, not a
matter of reviewer discipline.

## Non-Negotiable Invariants

- Every new or changed behavior gets a test: happy path, edge cases, and
  null/empty/error inputs.
- A failing test is never dismissed as "out of scope" or "pre-existing"
  without investigation. It is classified:
  - **Class A (minor regression)** — fixed inline, in the same PR.
  - **Class B (architectural blocker)** — the branch halts, the defect is
    escalated and filed, and the branch does not merge around it.
- `tsc --noEmit` / `tsc -b --noEmit` and equivalent type checks are blocking
  gates, not informational output. `any` casts and
  `@ts-ignore` / `@ts-expect-error` are banned as fixes for a type error — the
  type is fixed, not silenced.
- Skip decorators (`@pytest.mark.skip`, `it.skip`, `test.skip`) are banned
  outside an explicit, reviewed exemption.
- Automated tests never read from or write to a developer's live database.
  The test fixture clones or seeds an ephemeral database per session; a
  canary assertion refuses to run if the resolved test-DB path matches the
  live path.
- Live-database isolation is enforced by more than one canary, because a
  single check has a single point of failure: a setup-time path assertion
  (case-insensitive, since the platform targets a case-insensitive
  filesystem), a post-swap assertion before the test session's singleton
  points at the resolved path, a teardown-time path guard before any delete
  runs, and an mtime witness recorded at session start and re-checked at
  teardown to prove the live database was never touched. If any canary
  fires, the session stops and is investigated — it is never suppressed to
  get a green run.
- A test session seeds from one deterministic, idempotent fixture (safe to
  re-run against an already-seeded database, e.g. `INSERT OR IGNORE`) rather
  than depending on a developer's local data snapshot. When a new test
  hardcodes an expected count or shape, the fixture is updated in the same
  PR so the two never drift apart.
- Tests are written for essential logic, contracts, edge cases, and known
  regressions — not padded with redundant or microscopic mock tests that add
  maintenance drag without a corresponding correctness guarantee.
- CI re-runs the full path-scoped suite on every PR. A local fast/scoped test
  tier is a speed optimization for the agent loop, never a substitute for the
  CI gate.
- Background test jobs and CI runs are never polled with a busy-wait loop
  (a fixed `sleep` retried in a loop, or repeated manual status checks). The
  triggering process yields after launching the job and resumes on the
  event-driven completion signal.

## Architecture & Code Contracts

**Python — ephemeral test database fixture, correct:**

```python
# packages/bedrock-api/tests/conftest.py
import tempfile
from pathlib import Path

@pytest.fixture(scope="session")
def test_db():
    db_dir = Path(tempfile.gettempdir()) / "bedrock-test-db"
    assert "live" not in str(db_dir).lower()  # path-assertion canary
    ...
    yield db_dir
    assert str(db_dir).startswith(tempfile.gettempdir())  # teardown-guard canary
```

**Python — violation:**

```python
@pytest.mark.skip(reason="flaky")  # banned outside a declared exemption
def test_grid_config_roundtrip():
    ...
```

**TypeScript — violation:**

```typescript
// Banned as a fix: silences the type error instead of narrowing it.
// @ts-ignore
const rows = response.data as any;
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s005]
exempt_paths = [
  "packages/bedrock-ui/src/test-utils/**",
]
skip_exemptions = [
  "packages/bedrock-api/tests/test_oauth_live_provider.py::test_live_callback",  # requires network credentials CI does not have
]
```

Every `skip_exemptions` entry names an exact test node ID and must be paired
with a one-line justification in the same `bedrock.toml` comment — a bare skip
with no justification fails the audit as a configuration error.

## Verification & Enforcement Gate

```bash
python scripts/audit/s005_audit_testing.py --root .
```

- **Exit 0** — every changed route/component has a paired test, no
  undeclared skip decorators, no `any`/`@ts-ignore` introduced as a type-error
  fix.
- **Exit 1** — a violation was found; the audit reports the file and the
  missing pairing or banned pattern.
- **Exit 2** — configuration error (an unjustified `skip_exemptions` entry, a
  malformed `bedrock.toml`).
