---
name: bump-bedrock-pin
description: Move CollectIt's two bedrock pins to a new release tag — verify the tag exists, edit both pins, regenerate the lockfile, prove the install, run the gates, open the PR.
---

# Bump the bedrock pin

Both pins move together or neither moves. A backend on one bedrock version with
a frontend on another fails silently. Background: [`docs/reference/bedrock.md`](../../../docs/reference/bedrock.md).

Usage: `/bump-bedrock-pin v0.3.0`

## 1. The tag must exist on the remote first

```bash
git ls-remote --tags https://github.com/djntechnic/bedrock | grep '<ref>'
```

No output → **stop**. Land order is bedrock first: merge and tag bedrock, then
bump here. If the tag can't be pushed from this environment (HTTP 403 has
happened), hand the user the exact commands, scoped to the bedrock checkout:

```bash
# from the bedrock repo root, NOT CollectIt
git fetch origin
git tag -a <ref> <full-40-char-sha> -m "<ref> - <one line>"
git push origin <ref>
```

Full SHA, not abbreviated, so it resolves in a fresh clone. ASCII hyphen in
`-m`, not an em dash — Windows consoles mangle non-ASCII.

Never pin a branch, a bare commit SHA, or a `file:` path on `master`.

## 2. Edit both pins

`requirements.txt` — the `bedrock-api` line:

```
bedrock-api @ git+https://github.com/djntechnic/bedrock@<ref>#subdirectory=packages/bedrock-api
```

`frontend/package.json` — the `@djntechnic/bedrock-ui` dependency:

```json
"@djntechnic/bedrock-ui": "github:djntechnic/bedrock#<ref>"
```

Update the comment above the `requirements.txt` line to name the release and its
headline contents. Read bedrock's `CHANGELOG.md` for breaking notes.

## 3. Regenerate the lockfile

```bash
cd frontend && npm install --package-lock-only --ignore-scripts
```

The lockfile's `resolved` field will still show a commit SHA. **That is correct**
— npm records what the tag resolved to. It is the evidence the pin points at the
release, not a discrepancy to fix.

## 4. Prove the package actually installed

```bash
rm -rf frontend/node_modules/@djntechnic
cd frontend && npm install --ignore-scripts
cat node_modules/@djntechnic/bedrock-ui/package.json | grep '"version"'
```

Do **not** use `git -C node_modules/... log` — `node_modules` is not a git repo,
so git walks up to CollectIt and reports this repo's HEAD. It looks like a pass
and means nothing. Check the `version` field, and confirm one file unique to the
new release exists.

Backend: `pip install -r requirements.txt` and import a symbol new in this release.

## 5. Gates

`/run-tests full` — both suites, `tsc -b --noEmit`, and all seven audits. A pin
bump touches both layers by definition, so `scoped` is not enough.

`python scripts/maintenance/audit_bedrock_pins.py` is the one that speaks
directly to this task: it fails if the two pins disagree, if either names a
branch or a bare SHA instead of a tag, or if a `file:` override survived in the
lockfile. Run it right after step 3 rather than waiting for the full sweep — it
takes milliseconds and catches the mistake while the edit is still in hand.

## 6. PR

Draft, targeting `master`, template populated. Then `subscribe_pr_activity` and
end the turn — do not sleep-poll for CI.
