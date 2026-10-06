"""Render the QA run history as a self-contained HTML page.

Reads what `bedrock.tools.run_qa` writes under `.qa/reports/` -
`history.jsonl` (one compact line per run) and `last-<mode>.json` (the full
report of the newest run in each mode, failure output included) - and writes
`.qa/reports/index.html`: run and per-step duration trends, pass rate by day,
the slowest steps, the latest run per mode, and a filterable, sortable history
table. The page carries its data inline and loads nothing from the network, so
it opens straight from disk.

`run_qa` regenerates the page after every run; this CLI rebuilds it on demand:

    python -m bedrock.tools.qa_report --root .
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from loguru import logger

INDEX_NAME = "index.html"
HISTORY_NAME = "history.jsonl"
# Shipped as package data (pyproject: templates/qa/*.html).
TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "templates" / "qa" / "report.html"
_PLACEHOLDER = re.compile(r"__(REPO_NAME|QA_DATA)__")


def read_history(reports_dir: Path) -> list[dict[str, object]]:
    """Every well-formed line of `history.jsonl`, oldest first. A line that
    does not parse (a run killed mid-write) is skipped, not fatal."""
    path = reports_dir / HISTORY_NAME
    if not path.exists():
        return []
    runs: list[dict[str, object]] = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            logger.warning("qa_report: skipping unreadable history line {number}", number=number)
            continue
        if isinstance(entry, dict):
            runs.append(entry)
    return runs


def read_latest(reports_dir: Path) -> dict[str, dict[str, object]]:
    """The full `last-<mode>.json` report for each mode that has one."""
    latest: dict[str, dict[str, object]] = {}
    for path in sorted(reports_dir.glob("last-*.json")):
        try:
            report = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            logger.warning("qa_report: skipping unreadable report {name}", name=path.name)
            continue
        if isinstance(report, dict):
            latest[path.stem.removeprefix("last-")] = report
    return latest


def embed_json(data: object) -> str:
    """JSON safe to place inside `<script type="application/json">`. Every
    `<` is written as its `\\u003c` escape - the same JSON string once parsed -
    so a `</script>` or `<!--` in captured test output cannot end the element."""
    return json.dumps(data, separators=(",", ":")).replace("<", "\\u003c")


def render_html(
    history: list[dict[str, object]],
    latest: dict[str, dict[str, object]],
    *,
    repo_name: str,
    generated: datetime | None = None,
) -> str:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")
    stamp = (generated or datetime.now(timezone.utc)).isoformat(timespec="seconds")
    values = {
        "REPO_NAME": html.escape(repo_name),
        "QA_DATA": embed_json({"generated": stamp, "history": history, "latest": latest}),
    }
    # One pass, so a placeholder spelled inside the data is never re-expanded.
    return _PLACEHOLDER.sub(lambda m: values[m.group(1)], template)


def write_html(reports_dir: Path, *, repo_name: str) -> Path:
    reports_dir.mkdir(parents=True, exist_ok=True)
    out = reports_dir / INDEX_NAME
    out.write_text(
        render_html(read_history(reports_dir), read_latest(reports_dir), repo_name=repo_name),
        encoding="utf-8",
    )
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", default=".", help="repository root (the directory holding .qa/)")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    out = write_html(root / ".qa" / "reports", repo_name=root.name)
    print(f"QA report: {out}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
