---
name: cut-release
description: Cut a new bedrock release — move both package versions together, write the CHANGELOG entry, tag the merge commit, and push the tag so MLBTracker and CollectIt can bump their pins. Use when releasing bedrock or when a consumer repo is blocked waiting on a tag.
---

# Cut a bedrock release

Bedrock ships as two packages installed from this repo by git tag. Consumers
(`MLBTracker`, `CollectIt`) pin both to the *same* tag. This skill is the
upstream half of that workflow; the consumer half is their `bump-bedrock-pin`.

**Land order is always bedrock first.** Merge and tag here, then bump the
consumer. A consumer PR that pins a tag which does not yet exist on the remote
fails at install time, not at review time.

Usage: `/cut-release v0.6.0`

## 1. Both versions move together

One tag, two packages, one version number. They must agree — a consumer
installs `bedrock-api` and `@djntechnic/bedrock-ui` from the same ref, so a
mismatch means the backend and frontend disagree about what they are.

| File | Field |
|---|---|
| `package.json` | `"version"` (this is `@djntechnic/bedrock-ui`) |
| `packages/bedrock-api/pyproject.toml` | `version = ` |

Semver against the *consumer-visible* surface: a changed export, prop, hook
signature, extension-point contract, or API route shape is breaking. Internal
refactors behind a stable export are not.

## 2. CHANGELOG entry

`CHANGELOG.md`, newest section on top, `## vX.Y.Z`. Follow the voice already
there: group by what the change does for a consumer, and for each defect say
what was wrong, why the suite did not catch it, and what now prevents it.
Sections like `### Fixed — four defects that no test could see` are the house
style; a bare bullet list of commit subjects is not.

Anything breaking gets called out explicitly — a consumer reads this entry to
decide whether the pin bump is mechanical or needs work.

## 3. Gates before the tag

CI (`.github/workflows/ci.yml`) runs both halves; run them locally first:

```bash
# frontend — from the repo root
npm install --no-audit --no-fund
npm test
npm run typecheck

# backend
cd packages/bedrock-api && pip install -e ".[dev]" && pytest
```

Do **not** add `--legacy-peer-deps` to the install. The package ships source and
declares only peers; that flag makes npm skip the peer install entirely, and
both the type check and the tests then pass against modules that are not there.

## 4. Merge, then tag the merge commit

The tag must point at a commit on `master`, after the release PR merges — never
at a branch head, and never at a commit that only exists locally.

```bash
git checkout master
git pull origin master
git log -1 --format=%H          # the full 40-char SHA
git tag -a v0.6.0 <full-40-char-sha> -m "v0.6.0 - <one line>"
git push origin v0.6.0
```

Full SHA, not abbreviated, so it resolves in a fresh clone. ASCII hyphen in
`-m`, not an em dash — Windows consoles mangle non-ASCII.

**If `git push origin <tag>` returns HTTP 403** (this has happened), the tag was
not created. Do not proceed and do not tell the consumer repo it is ready.
Hand the user the two commands above verbatim, scoped to this checkout, and
wait. Everything downstream depends on the tag being on the remote.

## 5. Prove the tag is visible to consumers

The consumer's `bump-bedrock-pin` starts by checking exactly this, so check it
here first rather than discovering the gap from the other repo:

```bash
git ls-remote --tags https://github.com/djntechnic/bedrock | grep 'v0.6.0'
```

No output → the release is not done, whatever the local tag list says.

## 6. Hand off

Tell the user which consumers need the bump and what changed for them. Each
consumer then runs its own `/bump-bedrock-pin v0.6.0` — that skill moves both
pins, regenerates the lockfile, proves the install, and runs its gates. Do not
edit consumer pins from inside this repo.
