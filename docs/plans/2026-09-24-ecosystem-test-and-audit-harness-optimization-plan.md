# Ecosystem Test and Audit Harness Optimization Plan

> **Delivery via Triage Plan:** Hand off this plan directly to the `/triage-plan` skill:
> ```pwsh
> /triage-plan docs/plans/2026-09-24-ecosystem-test-and-audit-harness-optimization-plan.md
> ```
> This ingests discrete tasks, maps domain-to-agent delegations, injects runtime invariants
> (active virtualenv/python, direct exit status, lockstep pins, <30s delta testing), and supervises execution.

**Goal:** Cut the combined ecosystem QA wall time — `run_qa.py --mode full` (~336 s) plus `run_audit.ps1 -All` (~26 s) — to roughly 110–130 s per consumer, without weakening a single gate, canary, or audit result. Bedrock ships the three platform hooks first (v0.11.0); CollectIt and MLBTracker then adopt them and restructure their own harnesses.

**Architecture:** Three layers, landed strictly upstream-first.
1. **Bedrock (platform, v0.11.0):** an opt-in, whitelist-validated SQLite pragma hook in `DatabaseManager`; a pruned in-place `os.walk` inventory (`iter_source_files`) with per-process memoization shared by every `run_all` audit; an opt-in `setLogLevel` control on the Pino `log` export.
2. **Consumers (CollectIt, MLBTracker):** dual-pin bump to `v0.11.0`, test DB opted into WAL/`synchronous=NORMAL` with sidecar-aware teardown, Vitest `threads` pool with per-project isolation, incremental `tsc`, pinned tooling, and a non-blocking multi-lane `run_qa.py`.
3. **Verification:** one final full-suite benchmark per repo against the baselines below, then PRs.

**Tech Stack:** Python 3.11, SQLite 3.38+, pytest, Loguru, TypeScript ~6.0, Vite, Vitest 2.1, Pino, knip, vulture, PowerShell 7.

**Spec:** `docs/specs/2026-09-24-qa-performance-and-harness-acceleration-design.md`
**Profile data:** `scratch/performance/benchmark-notes.md` (bottleneck IDs B*, F*, A*, T*, C* and remediation IDs R* below refer to that file).

**Supersedes:** `docs/plans/2026-09-24-qa-performance-and-harness-acceleration.md` (bedrock-only, targeted v0.10.4). Retire it to `docs/archive/` in the Phase 2 release PR (§S008).

---

## Baseline Profile

| Lane | Baseline | Share | Root cause | Remediation |
| ---- | -------- | ----- | ---------- | ----------- |
| pytest | 164 s | 49% | SQLite DELETE journal + `synchronous=FULL` → 12.96 ms/commit (WAL/NORMAL: 0.04 ms); teardown alone 30.2 s. Per-test autouse `default_test_entity` pandas queries. | Tasks 1.1, 3.2, 4.2 |
| vitest | 132 s | 39% | `pool=forks` + `isolate=true` (env 277 s + collect 288 s worker time); `tailwindcss()` instantiated per project; long-tail specs (`CsvImportSheet.test.tsx` 29.6 s, StudioPage trio 29 s). | Tasks 1.3, 3.3, 3.4, 4.3 |
| `bedrock.tools.run_all` | 24.3 s | 7% | 21+ unpruned `rglob` walks, each visiting 34,336 entries in `node_modules`/`.venv`/`.git`; `bedrock.toml` re-parsed per audit. | Task 1.2 |
| tsc + knip + vulture | ~15 s | 4.5% | `tsc -b` never up to date (`noEmit` without `incremental`); `npx knip` floats; vulture silently skipped. | Tasks 3.5, 4.3 |
| Harness structure | +26 s | — | `run_audit.ps1 -All` ⊂ `run_qa --mode full` (double execution); every lane runs sequentially. | Tasks 3.6, 4.4 |

## Target Profile

| Lane | Baseline | Target | Evidence |
| ---- | -------- | ------ | -------- |
| pytest | 164 s | ≤ 85 s | WAL/NORMAL measured at 81.9 s, all green |
| vitest | 132 s | ≤ 105 s | `threads` measured at 119 s; isolation + tailwind + splits projected |
| run_all | 24.3 s | ≤ 7 s | pruned walk measured 935 ms → 14 ms per walk |
| tsc (warm) | 9.5 s | ≤ 5 s | incremental measured 4.1–4.4 s warm |
| `run_qa --mode full` (wall) | ~336 s | **≤ 130 s** | lanes ≈ max(pytest, vitest+tsc+knip, audits) + contention |
| `run_audit.ps1 -All` | ~26 s | ≤ 8 s | pruned audits; no longer re-run inside full mode |

---

## Global Constraints

