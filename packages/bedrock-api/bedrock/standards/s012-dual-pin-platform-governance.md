---
id: S012
title: "Dual-Pin Platform Governance"
status: active
tier: platform
enforced_by: bedrock.tools.s012_audit_pins
cli_command: "python scripts/audit/s012_audit_pins.py --root ."
---

# Standard S012: Dual-Pin Platform Governance

## Purpose & Objective

Bedrock ships as two packages — `bedrock-api` (pinned in `requirements.txt`)
and `@djntechnic/bedrock-ui` (pinned in `package.json`) — installed by git tag
rather than a registry. Both carry the same version number and move together
on one tag. A consumer whose backend and frontend pins point at two different
tags has two halves that disagree about what the platform is, and it fails at
install time or with subtle runtime contract mismatches, not at review time.
This standard makes exact lockstep between the two pins a mechanically
verified invariant in every consumer repository.

## Non-Negotiable Invariants

- `requirements.txt`'s `bedrock-api @ git+https://github.com/djntechnic/bedrock@<tag>#subdirectory=packages/bedrock-api`
  and `package.json`'s `"@djntechnic/bedrock-ui": "github:djntechnic/bedrock#<tag>"`
  reference the **identical** release tag, byte-for-byte, in every consumer
  repository at every commit on `master`.
- A pin bump touches both files in the same commit. A PR that moves one pin
  without the other does not merge.
- Bedrock is always released — tagged, pushed, and verified with
  `git ls-remote` — **before** a consumer bumps its pin to that tag. A
  consumer never pins a tag that does not exist on the remote.
- Consumers never edit bedrock's own version numbers or tags from inside the
  consumer repository — the tag is authored in `bedrock` and consumed,
  read-only, everywhere else.
- After a pin bump, the consumer's lockfile (`package-lock.json`,
  `requirements.txt`'s resolved hash if pinned) is regenerated in the same
  PR — a stale lockfile pointing at the old tag is a silent partial bump.

## Architecture & Code Contracts

**`requirements.txt` — correct:**

```
bedrock-api @ git+https://github.com/djntechnic/bedrock@v0.10.0#subdirectory=packages/bedrock-api
```

**`package.json` — correct, same tag:**

```json
{
  "dependencies": {
    "@djntechnic/bedrock-ui": "github:djntechnic/bedrock#v0.10.0"
  }
}
```

**Violation — tags diverge:**

```
requirements.txt:  ...@v0.10.0#subdirectory=packages/bedrock-api
package.json:      "github:djntechnic/bedrock#v0.9.2"
```

**Python — audit check shape:**

```python
import re

def extract_tag(pattern: str, text: str) -> str | None:
    match = re.search(pattern, text)
    return match.group(1) if match else None

def audit_dual_pin(requirements_txt: str, package_json: str) -> bool:
    api_tag = extract_tag(r"bedrock@([^#]+)#subdirectory", requirements_txt)
    ui_tag = extract_tag(r"bedrock#([^\"]+)\"", package_json)
    return api_tag == ui_tag
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s012]
exempt_paths = []
```

There is no legitimate exemption for pin divergence — `exempt_paths` exists
only for a consumer that vendors bedrock source directly during an
in-progress migration off git-tag installation, declared with a written
end-date in the PR description.

## Verification & Enforcement Gate

```bash
python scripts/audit/s012_audit_pins.py --root .
```

- **Exit 0** — `requirements.txt` and `package.json` reference the identical
  bedrock tag, and that tag exists on the remote (`git ls-remote` check).
- **Exit 1** — the two pins diverge, or the referenced tag does not exist on
  the remote; the audit reports both resolved tags.
- **Exit 2** — configuration error (missing `requirements.txt` or
  `package.json`, malformed `bedrock.toml`).
