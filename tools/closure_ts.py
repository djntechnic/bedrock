"""
Transitive import closure of the frontend platform, from its entry points.

Same idea as the backend closure in extract_from_mlbtracker.py, but for
TypeScript: start at the components and hooks the platform is supposed to
export, follow every relative and `@/`-aliased import, and report what comes
along. Anything baseball-flavoured in the result is a leak that has to be
broken before bedrock-ui can be extracted.

Run against a MLBTracker checkout:

    python tools/closure_ts.py --frontend ../MLBTracker/frontend/src
"""
from __future__ import annotations

import argparse
import collections
import pathlib
import re

#: What bedrock-ui is meant to export. Grouped to make the report readable.
SEEDS = {
    "grid engine": [
        "components/grids/DataGrid.tsx",
        "components/grids/GridHeader.tsx",
        "components/grids/EditableCell.tsx",
        "components/grids/cellRenderers.tsx",
        "components/grids/cellRegistry.ts",
        "components/grids/rowAccentRegistry.ts",
        "components/grids/PresentationalTableChrome.tsx",
        "components/GridWrapper.tsx",
        "components/SortableTableHead.tsx",
        "components/EmptyTableRow.tsx",
        "components/GridStatus.tsx",
        "components/ColumnToggle.tsx",
    ],
    "grid editor": [
        "components/admin/gridEditor/GridEditor.tsx",
        "components/admin/gridEditor/GridPreview.tsx",
        "components/admin/gridEditor/GridFocusMode.tsx",
    ],
    "shell": [
        "components/AppSidebar.tsx",
        "components/CommandPalette.tsx",
        "components/GlobalSearchBar.tsx",
        "components/KeyboardShortcutsSheet.tsx",
        "components/PageHeader.tsx",
        "components/PageToolbar.tsx",
        "components/PageSkeleton.tsx",
        "components/Breadcrumb.tsx",
        "components/EmptyState.tsx",
        "components/AppFooter.tsx",
    ],
    "auth": [
        "components/ProtectedRoute.tsx",
        "components/ModuleDisabled.tsx",
        "context/AuthContext.ts",
    ],
    "hooks": [
        "hooks/useGridConfig.ts",
        "hooks/useAdminPlatform.ts",
        "hooks/useUserGridConfig.ts",
    ],
}

IMPORT_RE = re.compile(
    # `[^;]*?` rather than `[^;\n]*?`: a multi-line `import { … } from "x"` is
    # the common shape for a component with several named imports, and
    # excluding newlines here silently skips every one of them.
    r"""(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*['"]([^'"]+)['"]"""
    r"""|(?:^|\n)\s*import\s*['"]([^'"]+)['"]"""
    r"""|\bimport\(\s*['"]([^'"]+)['"]\s*\)""",
    re.S,
)

EXTS = [".ts", ".tsx", ".d.ts"]

#: Substrings that mark a module as baseball rather than platform. Used only to
#: flag likely leaks in the report — the human decides.
DOMAIN_HINTS = ("player", "team", "mlb", "season", "stat", "leader", "rank",
                "prospect", "batting", "pitching", "card", "collection",
                "inventory", "catalog", "checklist", "trend", "sync")


def resolve(spec: str, importer: pathlib.Path, src: pathlib.Path):
    """:returns: repo-relative path, or None for a third-party package."""
    if spec.startswith("@/"):
        base = src / spec[2:]
    elif spec.startswith("."):
        base = (importer.parent / spec).resolve()
    else:
        return None
    for cand in [base] + [base.with_suffix(e) for e in EXTS] + \
                [base / ("index" + e) for e in EXTS]:
        if cand.is_file():
            return str(cand.relative_to(src))
    # A directory import with no index, or a path that does not exist.
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--frontend", required=True, type=pathlib.Path,
                    help="path to frontend/src")
    args = ap.parse_args()
    src = args.frontend.resolve()

    origin: dict[str, str] = {}
    seen: set[str] = set()
    external: set[str] = set()
    edges: dict[str, set[str]] = collections.defaultdict(set)
    queue: collections.deque = collections.deque()
    for group, files in SEEDS.items():
        for f in files:
            if not (src / f).exists():
                raise SystemExit(f"seed missing: {f}")
            queue.append((f, group))

    while queue:
        rel, group = queue.popleft()
        if rel in seen:
            continue
        seen.add(rel)
        origin.setdefault(rel, group)
        text = (src / rel).read_text(encoding="utf-8")
        for m in IMPORT_RE.finditer(text):
            spec = m.group(1) or m.group(2) or m.group(3)
            if not spec:
                continue
            target = resolve(spec, src / rel, src)
            if target is None:
                if not spec.startswith((".", "@/")):
                    external.add(spec.split("/")[0] if not spec.startswith("@")
                                 else "/".join(spec.split("/")[:2]))
                continue
            edges[target].add(rel)
            queue.append((target, group))

    print(f"── frontend platform closure: {len(seen)} files ──")
    for f in sorted(seen):
        flag = "  <-- DOMAIN?" if any(h in f.lower() for h in DOMAIN_HINTS) else ""
        print(f"  {f}{flag}")

    suspects = sorted(f for f in seen
                      if any(h in f.lower() for h in DOMAIN_HINTS))
    print(f"\n── {len(suspects)} possible domain leaks, with importers ──")
    for f in suspects:
        print(f"  {f}")
        for imp in sorted(edges[f]):
            print(f"      <- {imp}")

    print("\n── third-party ──")
    print("  " + " ".join(sorted(external)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