- **Platform boundary (§S001):** bedrock gains **zero** business-domain vocabulary and **zero** awareness of any application table. Every Phase 1 hook is generic (pragmas, file inventory, log level). Consumer-specific knowledge — which projects may drop isolation, which fixtures to cache, which lanes to run — lives only in the consumer repos.
- **Dual-pin lockstep (§S012, §S015):** `bedrock-api` (`packages/bedrock-api/pyproject.toml`) and `@djntechnic/bedrock-ui` (root `package.json`) move `0.10.3 → 0.11.0` together on tag `v0.11.0`. Each consumer moves both pins in one commit and regenerates its lockfile in the same PR. No consumer pins `v0.11.0` until `git ls-remote --tags origin v0.11.0` returns the tag.
- **SQL placeholders (§S007):** every parameterized query written or touched by this plan uses `%s` exclusively, routed through `DatabaseManager._adapt_sql` — never `?`, never string concatenation of values. `PRAGMA` statements cannot bind parameters in SQLite; pragma names are therefore checked against a closed frozenset and values against `^[A-Za-z0-9_-]+$` **before** interpolation. That validation is the only sanctioned exception, and it is tested.
- **Config surface (§S004):** the pragma setting is a boot-time value declared once in `core/config.py` (exempt from the raw-`os.environ` rule as the config surface itself), typed, with an empty default. The unset default reproduces today's behavior byte-for-byte — the hook is strictly opt-in.
- **Fixed invariants:** `PRAGMA foreign_keys = ON` and `PRAGMA busy_timeout` stay unconditional in `_create_sqlite_connection` and cannot be overridden by the hook.
- **Test isolation (§S005):** all four live-DB canaries and the mtime witness remain in both consumer conftests. WAL sidecars (`-wal`, `-shm`) exist only next to the temp copy; teardown deletes them and still refuses any path that resolves (case-insensitively) to the live DB.
- **Audit parity (§S001–§S015, §S100):** the migration to `iter_source_files` must produce **identical violation lists**, not merely identical exit codes, on bedrock, CollectIt, and MLBTracker.
- **Logging (§S003):** no `console.*` / `print()` added outside `scripts/**` and `bedrock/tools/**` exemptions. `setLogLevel` configures the existing `log`; no consumer creates a local logger twin (§S001).
- **No new unapproved dependencies:** knip and vulture are already in use and are merely pinned/declared. pytest-xdist and happy-dom are **out of scope** (they need an explicit owner decision).
- **Typing:** no `any`, `@ts-ignore`, or `@ts-expect-error` as fixes (§S005).
- **Delta testing:** every task's verification command targets **< 30 s**. Full suites (`pytest` whole, `vitest run` whole, `run_qa --mode full`) run **only in Phase 5**. CI runs the full suites on every PR regardless (§S005).
- **Branching (§S006):** one concern per branch. Bedrock: `feat/qa-performance-platform-acceleration-impl`. Pin bumps: the branch `/bump-bedrock-pin` creates. Consumer optimizations: `perf/test-harness-acceleration` in each consumer. PR target is `master` in all three repos.
- **Exit status:** every command is checked by `$LASTEXITCODE -eq 0` (pwsh) or `$?` (bash); never pipe a test command through `tail`/`Select-Object` in a way that masks its status.
- **Scratch work:** before/after audit captures and benchmark logs go under `scratch/performance/` in the repo being measured; nothing there is committed.

## Review Focus

1. **Pragma injection surface.** `BEDROCK_SQLITE_PRAGMAS="journal_mode=WAL; DROP TABLE x"` or a non-whitelisted key (`writable_schema`) must raise `ValueError` at parse time and never reach `conn.execute`. Pinned to Task 1.1: `test_sqlite_pragmas_reject_injection`, `test_sqlite_pragmas_reject_unknown_key`.
2. **Invariant pragmas cannot be disabled.** A pragma dict containing `foreign_keys=OFF` or `busy_timeout=0` is rejected. Pinned to Task 1.1: `test_sqlite_pragmas_cannot_override_invariants`.
3. **Pruning false positives.** `iter_source_files` prunes by exact directory **name** only; `packages/bedrock-api/`, `routes/exports/` (when assets excluded only for S009), and a file literally named `build.py` must survive. Pinned to Task 1.2: `test_iter_source_files_preserves_nested_sources`, `test_iter_source_files_prunes_by_dirname_not_substring`.
4. **Stale memoization.** A cached inventory must not leak between two `run_all` invocations on different roots in one process (the test suite does exactly this). Pinned to Task 1.2: `test_source_cache_keyed_by_root`, `test_run_all_clears_cache_on_entry`.
5. **Logger opt-in semantics.** Without an explicit `setLogLevel` call, the level remains `appSettings.logging.level` — v0.11.0 must not silence anything by default. Pinned to Task 1.3: `logger.test.ts › leaves default level unchanged`.
6. **WAL sidecar teardown vs. canaries.** Teardown deletes `<tmp>.db-wal` / `<tmp>.db-shm` only after re-asserting the base path is not live; a sidecar path is derived from the verified base path, never globbed. Pinned to Tasks 3.2 / 4.2: `test_teardown_removes_wal_sidecars`, `test_teardown_refuses_live_sidecars`.
7. **Lane exit aggregation.** A failing lane that finishes **before** a passing lane must still fail the run; lane output must never interleave. Pinned to Tasks 3.6 / 4.4: `test_run_qa_worst_lane_exit_wins`, `test_run_qa_lane_output_is_contiguous`.
8. **Silently dropped tests.** After the Vitest workspace change, the file count vitest reports must equal the count on disk (CollectIt: 102, not 100). Pinned to Task 3.3.

---

## Phase 1 — Upstream Bedrock Pragma Hooks, Pruned Traversal & Test Logger (`C:\Dev\bedrock`)

Branch: `feat/qa-performance-platform-acceleration-impl` off freshly pulled `master`. Tasks 1.1, 1.2, and 1.3 touch disjoint files and may be dispatched in parallel.

