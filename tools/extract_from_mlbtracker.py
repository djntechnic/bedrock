"""
Rebuild packages/bedrock-api/bedrock/ from a MLBTracker checkout.

Bedrock was extracted from MLBTracker, and until MLBTracker migrates onto the
package (plan Phase 3) MLBTracker's `api/` remains the source of truth. This
script makes the copy reproducible rather than a one-off hand pass: point it at
a MLBTracker checkout and it re-derives the platform file set, remaps paths and
rewrites imports.

    python tools/extract_from_mlbtracker.py --mlbtracker ../MLBTracker

The file set is *computed*, not listed: it is the transitive import closure of
the platform entry points. That matters because it cannot silently drift — if a
platform module grows an import of a baseball module, the closure pulls the
baseball module in and the script fails loudly rather than shipping it.

Once Phase 3 lands and MLBTracker consumes the package, this script's job is
done and it should be deleted.
"""
from __future__ import annotations

import argparse
import ast
import collections
import pathlib
import re
import shutil
import sys

#: Platform entry points. Everything reachable from these is platform code.
SEEDS = [
    "api/routes/auth.py",
    "api/routes/modules.py",
    "api/routes/config.py",
    "api/routes/health.py",
    "api/routes/user_preferences.py",
    "api/routes/admin_platform.py",
    "api/routes/diagnostics.py",
    "api/dependencies.py",
    "api/core/migrations.py",
    "api/core/diagnostic_checks.py",
    "api/jobs/importers/base.py",
    "api/core/logging.py",
    "api/core/db_health.py",
    "api/core/schema_drift.py",
]

#: MLBTracker path prefix → package path prefix. Longest match wins.
PATH_MAP = {
    "api/jobs/importers/": "bedrock/importers/",
    "api/core/": "bedrock/core/",
    "api/routes/": "bedrock/routes/",
    "api/schemas/": "bedrock/schemas/",
    "api/services/": "bedrock/services/",
    "api/dependencies.py": "bedrock/dependencies.py",
}

#: Module-path rewrites, applied in order. `api.domain.*` is the app-supplied
#: half of every extension point; in a bedrock app that namespace is
#: `bedrock_app.*`, which is what the platform's loader constants point at.
IMPORT_REWRITES = [
    (r"\bapi\.jobs\.importers\b", "bedrock.importers"),
    (r"\bapi\.domain\b", "bedrock_app"),
    (r"\bapi\.(core|routes|schemas|services|dependencies)\b", r"bedrock.\1"),
]

PACKAGE_DIRS = ["bedrock", "bedrock/core", "bedrock/routes", "bedrock/schemas",
                "bedrock/services", "bedrock/importers"]

#: Package-owned files that must survive a rebuild. The schema catalog is the
#: important one: MLBTracker's lists every baseball table, and the package's is
#: regenerated against the platform baseline only. Copying MLBTracker's over it
#: would reintroduce ~40 tables the package has no schema for.
PRESERVE = ["bedrock/core/schema_catalog.py"]


def _module_to_path(root: pathlib.Path, mod: str) -> str | None:
    p = root / (mod.replace(".", "/") + ".py")
    if p.exists():
        return str(p.relative_to(root))
    p = root / mod.replace(".", "/") / "__init__.py"
    if p.exists():
        return str(p.relative_to(root))
    return None


def compute_closure(root: pathlib.Path) -> tuple[set[str], set[str]]:
    """:returns: (platform files, third-party top-level module names)."""
    seen: set[str] = set()
    external: set[str] = set()
    queue = collections.deque(SEEDS)
    while queue:
        rel = queue.popleft()
        if rel in seen:
            continue
        seen.add(rel)
        f = root / rel
        if not f.exists():
            raise SystemExit(f"seed/import missing from checkout: {rel}")
        tree = ast.parse(f.read_text(encoding="utf-8"))
        mods: list[str] = []
        for n in ast.walk(tree):
            if isinstance(n, ast.Import):
                mods += [a.name for a in n.names]
            elif isinstance(n, ast.ImportFrom) and n.module:
                mods.append(n.module)
                # `from api.services import user_service` — the submodule is an
                # alias, not part of n.module, so try each as a module too.
                mods += [f"{n.module}.{a.name}" for a in n.names]
        for m in mods:
            if not m.startswith("api"):
                external.add(m.split(".")[0])
                continue
            p = _module_to_path(root, m)
            if p:
                queue.append(p)
            else:
                external.add(m)
    return seen, external


def target_path(rel: str) -> str:
    for src, dst in sorted(PATH_MAP.items(), key=lambda kv: -len(kv[0])):
        if rel == src:
            return dst
        if rel.startswith(src):
            return dst + rel[len(src):]
    raise SystemExit(f"no path mapping for {rel}")


def rewrite(text: str) -> str:
    for pattern, repl in IMPORT_REWRITES:
        text = re.sub(pattern, repl, text)
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mlbtracker", required=True, type=pathlib.Path)
    ap.add_argument("--out", type=pathlib.Path,
                    default=pathlib.Path(__file__).resolve().parents[1]
                    / "packages" / "bedrock-api")
    ap.add_argument("--check", action="store_true",
                    help="report the file set and exit without writing")
    args = ap.parse_args()

    root = args.mlbtracker.resolve()
    files, external = compute_closure(root)

    leaks = sorted(f for f in files if "/domain/" in f or "_domain" in f)
    if leaks:
        print("FAIL: platform closure reaches domain code:", file=sys.stderr)
        for f in leaks:
            print("  " + f, file=sys.stderr)
        return 1

    print(f"platform closure: {len(files)} files, no domain leaks")
    if args.check:
        for f in sorted(files):
            print(f"  {f}  ->  {target_path(f)}")
        # `from api.x import y` records `api.x.y` as a candidate module; the
        # ones that did not resolve are symbols, not dependencies.
        print("third-party:", " ".join(
            sorted(m for m in external if not m.startswith("api"))))
        return 0

    pkg = args.out / "bedrock"
    kept = {p: (args.out / p).read_text(encoding="utf-8")
            for p in PRESERVE if (args.out / p).exists()}
    inits = {str(p.relative_to(args.out)): p.read_text(encoding="utf-8")
             for p in pkg.rglob("__init__.py")} if pkg.exists() else {}

    if pkg.exists():
        shutil.rmtree(pkg)
    for d in PACKAGE_DIRS:
        (args.out / d).mkdir(parents=True, exist_ok=True)

    written = 0
    for rel in sorted(files):
        out_rel = target_path(rel)
        if out_rel in kept:
            continue
        dst = args.out / out_rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(rewrite((root / rel).read_text(encoding="utf-8")),
                       encoding="utf-8")
        written += 1

    for rel, text in {**inits, **kept}.items():
        (args.out / rel).parent.mkdir(parents=True, exist_ok=True)
        (args.out / rel).write_text(text, encoding="utf-8")

    print(f"wrote {written} modules to {pkg}; "
          f"preserved {len(kept)} package-owned + {len(inits)} __init__")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
