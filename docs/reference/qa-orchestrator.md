# QA orchestrator

`bedrock.tools.run_qa` is the one command that answers "what do I run before I
commit, before I open a PR, and before I merge". It ships in `bedrock-api`, so
bedrock and every consumer run the same code from their pin. Each repo keeps a
thin shim at `scripts/run_qa.py` that pins `--root` to the checkout.

## Running it

```bash
python scripts/run_qa.py --mode fast     # before every commit
python scripts/run_qa.py --mode scoped   # before opening a PR
python scripts/run_qa.py --mode full     # before merge
```

CollectIt uses its venv (`.venv/Scripts/python scripts/run_qa.py ...`). Bedrock
and MLBTracker use the interpreter on `PATH`.

| Flag | Effect |
| ---- | ------ |
| `--mode fast\|scoped\|full` | Tier to run (default `fast`). |
| `--dead-code` | Also run vulture and knip. Always on in `full`. |
| `--force-refresh` | Discard the testmon cache before a `fast` run. |
| `--json` | Print one line of machine-readable JSON instead of text. |
| `--no-report` | Do not write anything under `.qa/reports/`. |
| `--root <dir>` | Repository root. The shim sets this for you. |

## What each tier runs

| Step | `fast` | `scoped` | `full` |
| ---- | ------ | -------- | ------ |
| pytest | `--testmon` (only tests affected by the change) | `-m "not integration"`, if a backend path changed | Every test |
| vitest | `vitest related <changed .ts/.tsx>` | Whole suite, if a frontend path changed | Whole suite (plus `vitest_args`) |
| Type check | — | If a frontend path changed | Always |
| Platform audits (`bedrock.tools.run_all`) | — | Always | Always |
| Domain audits (`domain_audits` glob) | — | Always | Always |
| vulture / knip | with `--dead-code` | with `--dead-code` | Always |

"Changed" means the working tree plus everything committed since the branch's
merge-base with `base_branch`. If no merge-base is found, or nothing changed,
`scoped` runs every layer rather than trust an empty diff.

The steps are grouped into four lanes that run at the same time: backend,
frontend, typecheck and audits. Each step runs to completion, so an early
failure never hides a later one. Only the tail of a failing step's output is
printed.

**Exit codes:**
- `0`: every step passed or was skipped.
- `1`: at least one step failed.
- `2`: at least one step could not run, for example a missing executable or a
  configuration error.

## Where the files go

Everything the run writes lives under `.qa/`, which is gitignored. Nothing is
written to the repository root.

| Path | Holds |
| ---- | ----- |
| `.qa/testmon/.testmondata` | pytest-testmon's dependency database. |
| `.qa/testmon/head` | The commit the database was last built on. |
| `.qa/reports/last-<mode>.json` | Full report of the latest run in each mode, failure output included. |
| `.qa/reports/history.jsonl` | One line per run, capped at `history_limit` lines. |
| `.qa/reports/index.html` | The report viewer. |

Leftover `.testmondata*` files in the repo root are moved into `.qa/testmon/`
automatically on the first run.

## The report viewer

Open `.qa/reports/index.html` in a browser. It has no network dependencies and
shows:
- run and per-step duration trends
- pass rate by day
- the slowest steps
- the latest run in each mode
- a history table you can filter and sort

Every run regenerates it. To rebuild it without running anything:

```bash
python -m bedrock.tools.qa_report --root .
```

## The testmon cache

- **First run:** the first `fast` run on a machine builds the database. It
  costs about as much as a full pytest run: about 4 minutes in CollectIt and
  8 minutes in MLBTracker. After that, `fast` takes a few seconds.
- **Committing doesn't reset it.** The cache is kept as long as `HEAD`
  descends from the commit it was built on.
- **Rebasing or switching branches rebuilds it automatically.** The run
  reports this with a note.
- **Forcing a rebuild:** use `--force-refresh` if you suspect the cache is
  wrong.
- **If `pytest-testmon` isn't installed,** `fast` falls back to the whole
  non-integration suite, and the report says so.

## Configuration

Each repo's layout lives in `[tool.bedrock.qa]` in `bedrock.toml`. A missing
key keeps its default. A value of the wrong type fails the run (exit 2) instead
of running the wrong command.

| Key | Default | Purpose |
| --- | ------- | ------- |
| `backend_dir` | `"."` | pytest's working directory. |
| `frontend_dir` | `"frontend"` | Where `package.json` and `node_modules` live. |
| `frontend_src` | `"frontend/src"` | Source root for `vitest related`. |
| `backend_paths` / `frontend_paths` | consumer layout | Globs that mark a layer as touched in `scoped`. |
| `vitest_args` | `[]` | Extra arguments for full vitest runs, such as `--project` shards or worker caps. |
| `typecheck` | `["tsc", "-b", "--noEmit"]` | Type-check command. An empty list disables it. |
| `domain_audits` | `"scripts/audit/s1*_audit_*.py"` | Glob for the repo's own audits. `""` disables them. |
| `vulture_paths` | `[]` | Paths vulture scans. An empty list disables vulture. It has no exclude option, so list source roots, not test trees. |
| `vulture_min_confidence` | `80` | vulture threshold. |
| `knip` | `true` | Run knip in dead-code mode. |
| `base_branch` | `"master"` | Branch that `scoped` diffs against. |
| `history_limit` | `500` | Lines kept in `history.jsonl`. |

The current configurations:
- **bedrock:** `backend_dir = "packages/bedrock-api"`, `frontend_dir = "."`.
- **CollectIt:** caps vitest workers and lists its `api/` source roots for
  vulture.
- **MLBTracker:** shards vitest into three `--project` runs and leaves vulture
  off.

## Adopting it in a consumer

1. Bump both pins to a tag that ships `bedrock.tools.run_qa` (v0.13.0 or
   later). See the `bump-bedrock-pin` skill.
2. Add `pytest-testmon>=2.1,<3` to `requirements.txt`. Add `vulture` too if you
   set `vulture_paths`.
3. Replace `scripts/run_qa.py` with bedrock's shim (`scripts/run_qa.py` in this
   repo).
4. Add `.qa/` to `.gitignore`.
5. Add a `[tool.bedrock.qa]` section for anything that differs from the
   defaults.
6. Run `--mode fast` once to build the cache, then `--mode full` to confirm
   everything passes.

## Relationship to CI and the audit runner

The orchestrator is the local gate. CI is still the merge gate, and it runs
the full path-scoped suite on every PR (S005, S006). Don't run fast QA inside
CI: the runner starts with no testmon cache, so `fast` reruns the whole suite.

`scripts/run_audit.ps1` (template in
`packages/bedrock-api/bedrock/templates/scripts/`) runs only the audits. Its
switches are `-Platform`, `-Domain`, `-All` and `-Standard Sxxx`, and the
audits run concurrently. Use it when you want an audit verdict without running
the test suites.