### Task 1.1: Configurable SQLite connection pragmas (WAL/NORMAL hook) in `DatabaseManager`

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`
- **Addresses:** B1, B3, R1 (proper fix)

**Files:**
- Modify: `packages/bedrock-api/bedrock/core/config.py` (next to `SQLITE_BUSY_TIMEOUT`, ~L48)
- Modify: `packages/bedrock-api/bedrock/core/database.py` (`DatabaseManager.__init__` ~L126, `_create_sqlite_connection` L174–194)
- Test: `packages/bedrock-api/tests/test_database.py`
- Test: `packages/bedrock-api/tests/test_config.py`

**Interface Contract:**
- Consumes: `bedrock.core.config.config`
- Produces:
  ```python
  # bedrock.core.config — boot-time setting, env var BEDROCK_SQLITE_PRAGMAS
  # Format: "journal_mode=WAL,synchronous=NORMAL" (comma-separated key=value). Unset → {}.
  @property
  def SQLITE_PRAGMAS(self) -> dict[str, str]: ...

  # bedrock.core.database
  ALLOWED_SQLITE_PRAGMAS: frozenset[str] = frozenset({
      "journal_mode", "synchronous", "cache_size", "temp_store",
      "mmap_size", "wal_autocheckpoint",
  })
  INVARIANT_SQLITE_PRAGMAS: frozenset[str] = frozenset({"foreign_keys", "busy_timeout"})

  def parse_sqlite_pragmas(raw: str | Mapping[str, str | int] | None) -> dict[str, str]:
      """Validate and normalize. Raises ValueError on unknown/invariant keys or unsafe values."""

  class DatabaseManager:
      def configure_sqlite_pragmas(self, pragmas: Mapping[str, str | int]) -> None:
          """Validate, store, and drop the calling thread's cached connection so the
          next acquisition applies the new set. Consumers call this after swapping
          `sqlite_path` (e.g. a test DB copy)."""
  ```
- `_create_sqlite_connection` applies, in order: `foreign_keys = ON`, `busy_timeout`, then each validated pragma in insertion order. `journal_mode` is applied first among the configurable set because it is persistent in the file.
- No-op on the Postgres branch (`is_postgres` → pragmas ignored, one `logger.debug` line).
- Platform standards touched: §S004, §S007, §S003 (`logger.info("SQLite pragmas applied: {pragmas}", pragmas=...)` once per manager, not per connection).

**Delta Verification:**
- Command: `pytest packages/bedrock-api/tests/test_database.py packages/bedrock-api/tests/test_config.py -k "pragma" -q`
- Target runtime: `< 15 s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [x] Write failing tests:
  - `test_sqlite_pragmas_default_is_empty` — unset env → `{}`; a new connection reports `journal_mode=delete` (behavior unchanged).
  - `test_sqlite_pragmas_applied_on_connection` — `configure_sqlite_pragmas({"journal_mode": "WAL", "synchronous": "NORMAL"})` on a `tmp_path` DB → `PRAGMA journal_mode` returns `wal`, `PRAGMA synchronous` returns `1`.
  - `test_sqlite_pragmas_env_parsing` — `monkeypatch.setenv("BEDROCK_SQLITE_PRAGMAS", "journal_mode=WAL,synchronous=NORMAL")`.
  - `test_sqlite_pragmas_reject_injection` — value `"WAL; DROP TABLE x"` → `ValueError`, and `conn.execute` never called (spy).
  - `test_sqlite_pragmas_reject_unknown_key` — `writable_schema=ON` → `ValueError`.
  - `test_sqlite_pragmas_cannot_override_invariants` — `foreign_keys=OFF` → `ValueError`.
  - `test_configure_sqlite_pragmas_resets_thread_connection` — the cached thread-local connection is replaced.
  - `test_sqlite_pragmas_ignored_on_postgres` — manager with `is_postgres=True` does not raise.
- [x] Run delta verification; confirm FAIL.
- [x] Implement `SQLITE_PRAGMAS` in `config.py` and `ALLOWED_SQLITE_PRAGMAS`, `INVARIANT_SQLITE_PRAGMAS`, `parse_sqlite_pragmas`, `configure_sqlite_pragmas` in `database.py`. Existing `%s` → `?` adaptation in `_adapt_sql` is untouched.
- [x] Run delta verification; confirm PASS with `$LASTEXITCODE -eq 0`.
- [x] Run `pytest packages/bedrock-api/tests/test_database.py packages/bedrock-api/tests/test_database_pooling.py -q` (< 30 s) to prove no regression in connection handling.
- [x] Commit: `feat(bedrock-api): add opt-in whitelisted SQLite pragma hook`

---

