"""
Module:  remediate_taxonomy_and_casing.py
Layer:   bedrock/tools
Desc:    Automated remediator paired with `audit_taxonomy_and_casing`. Plans
         and (optionally) executes lowercase kebab-case renames for files
         under `docs/` and `templates/`, and rewrites inbound markdown links
         that pointed at the old path.

         NTFS is case-insensitive: a direct `git mv S01_Standard.md
         s01-standard.md` collision-locks because the source and destination
         resolve to the same on-disk entry. Every rename here stages through
         a `__tmp` intermediate:

             git mv <src> <src>__tmp
             git mv <src>__tmp <dst>

         `--dry-run` (default posture) reports the plan and the inbound link
         substitutions without touching disk or git state. `--write` executes
         both. Exit 0 on a completed run (dry or written), 2 on a
         configuration error.

Usage:   python -m bedrock.tools.remediate_taxonomy_and_casing --root . --dry-run
         python -m bedrock.tools.remediate_taxonomy_and_casing --root . --write
"""
from __future__ import annotations

import argparse
import fnmatch
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from bedrock.tools._config import load_bedrock_config
from bedrock.tools._reporter import AuditReporter
from bedrock.tools.audit_taxonomy_and_casing import CASING_EXEMPT_NAMES, KEBAB_CASE_RE

_TMP_SUFFIX = "__tmp"
_MARKDOWN_LINK_RE = re.compile(r"(\[[^\]]*\]\()([^)]+)(\))")


@dataclass
class RenamePlan:
    source: Path
    target: Path
    rel_source: str
    rel_target: str


def _is_exempt(rel_path: str, exemptions: list[str]) -> bool:
    return any(fnmatch.fnmatch(rel_path, pattern) for pattern in exemptions)


def _kebab_case_target_name(name: str) -> str:
    base, _, ext = name.rpartition(".")
    if not base:
        base, ext = name, ""
    base = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "-", base)
    base = re.sub(r"[\s_]+", "-", base)
    base = base.lower()
    base = re.sub(r"-{2,}", "-", base).strip("-")
    ext = ext.lower()
    return f"{base}.{ext}" if ext else base


def build_rename_plan(root: Path, exemptions: list[str]) -> list[RenamePlan]:
    plans: list[RenamePlan] = []
    for base_dir in ("docs", "templates"):
        base = root / base_dir
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*")):
            if path.is_dir():
                continue
            rel = path.relative_to(root).as_posix()
            if _is_exempt(rel, exemptions):
                continue
            if path.name in CASING_EXEMPT_NAMES:
                continue
            if KEBAB_CASE_RE.match(path.name):
                continue
            target_name = _kebab_case_target_name(path.name)
            if target_name == path.name:
                continue
            target = path.with_name(target_name)
            plans.append(
                RenamePlan(
                    source=path,
                    target=target,
                    rel_source=rel,
                    rel_target=target.relative_to(root).as_posix(),
                )
            )
    return plans


def _git_mv(root: Path, src: Path, dst: Path) -> None:
    subprocess.run(
        ["git", "mv", str(src), str(dst)],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )


def execute_two_stage_rename(root: Path, plan: RenamePlan) -> list[str]:
    """Executes the mandatory two-stage NTFS rename and returns the git mv
    command sequence issued, for reporting and test assertion."""
    tmp = plan.source.with_name(plan.source.name + _TMP_SUFFIX)
    _git_mv(root, plan.source, tmp)
    _git_mv(root, tmp, plan.target)
    return [
        f"git mv {plan.rel_source} {plan.rel_source}{_TMP_SUFFIX}",
        f"git mv {plan.rel_source}{_TMP_SUFFIX} {plan.rel_target}",
    ]


def _rewrite_link_target(link_target: str, plan: RenamePlan) -> str | None:
    old_name = plan.rel_source.rsplit("/", 1)[-1]
    new_name = plan.rel_target.rsplit("/", 1)[-1]

    if link_target == plan.rel_source:
        return plan.rel_target
    if link_target.endswith("/" + old_name):
        return link_target[: -len(old_name)] + new_name
    if link_target == old_name:
        return new_name
    return None


def rewrite_inbound_links(root: Path, renames: list[RenamePlan], dry_run: bool = True) -> dict[str, int]:
    """Scans every markdown file under `root` for `[text](path)` links whose
    target matches one of `renames`' old paths and rewrites them to the new
    canonical path. Returns a map of relative file path -> substitution count.
    Under `dry_run=True` no file is written."""
    if not renames:
        return {}

    results: dict[str, int] = {}
    for md_path in sorted(root.rglob("*.md")):
        if any(part in {"node_modules", "__pycache__", ".git"} for part in md_path.parts):
            continue

        text = md_path.read_text(encoding="utf-8", errors="replace")
        count = 0

        def _sub(match: re.Match) -> str:
            nonlocal count
            prefix, target, suffix = match.group(1), match.group(2), match.group(3)
            for plan in renames:
                new_target = _rewrite_link_target(target, plan)
                if new_target is not None:
                    count += 1
                    return f"{prefix}{new_target}{suffix}"
            return match.group(0)

        new_text = _MARKDOWN_LINK_RE.sub(_sub, text)
        if count:
            rel = md_path.relative_to(root).as_posix()
            results[rel] = count
            if not dry_run:
                md_path.write_text(new_text, encoding="utf-8")

    return results


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".", help="repository/source root to scan")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="report the plan without modifying disk/git state")
    mode.add_argument("--write", action="store_true", help="execute the two-stage renames and rewrite inbound links")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    reporter = AuditReporter("TAXONOMY-REMEDIATE", "Taxonomy & Casing Remediation", root, root / "bedrock.toml")

    reporter.start_check("Loading bedrock.toml configuration")
    try:
        config = load_bedrock_config(root)
    except (FileNotFoundError, ValueError) as exc:
        reporter.error(str(exc))
        print(reporter.render())
        return reporter.finish()
    reporter.pass_check()

    plan = build_rename_plan(root, config.audit_s008.exemptions)
    reporter.start_check(f"Planning {len(plan)} two-stage rename(s)")
    if plan:
        reporter.pass_check("; ".join(f"{p.rel_source} -> {p.rel_target}" for p in plan))
    else:
        reporter.pass_check("no renames required")

    link_updates = rewrite_inbound_links(root, plan, dry_run=not args.write)
    reporter.start_check("Scanning inbound markdown links")
    if link_updates:
        reporter.pass_check("; ".join(f"{f} ({n})" for f, n in link_updates.items()))
    else:
        reporter.pass_check("no inbound links required updates")

    if args.write:
        reporter.start_check("Executing two-stage git renames")
        for p in plan:
            execute_two_stage_rename(root, p)
        reporter.pass_check(f"{len(plan)} rename(s) applied")

    print(reporter.render())
    return reporter.finish()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
