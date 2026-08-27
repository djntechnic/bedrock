"""
Module:  audit_ledger_freshness.py
Layer:   bedrock/tools
Desc:    CI gate for a consumer repo's `docs/reference/bedrock_issues_to_file.md`
         ledger — the table each app keeps of platform defects it hit, linked
         to the bedrock issue filed for them.

         The ledger's own header text states the rule an entry has to satisfy:
         it must name either an open bedrock issue, or the tag that fixed it.
         Nobody was executing that rule, so the ledger went stale in exactly
         the way you would expect — entries survived their own fixes by weeks,
         because deleting a row required someone to remember to go back and
         check. This script is that check, run as a gate instead of a memory.

         It lives here, in the platform, rather than being copied into each
         consumer (CollectIt, MLBTracker, ...) because every consumer's ledger
         obeys the same rule and a second copy is exactly the kind of drift
         this whole mechanism exists to prevent. A consumer without a ledger
         yet has nothing stale to report, so a missing file is success, not an
         error — this only fires once a repo has something to keep honest.

Usage:   python -m bedrock.tools.audit_ledger_freshness <path-to-ledger.md>
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

from loguru import logger

_BEDROCK_REPO = "djntechnic/bedrock"

# The header table's issue cell looks like
# "[bedrock#12](https://github.com/djntechnic/bedrock/issues/12)" — the number
# after the `#` is the only part that matters here.
_ISSUE_REF_RE = re.compile(r"bedrock#(\d+)")

# A table row: "| 1 | Something | [bedrock#12](...) |". The separator row
# ("| --- | --- | --- |") matches the same shape, so callers must skip it
# explicitly rather than relying on this pattern to exclude it.
_ROW_RE = re.compile(r"^\|\s*(\S.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$")

# A section header for entry N: "## 3. Some title". The body between one
# section header and the next (or end of file) is what gets searched for the
# "fixed in bedrock vX.Y.Z" phrase.
_SECTION_RE = re.compile(r"^##\s+(\d+)\.\s")

# Case-insensitive: the ledger's own prose capitalises this inconsistently
# ("Fix in bedrock:", "fixed in bedrock v0.5.0").
_FIXED_TAG_RE = re.compile(r"fixed in bedrock v\d+\.\d+\.\d+", re.IGNORECASE)


def _entry_sections(text: str) -> dict[int, str]:
    """Split the ledger body into {entry number: section text} below the table.

    Each section runs from its own `## N. ...` heading to the next heading (of
    any level) or end of file, so a subsection inside an entry does not leak
    into the next entry's body.
    """
    lines = text.splitlines()
    sections: dict[int, list[str]] = {}
    current: int | None = None
    for line in lines:
        match = _SECTION_RE.match(line)
        if match:
            current = int(match.group(1))
            sections[current] = []
            continue
        if current is not None and line.startswith("#"):
            current = None
            continue
        if current is not None:
            sections[current].append(line)
    return {number: "\n".join(body) for number, body in sections.items()}


def audit(path: str, open_issues: set[int]) -> list[str]:
    """Check one ledger against the set of currently-open bedrock issue numbers.

    An entry passes when either:
      - its issue number is still open, so the row correctly points at live
        work; or
      - its section names the tag that fixed it (`fixed in bedrock vX.Y.Z`),
        so the entry is a deliberately-kept historical record rather than a
        stale pointer.

    An entry with no `bedrock#N` reference at all — including the literal
    `to file` placeholder the ledger uses before an issue exists — fails as
    "unfiled": it is a defect nobody has filed anywhere, which is worse than a
    closed one, since there is no way to check whether it was ever fixed.

    A path that does not exist is not a failure: a consumer with no ledger has
    nothing stale to report.
    """
    ledger_path = Path(path)
    if not ledger_path.exists():
        return []

    text = ledger_path.read_text(encoding="utf-8")
    sections = _entry_sections(text)

    failures: list[str] = []
    for line in text.splitlines():
        row = _ROW_RE.match(line)
        if not row:
            continue
        first_cell, _entry_cell, issue_cell = row.groups()
        if not first_cell.isdigit():
            # Skips the header row ("# | Entry | Issue") and the separator
            # row ("--- | --- | ---"), neither of which is a real entry.
            continue
        entry_number = int(first_cell)

        issue_match = _ISSUE_REF_RE.search(issue_cell)
        if issue_match is None:
            failures.append(
                f"entry {entry_number}: unfiled - no bedrock issue reference "
                f"(issue cell was {issue_cell!r})"
            )
            continue

        issue_number = int(issue_match.group(1))
        if issue_number in open_issues:
            continue

        section_body = sections.get(entry_number, "")
        if _FIXED_TAG_RE.search(section_body):
            continue

        failures.append(
            f"entry {entry_number}: bedrock#{issue_number} is closed and no "
            f"'fixed in bedrock vX.Y.Z' note is recorded - delete the entry "
            f"or add the tag that fixed it"
        )

    return failures


def _fetch_open_issue_numbers() -> set[int]:
    """Ask `gh` for the bedrock repo's open issue numbers.

    Falls back to an empty set — rather than raising — when `gh` is absent or
    the call fails (no auth, no network, rate limit). That degrades the gate
    to "unfiled entries only" instead of failing CI on a missing CLI, which is
    the right trade: a false negative here is a stale ledger row that lingers
    one more run, not a broken build.
    """
    try:
        result = subprocess.run(
            ["gh", "issue", "list", "--repo", _BEDROCK_REPO, "--state", "open",
             "--json", "number"],
            capture_output=True,
            text=True,
            check=True,
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        logger.warning(
            "could not fetch open bedrock issues via gh ({}); falling back "
            "to an empty open-issue set", exc,
        )
        return set()

    try:
        payload = json.loads(result.stdout)
        return {int(item["number"]) for item in payload}
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
        logger.warning(
            "could not parse gh issue list output ({}); falling back to an "
            "empty open-issue set", exc,
        )
        return set()


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1:
        logger.error("usage: audit_ledger_freshness <path-to-ledger.md>")
        return 1

    path = args[0]
    open_issues = _fetch_open_issue_numbers()
    failures = audit(path, open_issues)

    for failure in failures:
        logger.error(failure)

    return 1 if failures else 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