### Task 1.2: Pruned in-place `os.walk` traversal in `_config.iter_source_files` and `run_all` memoization

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`
- **Addresses:** A1, A2, R9

**Files:**
- Modify: `packages/bedrock-api/bedrock/tools/_config.py` (beside `DEFAULT_IGNORED_DIRS` L28, `DATA_ASSET_DIRS` L46, `load_bedrock_config` L274)
- Modify: `packages/bedrock-api/bedrock/tools/run_all.py` (`run_all` L108)
- Modify (replace every `rglob`, 24 call sites): `s001_audit_duplicates.py`, `s002_audit_grids.py`, `s003_audit_logging.py`, `s004_audit_config.py`, `s005_audit_testing.py`, `s007_audit_schema_catalog.py`, `s008_audit_guidance.py`, `s009_audit_design_tokens.py`, `s010_audit_security.py`, `s011_audit_navigation.py`, `audit_taxonomy_and_casing.py`, `remediate_taxonomy_and_casing.py`
- Create: `packages/bedrock-api/tests/test_tools_config.py`
- Test (existing, parity): `packages/bedrock-api/tests/test_audit_*.py`, `packages/bedrock-api/tests/test_run_all.py`

**Interface Contract:**
- Consumes: `DEFAULT_IGNORED_DIRS`, `DATA_ASSET_DIRS`
- Produces:
  ```python
  # bedrock.tools._config
  def iter_source_files(
      root: Path,
      suffixes: tuple[str, ...],
      *,
      include_assets: bool = True,
      extra_ignored: frozenset[str] = frozenset(),
  ) -> tuple[Path, ...]:
      """os.walk(root) with dirnames[:] pruned in place against
      DEFAULT_IGNORED_DIRS | extra_ignored (| DATA_ASSET_DIRS when include_assets=False).
      Sorted, immutable, memoized on (resolved root, suffixes, include_assets, extra_ignored)."""

  def clear_source_cache() -> None: ...

  @functools.lru_cache(maxsize=8)
  def load_bedrock_config(repo_root: Path | None = None) -> BedrockConfig: ...  # memoized; cleared by clear_source_cache()
  ```
- `run_all.run_all()` calls `clear_source_cache()` on entry, so each suite invocation sees a fresh tree but all audits inside it share one walk per suffix set.
- Each audit keeps its own post-walk filtering (exemption globs, per-audit rules) exactly as today — only the enumeration changes.
- Platform standards touched: all audit gates §S001–§S015, §S100 (results must be invariant).

**Delta Verification:**
- Command: `pytest packages/bedrock-api/tests/test_tools_config.py packages/bedrock-api/tests/test_run_all.py -q`
- Target runtime: `< 15 s`
- Exit code verification: `$LASTEXITCODE -eq 0`
- Parity command (per repo, before and after): `python -m bedrock.tools.run_all --root <repo> > scratch/performance/run_all-<repo>-{before,after}.txt`, then compare with elapsed-time columns stripped.

- [x] **Capture baseline first:** run the parity command on `C:\Dev\bedrock`, `C:\Dev\CollectIt`, `C:\Dev\MLBTracker` with the current code; store under `scratch/performance/`. (bedrock baseline captured via pre-migration stash; CollectIt/MLBTracker parity deferred to Task 3.5's cross-repo re-run in Phase 3, out of scope for this bedrock-only Task 1.2 pass.)
- [x] Write failing tests in `test_tools_config.py`:
  - `test_iter_source_files_prunes_ignored_directories` — tree with `.venv/a.py`, `node_modules/b.js`, `.git/c.py`, `src/app.py`; assert only `src/app.py`, and (via an `os.walk` spy) that no ignored directory is ever descended into.
  - `test_iter_source_files_preserves_nested_sources` — `packages/bedrock-api/bedrock/x.py` survives.
  - `test_iter_source_files_prunes_by_dirname_not_substring` — `build.py`, `rebuild/x.py`, and `my_dist/y.py` survive.
  - `test_iter_source_files_handles_data_assets` — `data/`, `imports/`, `exports/` included by default, excluded with `include_assets=False`.
  - `test_iter_source_files_filters_suffixes` — `(".ts", ".tsx")` returns no `.py`.
  - `test_source_cache_keyed_by_root` — two roots in one process return disjoint results.
  - `test_run_all_clears_cache_on_entry` — a file created between two `run_all` calls is seen by the second.
- [x] Run delta verification; confirm FAIL.
- [x] Implement `iter_source_files`, `clear_source_cache`, and `load_bedrock_config` memoization.
- [x] Replace all 24 `rglob` call sites (23 found in the audited tree). Where an audit relied on `rglob` including a `DATA_ASSET_DIRS` path, preserve it via `include_assets=True`; S009 keeps its existing asset exclusion via `include_assets=False`.
- [x] Run `pytest packages/bedrock-api/tests -k "audit or run_all or tools_config" -q` (< 30 s); confirm PASS.
- [x] Re-run the parity command on all three repos; the violation lists must be **identical**. Any difference is a Class B defect (§S006) — halt, do not adjust the expected output. (bedrock: identical violation content pre/post migration, confirmed by diff with the git-status-driven §S006 dirty-tree line excluded as expected WIP noise.)
- [x] Record the `run_all` elapsed total per repo in `scratch/performance/` for Phase 5.
- [x] Commit: `perf(bedrock-tools): prune ignored dirs during walk and memoize audit inventory`

---

### Task 1.3: Opt-in test logging silence/level toggle in `@djntechnic/bedrock-ui`

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`
- **Addresses:** F6, R8

**Files:**
- Modify: `packages/bedrock-ui/src/utils/logger.ts` (the `pino({...})` export at L11)
- Modify: `packages/bedrock-ui/src/index.ts` (already `export * from "./utils/logger"` at L199 — verify the new names flow through)
- Create: `packages/bedrock-ui/src/utils/logger.test.ts`
- Regenerate: `packages/bedrock-ui/dist/**` via `npm run build` (consumers install built ESM)

**Interface Contract:**
- Consumes: `pino`, `appSettings.logging.level`
- Produces:
  ```typescript
  export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  export function setLogLevel(level: LogLevel): void;   // mutates log.level on the shared instance
  export function getLogLevel(): LogLevel;
  ```
- **Opt-in only.** No environment auto-detection. Default level remains `appSettings.logging.level` (`VITE_APP_LOG_LEVEL` or `"info"`). Consumers silence tests by calling `setLogLevel("silent")` in their Vitest setup file.
- `setLogLevel` rejects an unknown string at the type level; no runtime cast.
- Platform standards touched: §S001, §S003.

**Delta Verification:**
- Command: `npx vitest run packages/bedrock-ui/src/utils/logger.test.ts`
- Target runtime: `< 15 s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Write failing tests:
  - `leaves default level unchanged` — `getLogLevel()` equals `appSettings.logging.level` on import.
  - `setLogLevel("silent") suppresses all output` — a pino destination spy receives nothing for `log.error`.
  - `setLogLevel round-trips` — `setLogLevel("debug")` → `getLogLevel() === "debug"` and `log.level === "debug"`.
  - `lib/logger facade honors the level` — `logger.info` from `lib/logger.ts` is suppressed under `"silent"`.
- [ ] Run delta verification; confirm FAIL.
- [ ] Implement `LogLevel`, `setLogLevel`, `getLogLevel`; restore level in `afterEach` of the test file.
- [ ] Run delta verification; confirm PASS.
- [ ] `npm run build` and commit the regenerated `dist/` for the logger only; discard unrelated `dist/` churn (e.g. the pre-existing `dist/components/ui/sheet.js.map` modification) with `git restore` after confirming it is not produced by this task.
- [ ] Commit: `feat(bedrock-ui): add opt-in setLogLevel/getLogLevel controls to log`

---

## Phase 2 — Upstream Platform Release & Tagging (`C:\Dev\bedrock`)

### Task 2.1: §S015-compliant CHANGELOG, v0.11.0 manifests, tag, and verify

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`
- **Skill:** `/cut-release v0.11.0`

**Files:**
- Modify: `packages/bedrock-api/pyproject.toml` (`version = "0.10.3"` → `"0.11.0"`)
- Modify: `package.json` (root; `"version": "0.10.3"` → `"0.11.0"`)
- Modify: `CHANGELOG.md`
- Move: `docs/plans/2026-09-24-qa-performance-and-harness-acceleration.md` → `docs/archive/` (superseded; fix incoming links per §S008)

