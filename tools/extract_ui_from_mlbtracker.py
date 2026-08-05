"""
Build packages/bedrock-ui/src from a MLBTracker checkout.

The frontend counterpart of extract_from_mlbtracker.py. The file set is the
import closure computed by closure_ts.py, not a list, for the same reason: a
platform component that grows a baseball import pulls the baseball module into
the closure and fails the run rather than shipping it.

    python tools/extract_ui_from_mlbtracker.py --mlbtracker ../MLBTracker

Two things are rewritten on the way in:

  - `@/x` alias imports become package-relative. Keeping the alias would force
    every consuming app to point `@/` at the package, but a consumer's `@/`
    has to keep pointing at its own src. Relative imports make the package
    self-contained.
  - `@/components/domain/*` has no counterpart here — those are MLBTracker's
    registrations. The closure should never reach them; if it does, that is a
    boundary regression and the run fails.

The package ships TypeScript source rather than build output, so a consumer
compiles it with their own tsconfig and Tailwind. See the README.

Once MLBTracker consumes the package this script's job is done.
"""
from __future__ import annotations

import argparse
import pathlib
import re
import shutil
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from closure_ts import SEEDS, resolve  # noqa: E402

IMPORT_RE = re.compile(r"""(['"])(@/[^'"]+)\1""")

#: Files that are MLBTracker's, never the package's. Reaching one is a failure.
FORBIDDEN = ("components/domain/", "api/rankingsApi", "hooks/useAdminDomain",
             "hooks/useSearch", "components/TeamLogo", "components/PlayerHeadshot")


def compute_closure(src: pathlib.Path) -> set[str]:
    import collections
    seen: set[str] = set()
    queue = collections.deque(f for files in SEEDS.values() for f in files)
    while queue:
        rel = queue.popleft()
        if rel in seen:
            continue
        seen.add(rel)
        text = (src / rel).read_text(encoding="utf-8")
        for m in re.finditer(
            r"""(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*['"]([^'"]+)['"]"""
            r"""|(?:^|\n)\s*import\s*['"]([^'"]+)['"]""",
            text, re.S,
        ):
            spec = m.group(1) or m.group(2)
            target = resolve(spec, src / rel, src)
            if target:
                queue.append(target)
    return seen


def to_relative(spec: str, importer_rel: str) -> str:
    """Rewrite an `@/foo/bar` specifier to a path relative to the importer."""
    target = pathlib.PurePosixPath(spec[2:])
    here = pathlib.PurePosixPath(importer_rel).parent
    up = []
    t_parts, h_parts = list(target.parts), list(here.parts)
    common = 0
    while common < min(len(t_parts), len(h_parts)) and t_parts[common] == h_parts[common]:
        common += 1
    up = [".."] * (len(h_parts) - common)
    rest = t_parts[common:]
    out = "/".join(up + rest)
    return out if out.startswith(".") else "./" + out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mlbtracker", required=True, type=pathlib.Path)
    ap.add_argument("--out", type=pathlib.Path,
                    default=pathlib.Path(__file__).resolve().parents[1]
                    / "packages" / "bedrock-ui")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    src = (args.mlbtracker / "frontend" / "src").resolve()
    files = compute_closure(src)

    leaks = sorted(f for f in files if any(f.startswith(p) or p in f
                                           for p in FORBIDDEN))
    if leaks:
        print("FAIL: platform closure reaches MLBTracker code:", file=sys.stderr)
        for f in leaks:
            print("  " + f, file=sys.stderr)
        return 1

    print(f"frontend closure: {len(files)} files, no domain leaks")
    if args.check:
        for f in sorted(files):
            print("  " + f)
        return 0

    dst_root = args.out / "src"
    if dst_root.exists():
        shutil.rmtree(dst_root)

    for rel in sorted(files):
        text = (src / rel).read_text(encoding="utf-8")
        text = IMPORT_RE.sub(
            lambda m: f"{m.group(1)}{to_relative(m.group(2), rel)}{m.group(1)}",
            text,
        )
        dst = dst_root / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(text, encoding="utf-8")

    # The §S9 token contract. Components resolve every color through these
    # variables, so the package is unusable without them; an app overrides the
    # values and keeps the names.
    tokens_src = src / "index.css"
    tokens_dst = dst_root / "styles" / "tokens.css"
    tokens_dst.parent.mkdir(parents=True, exist_ok=True)
    tokens_dst.write_text(
        tokens_src.read_text(encoding="utf-8")
        .replace("Default theme: MLB Classic", "Default theme: Light")
        .replace("MLB Classic", "the light theme")
        .replace("Night Game", "the dark theme"),
        encoding="utf-8",
    )

    print(f"wrote {len(files)} modules + tokens.css to {dst_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