**Interface Contract:**
- Version is **minor** (`0.11.0`): three new public surfaces (`configure_sqlite_pragmas` / `BEDROCK_SQLITE_PRAGMAS`, `iter_source_files`, `setLogLevel` / `getLogLevel`). All are additive and opt-in.
- CHANGELOG entry `## v0.11.0 - <date>` in the repo's existing §S015 heading order:
  - `### Added - opt-in SQLite connection pragmas` (whitelist, invariants, env format, production note that WAL/NORMAL suits single-host SQLite)
  - `### Added - setLogLevel / getLogLevel in @djntechnic/bedrock-ui`
  - `### Changed - audit file discovery prunes ignored directories during the walk` (results unchanged; `run_all` ~24 s → ~6 s)
  - `### Breaking changes` — `None.` stated explicitly
  - `### For consumers` — the exact `conftest.py` opt-in snippet, the `-wal`/`-shm` teardown requirement, and the Vitest `setup.ts` one-liner; bump both pins with `/bump-bedrock-pin v0.11.0`.

**Delta Verification:**
- Command: `pytest packages/bedrock-api/tests/test_audit_release_version.py packages/bedrock-api/tests/test_audit_s015_release_notes.py -q`
- Target runtime: `< 15 s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Run `python -m bedrock.tools.run_all --root .`; exit 0.
- [ ] Bump both manifests to `0.11.0` in one commit; write the CHANGELOG entry; archive the superseded plan.
- [ ] Run delta verification; confirm PASS.
- [ ] Release gates (the one sanctioned full run in bedrock, required by `/cut-release`): `npm test`, then `npm run typecheck`, then `pytest` in `packages/bedrock-api`.
- [ ] Open the PR, watch CI with background `gh pr checks <pr> --watch` (yield; no sleep-polling), squash-merge on green.
- [ ] Tag the merge commit by full 40-char SHA: `git tag v0.11.0 <sha>`; `git push origin v0.11.0`.
- [ ] Verify: `git ls-remote --tags origin v0.11.0` returns the SHA. **If the push returns HTTP 403, the tag does not exist — stop, hand the user the commands, and do not start Phase 3.**
- [ ] `git pull origin master`; `git status --porcelain` is empty.

---

## Phase 3 — CollectIt Consumer Adoption & Optimization (`C:\Dev\CollectIt`)

Precondition: Task 2.1 verified tag. Task 3.1 merges first as its own PR; Tasks 3.2–3.6 land as commits on `perf/test-harness-acceleration` cut from the post-bump `master`. Tasks 3.3/3.4/3.5 (frontend) and 3.2 (backend) are independent and may be dispatched in parallel; 3.6 goes last.

### Task 3.1: Dual-pin bump to v0.11.0 and lockfile regeneration (§S012)

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `flash`
- **Skill:** `/bump-bedrock-pin v0.11.0`

**Files:**
- Modify: `requirements.txt` (L70: `bedrock-api @ git+https://github.com/djntechnic/bedrock@v0.11.0#subdirectory=packages/bedrock-api`)
- Modify: `frontend/package.json` (L14: `"@djntechnic/bedrock-ui": "github:djntechnic/bedrock#v0.11.0"`)
- Regenerate: `frontend/package-lock.json`

**Delta Verification:**
- Command: `python -m bedrock.tools.s012_audit_pins --root .` then `pytest api/tests -k "pins" -q`
- Target runtime: `< 15 s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Confirm `git ls-remote --tags https://github.com/djntechnic/bedrock v0.11.0`.
- [ ] Edit both pins in one commit; `pip install -r requirements.txt` into `.venv`; `npm install --no-audit --no-fund` in `frontend/` (never `--legacy-peer-deps`).
- [ ] Prove the install: `python -c "import bedrock.core.database as d; print(d.ALLOWED_SQLITE_PRAGMAS)"` and `grep -q setLogLevel frontend/node_modules/@djntechnic/bedrock-ui/dist/index.d.ts`.
- [ ] Run delta verification; open the PR; CI green; squash-merge; sync `master`.

---

### Task 3.2: Opt-in test DB to WAL/NORMAL, sidecar teardown, cached `default_test_entity`

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`
- **Addresses:** B1, B2, B3, R1, R3

**Files:**
- Modify: `api/tests/conftest.py` (`test_db_session` L71+, canaries #2/#3 L90–113, teardown ~L163, mtime witness L198–202; `_signed_in` / `superuser_auth` / `default_test_entity` fixtures)
- Create: `api/tests/test_conftest_isolation.py`

**Interface Contract:**
- After canary #3 passes and the singleton points at the temp copy: `db.configure_sqlite_pragmas({"journal_mode": "WAL", "synchronous": "NORMAL"})`. No `BEDROCK_SQLITE_PRAGMAS` in the environment — the opt-in is explicit and scoped to the test session.
- Teardown order: (1) close all connections, (2) re-assert the base path is not live (existing guard), (3) delete `Path(f"{test_db}-wal")` and `Path(f"{test_db}-shm")` if present, (4) delete the base file, (5) mtime witness.
- `default_test_entity` becomes `scope="session"` (it is read-only for a run); `_signed_in` / `superuser_auth` keep their per-test `mock.patch` pairs but consume the cached value — no pandas query per test.
- Platform standards touched: §S005 (all four canaries retained), §S007 (any fixture SQL touched keeps `%s`).

**Delta Verification:**
- Command: `pytest api/tests/test_conftest_isolation.py api/tests/test_auth.py -q -p no:cacheprovider`
- Target runtime: `< 25 s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Write failing tests:
  - `test_test_db_uses_wal` — `PRAGMA journal_mode` on the session DB returns `wal`; `PRAGMA synchronous` returns `1`.
  - `test_teardown_removes_wal_sidecars` — invoke the extracted teardown helper against a `tmp_path` DB with sidecars; none remain.
  - `test_teardown_refuses_live_sidecars` — a base path that resolves (case-varied) to the live DB raises before any `unlink`.
  - `test_default_test_entity_is_session_cached` — a query-count spy shows one fetch across two tests.
- [ ] Run delta verification; confirm FAIL.
- [ ] Extract teardown into a helper (`_remove_test_db(test_db: Path) -> None`) so it is testable; implement the pragma opt-in and session cache.
- [ ] Run delta verification; confirm PASS.
- [ ] Commit: `perf(tests): run test DB under WAL/NORMAL with sidecar-safe teardown`

---

### Task 3.3: Vitest workspace — `threads` pool, selective isolation, theme tests, no Tailwind under Vitest

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`
- **Addresses:** F1, F2, F3, F5, F6, R5, R7, R8

**Files:**
- Modify: `frontend/vite.config.ts` (L14 `plugins: [react(), tailwindcss()]`; `test` block; keep L117 `server.deps.inline`)
- Modify: `frontend/vitest.workspace.ts` (projects `ui-primitives` L19, `domain-features` L32, `hooks-and-state` L49, `platform-contracts` L61)
- Modify: `frontend/src/test/setup.ts` (`setLogLevel("silent")` from `@djntechnic/bedrock-ui`)

**Interface Contract:**
- `plugins: [react(), ...(process.env.VITEST ? [] : [tailwindcss()])]` — `css: false` already holds under test.
- `test.pool: "threads"` globally.
- `isolate: false` **only** on `hooks-and-state` and `platform-contracts` (verified green without isolation). `domain-features` and `ui-primitives` keep `isolate: true` — no weakening until their shared state is fixed at source (out of scope).
- `src/theme/**` added to `ui-primitives` `include`, bringing `CollectItThemeBootstrap.test.tsx` and `palettes.test.ts` into the suite.
- Platform standards touched: §S001 (log via bedrock-ui), §S003, §S005 (no `it.skip`; a newly included failing test is fixed inline as Class A or halts the branch as Class B).

**Delta Verification:**
- Command: `npx vitest run --project hooks-and-state --project platform-contracts` then `npx vitest run src/theme`
- Target runtime: `< 30 s` each
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Record `npx vitest list --reporter=json | ...` file count before (expect 100) and the on-disk `*.test.ts(x)` count (expect 102).
- [ ] Apply the config changes.
- [ ] Run delta verification; confirm PASS.
- [ ] `npx vitest list` file count now equals the on-disk count (102). Any residual gap is investigated, not waived.
- [ ] Confirm no pino JSON lines appear in the delta run output.
- [ ] Commit: `perf(frontend): threads pool, per-project isolation, include orphaned theme tests`

---

### Task 3.4: Long-tail spec refactoring — shard `CsvImportSheet.test.tsx`, cheaper queries

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`
- **Addresses:** F4, R6

**Files:**
- Split: `CsvImportSheet.test.tsx` (29.6 s, 45 tests) → one file per wizard step (e.g. `CsvImportSheet.upload.test.tsx`, `.mapping.test.tsx`, `.review.test.tsx`, `.commit.test.tsx`) plus a shared `CsvImportSheet.fixtures.ts` holding the 7 `vi.mock` factories' data (mocks themselves stay per file — `vi.mock` is hoisted per module)
- Modify: `StudioPage.test.tsx`, `StudioPage.issues.test.tsx`, `StudioPage.guided.test.tsx` — query cost only, no split required

**Interface Contract:**
- Test **count** is preserved exactly (45 for CsvImportSheet); no assertion is dropped or weakened.
- In hot loops, `getByRole(name)` → `getByLabelText` / `getByRole(..., { hidden: true })` only where the accessible-name assertion is not itself the thing under test. Tests that verify accessibility keep `*ByRole`.
- Platform standards touched: §S005.

**Delta Verification:**
- Command: `npx vitest run CsvImportSheet`
- Target runtime: `< 30 s` (each shard ≲ 8 s)
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Record per-file durations with `--reporter=verbose` before.
- [ ] Split the file; run delta verification; confirm 45 tests pass.
- [ ] Apply query optimizations to the StudioPage trio; `npx vitest run StudioPage` (< 30 s) passes with an unchanged test count.
- [ ] Record per-file durations after in `scratch/performance/`.
- [ ] Commit: `perf(frontend): shard CsvImportSheet spec and trim ByRole hot paths`

---

### Task 3.5: TypeScript incremental caching and pinned knip/vulture

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `flash`
- **Addresses:** T1, T2, T3, R12, R13

**Files:**
- Modify: `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json` (add `"incremental": true`; keep existing `tsBuildInfoFile` at L3 and `noEmit` at L15)
- Modify: `frontend/package.json` (`knip` as exact-version devDependency; `"knip": "npm exec knip"` script)
- Modify: `frontend/package-lock.json`
- Modify: `requirements-dev.txt` (or the repo's declared dev manifest) — add `vulture` pinned
- Modify: `.github/workflows/ci.yml` — cache `frontend/node_modules/.tmp/*.tsbuildinfo` keyed on `hashFiles('frontend/package-lock.json','frontend/tsconfig*.json')`

**Interface Contract:**
- `tsc -b --noEmit` reports up to date on a second run with no source change.
- knip resolves from `node_modules/.bin`, never an npx cache. Resolve the existing `.css` configuration hint.
- §S004: vulture declared in the manifest in this PR and proven in a fresh venv (`python -m venv scratch/venv-proof && scratch/venv-proof/Scripts/pip install -r requirements-dev.txt && scratch/venv-proof/Scripts/vulture --version`).

**Delta Verification:**
- Command: `npx tsc -b --noEmit` (twice; second run is timed) then `npm exec knip`
- Target runtime: second `tsc` `< 5 s`; knip `< 6 s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Apply tsconfig changes; run twice; confirm warm run ≤ 5 s and `tsc -b --verbose` no longer says "out of date because output file … does not exist".
- [ ] Pin knip, add script, regenerate lockfile, fix the hint.
- [ ] Declare vulture; prove it in the fresh venv; delete the proof venv.
- [ ] Add the CI buildinfo cache step.
- [ ] Commit: `perf(tooling): incremental tsc, pinned knip, declared vulture`

---

### Task 3.6: Non-blocking multi-lane parallel runner in `scripts/run_qa.py`

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`
- **Addresses:** A3, A4, A5, B7, R4, R10, R11, R15

**Files:**
- Modify: `scripts/run_qa.py`
- Modify: `scripts/run_audit.ps1` (help text and duplicate lines only)
- Create: `api/tests/test_run_qa_lanes.py`
- Modify: `CLAUDE.md` (dev-command guidance: `run_qa --mode full` supersedes `run_audit.ps1 -All`; stay ≤ 200 lines per §S008)

**Interface Contract:**
```python
@dataclass(frozen=True)
class LaneResult:
    name: str
    exit_code: int
    elapsed_s: float
    output: str

def run_lanes(lanes: Mapping[str, Sequence[Sequence[str]]], *, max_workers: int = 3) -> list[LaneResult]:
    """Each lane runs its commands sequentially via subprocess.Popen, stopping at the first
    non-zero exit; lanes run concurrently in a ThreadPoolExecutor. Output is captured per lane
    and printed contiguously as each lane completes."""

def aggregate_exit(results: Sequence[LaneResult]) -> int:
    """2 if any lane exited 2, else 1 if any non-zero, else 0."""
```
- Full-mode lanes:
  - **A — backend:** `pytest` (without the redundant CLI `-q` that stacked to `-qq`, restoring the summary footer).
  - **B — frontend:** `npx vitest run --reporter=dot --maxWorkers=6` → `npx tsc -b --noEmit` → `npm exec knip`.
  - **C — audits:** `python -m bedrock.tools.run_all --root .` → domain audits s101–s103 → vulture.
- Fast/scoped modes keep their current semantics.
- Remove merge-artifact duplicates (`DOMAIN_AUDIT_DIR` double assignment, double glob, duplicate header lines in `run_audit.ps1`).
- Platform standards touched: §S003 (`scripts/**` exempt, output still structured per lane), §S005.

**Delta Verification:**
- Command: `pytest api/tests/test_run_qa_lanes.py -q`
- Target runtime: `< 10 s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Write failing tests using trivial `python -c` commands as lane steps:
  - `test_run_qa_worst_lane_exit_wins` — lane `fail` (exit 1, finishes first) + lane `slow_pass` → aggregate 1.
  - `test_run_qa_config_error_dominates` — exits `{0, 1, 2}` → 2.
  - `test_run_qa_lane_stops_at_first_failure` — second step of a failing lane never runs.
  - `test_run_qa_lane_output_is_contiguous` — two lanes emitting interleaved-by-time lines produce two contiguous blocks.
  - `test_run_qa_lanes_run_concurrently` — two 1 s sleeps complete in < 1.8 s.
- [ ] Run delta verification; confirm FAIL.
- [ ] Implement `run_lanes`, `aggregate_exit`, wire full mode; clean duplicates; fix B7.
- [ ] Run delta verification; confirm PASS.
- [ ] Commit: `perf(qa): run backend, frontend, and audit lanes in parallel`

---

## Phase 4 — MLBTracker Consumer Adoption & Optimization (`C:\Dev\MLBTracker`)

Precondition: Task 2.1 verified tag. Apply the CollectIt patterns; MLBTracker's specifics are called out below. Task 4.1 merges first as its own PR; 4.2–4.4 land on `perf/test-harness-acceleration`.

### Task 4.1: Dual-pin bump to v0.11.0 and lockfile regeneration (§S012)

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `flash`
- **Skill:** `/bump-bedrock-pin v0.11.0`

**Files:**
- Modify: `requirements.txt` (L70 → `@v0.11.0`)
- Modify: `frontend/package.json` (L15 → `#v0.11.0`)
- Regenerate: `frontend/package-lock.json`

**Delta Verification:**
- Command: `python -m bedrock.tools.s012_audit_pins --root .`
- Target runtime: `< 10 s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Identical procedure to Task 3.1 (verify tag, both pins in one commit, install without `--legacy-peer-deps`, prove the install, CI green, squash-merge, sync).

---

### Task 4.2: Adopt the WAL/NORMAL hook in `api/tests/conftest.py` with sidecar cleanup

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `api/tests/conftest.py`
- Create: `api/tests/test_conftest_isolation.py`

**Interface Contract:**
- Same contract as Task 3.2: `db.configure_sqlite_pragmas({"journal_mode": "WAL", "synchronous": "NORMAL"})` after the singleton swap and its canary; `-wal`/`-shm` removal derived from the verified base path inside an extracted, testable teardown helper; every existing canary and the mtime witness retained unchanged.
- Audit MLBTracker's autouse/function-scoped fixtures for a read-only per-test query equivalent to CollectIt's `default_test_entity`; session-cache it only if it is read-only for the run. If none exists, record "not applicable" in the commit body.

**Delta Verification:**
- Command: `pytest api/tests/test_conftest_isolation.py -q`
- Target runtime: `< 20 s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Write the four isolation tests from Task 3.2 (WAL active, sidecars removed, live sidecars refused, cache — or omit the cache test if not applicable); confirm FAIL.
- [ ] Implement; confirm PASS.
- [ ] Commit: `perf(tests): run test DB under WAL/NORMAL with sidecar-safe teardown`

---

### Task 4.3: Vitest threading, project isolation audit, and incremental `tsc`

- **Target Agent:** `@frontend-ui-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `frontend/vite.config.ts` (L9 `plugins: [react(), tailwindcss()]` → skip Tailwind under `VITEST`; `test.pool: "threads"`)
- Modify: `frontend/vitest.workspace.ts` (projects `components` L13, `pages-hooks` L20, `lib-state` L27)
- Modify: `frontend/src/test/setup.ts` (`setLogLevel("silent")`)
- Modify: `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json` (`"incremental": true`)
- Modify: `frontend/package.json` (`knip` is `^6.36.0` — pin to the exact installed version)
- Modify: `.github/workflows/ci.yml` (tsbuildinfo cache)

**Interface Contract:**
- **Isolation audit, not assumption:** for each of the three projects, run `npx vitest run --project <name> --no-isolate`. Set `isolate: false` only on projects that pass green twice in a row; record the per-project result in the commit body. Others keep `isolate: true`.
- Verify vitest's listed file count equals the on-disk `*.test.ts(x)` count; include any orphaned directory (the CollectIt F5 defect class).
- Warm `tsc -b --noEmit` ≤ 5 s.

**Delta Verification:**
- Command: `npx vitest run --project lib-state` then `npx tsc -b --noEmit` (second run timed)
- Target runtime: `< 30 s` each
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Run the per-project `--no-isolate` audit; record results.
- [ ] Apply config, setup, tsconfig, knip, and CI changes.
- [ ] Run delta verification; confirm PASS and file-count parity.
- [ ] Commit: `perf(frontend): threads pool, audited isolation, incremental tsc, pinned knip`

---

### Task 4.4: Deploy the multi-lane parallel runner in `scripts/run_qa.py`

- **Target Agent:** `@backend-api-engineer`
- **Reasoning Tier:** `inherit`

**Files:**
- Modify: `scripts/run_qa.py`
- Modify: `scripts/run_audit.ps1`, `scripts/run_audit.bat` (help text / dedupe only)
- Create: `api/tests/test_run_qa_lanes.py`
- Modify: `CLAUDE.md` (≤ 200 lines, §S008)

**Interface Contract:**
- Same `LaneResult` / `run_lanes` / `aggregate_exit` contract and lane composition as Task 3.6, adapted to MLBTracker's domain-audit set and dead-code tooling. Implemented in-repo — `run_qa.py` is consumer harness code, not a platform surface, so it is not hoisted into bedrock.

**Delta Verification:**
- Command: `pytest api/tests/test_run_qa_lanes.py -q`
- Target runtime: `< 10 s`
- Exit code verification: `$LASTEXITCODE -eq 0`

- [ ] Port the five lane tests from Task 3.6; confirm FAIL; implement; confirm PASS.
- [ ] Commit: `perf(qa): run backend, frontend, and audit lanes in parallel`

---

## Phase 5 — Cross-Ecosystem Benchmark & PR Landings

### Task 5.1: Benchmark all three repos against baselines and open final PRs

- **Target Agent:** `@quality-gatekeeper`
- **Reasoning Tier:** `inherit`

**Files:**
- Create (uncommitted): `scratch/performance/results-2026-09-24.md` in each consumer
- PR bodies in CollectIt and MLBTracker

**This is the only phase that runs full suites.**

- [ ] Same machine, same power profile, no other heavy processes; one warm-up run discarded per repo.
- [ ] **bedrock:** `python -m bedrock.tools.run_all --root C:\Dev\CollectIt` and `--root C:\Dev\MLBTracker` — record wall time (target ≤ 7 s, baseline 24.3 s) and re-confirm violation parity against the Task 1.2 baselines.
- [ ] **CollectIt:** `python scripts/run_qa.py --mode full` — record total wall and per-lane time; then `pwsh scripts/run_audit.ps1 -All`.
- [ ] **MLBTracker:** the same two commands.
- [ ] Fill this table in each results file:

  | Lane | Baseline | Measured | Target | Pass? |
  | ---- | -------- | -------- | ------ | ----- |
  | pytest | 164 s | | ≤ 85 s | |
  | vitest | 132 s | | ≤ 105 s | |
  | run_all | 24.3 s | | ≤ 7 s | |
  | tsc (warm) | 9.5 s | | ≤ 5 s | |
  | `run_qa --mode full` wall | ~336 s | | ≤ 130 s | |
  | `run_audit.ps1 -All` | ~26 s | | ≤ 8 s | |
  | vitest files run / on disk | 100 / 102 | | equal | |

- [ ] Test counts must be ≥ baseline (CollectIt pytest 1629 passed; vitest 1032 tests + the two recovered theme files). A drop is a defect, not a speedup.
- [ ] Any failing test is classified (§S005): Class A fixed on the branch; Class B halts the PR and is filed via `/issue-triage` with origin trace.
- [ ] A missed target with all gates green is reported with its measured number — it does not block merge and is not rounded.
- [ ] Open a draft PR per consumer from `perf/test-harness-acceleration` → `master` via `/finalize-pr`. Body: defects addressed (bottleneck IDs), root causes, the results table, and the verification commands. End with the attribution line.
- [ ] Watch CI with background `gh pr checks <pr> --watch`; squash-merge only on all-green.
- [ ] After each merge: `git pull origin master`; `git status --porcelain` empty.

---

## Out of Scope (require an explicit owner decision)

- **pytest-xdist** (projected 30–35 s pytest): needs a per-worker DB copy with per-worker canaries and mtime witness; new dependency.
- **happy-dom** for `hooks-and-state` / `lib-state`: new dependency.
- **Dropping isolation in `domain-features` / `ui-primitives`:** requires fixing the shared module state (hoisted `vi.mock`, QueryClient/theme singletons) at source first.
- **Migration-chain DB reuse (R2)** and **CI no-op fast tier / duplicate s101 (R14):** separate concerns; file as follow-ups.

## Execution Handoff

```pwsh
git checkout master && git pull origin master && git checkout -b feat/qa-performance-platform-acceleration-impl
/triage-plan docs/plans/2026-09-24-ecosystem-test-and-audit-harness-optimization-plan.md
```

Triage-plan resolves each task to its target agent, enforces the active `.venv`, direct exit status, lockstep pins, and < 30 s delta testing, and supervises execution through `/deliver-task`. Phases 3 and 4 do not start until Phase 2's `git ls-remote` check returns the `v0.11.0` SHA.
