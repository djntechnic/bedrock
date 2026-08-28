"""
Module:  audit_s1_duplicates.py
Layer:   bedrock/tools
Desc:    Gate for the boundary between a consumer app and the installed
         `@djntechnic/bedrock-ui` package: nothing under the app's source tree
         re-implements something the platform already exports.

         The failure this catches is not a bad component. It is a *good* one
         with the same name as a platform export, written because nobody
         checked. The first copy costs nothing; the cost is that six months
         later a fix lands in one of them and the other keeps the bug, and
         neither file says the other exists.

         Three rules, all blocking:

           1. **No name collisions.** A symbol exported from a file under one
              of the collision roots (e.g. `frontend/src/components/`,
              `frontend/src/pages/`) must not share its name with a
              bedrock-ui export. A deliberate local fork is permitted, so a
              file carrying a `@shadows <Name>` marker in its header comment
              is exempt for exactly that name — the marker is the review
              comment made machine-readable, so "fork with a reason" and
              "accident" stop looking alike.

           2. **One query-key factory and one route map.** Exactly one file
              in the app's source tree may declare `export const queryKeys`
              and exactly one `export const API_ROUTES`. A second is the same
              defect wearing a different hat.

           3. **One HTTP client.** Nothing under the app's source tree imports
              `axios` directly; the platform's `apiClient` carries the base
              URL, the auth header and the refresh interceptor, and a bare
              axios call silently skips all three.

         Rule 1 reads the *installed* package rather than a hardcoded list, so
         the audit tightens automatically the next time a consumer bumps its
         bedrock-ui pin and the platform has grown a component. That also
         means it needs `npm install` to have run — a missing or unresolvable
         package is an environment error (exit 2), never a pass.

         This lives in the platform, not copied into each consumer
         (CollectIt, MLBTracker, ...), because every consumer's app/platform
         boundary is the same shape and a second copy is exactly the kind of
         drift this whole mechanism exists to prevent.

         Exit 0 clean, 1 on a violation, 2 on an environment error.

Usage:   python -m bedrock.tools.audit_s1_duplicates
         python -m bedrock.tools.audit_s1_duplicates --repo-root .
         python -m bedrock.tools.audit_s1_duplicates \\
             --repo-root . --source-root frontend/src \\
             --collision-root frontend/src/components \\
             --collision-root frontend/src/pages \\
             --package @djntechnic/bedrock-ui
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re

from loguru import logger

#: Tests compose the very names they exercise, and a fixture called `Button`
#: shadows nothing that ships.
TEST_SUFFIXES = (".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx")

#: Names too generic to be evidence of anything. `default` is the keyword, not
#: a symbol; the rest are React and module conventions that collide by nature.
IGNORED_NAMES = frozenset({"default", "props", "Props"})

_EXPORT_STAR = re.compile(r'^\s*export\s+\*\s+from\s+["\'](\.[^"\']+)["\']', re.M)
_EXPORT_NAMED_FROM = re.compile(
    r'^\s*export\s+\{([^}]*)\}\s+from\s+["\'](\.[^"\']+)["\']', re.M | re.S
)
_EXPORT_BLOCK = re.compile(r"^\s*export\s+\{([^}]*)\}", re.M | re.S)
_EXPORT_DECL = re.compile(
    r"^\s*export\s+(?:declare\s+)?"
    r"(?:const|let|var|function|class|interface|type|enum)\s+"
    r"([A-Za-z_$][\w$]*)",
    re.M,
)
_EXPORT_DEFAULT_FN = re.compile(
    r"^\s*export\s+default\s+(?:function|class)\s+([A-Za-z_$][\w$]*)", re.M
)
_SHADOWS = re.compile(r"@shadows\s+([A-Za-z_$][\w$]*)")
#: The axios *instance*, not the package's types. `AxiosError` is how a caller
#: narrows a rejection from `apiClient` itself, so importing it is the
#: opposite of bypassing the client — only a default or namespace binding is a
#: second HTTP client.
_AXIOS_IMPORT = re.compile(
    r'^\s*import\s+(?!type\b)(?:axios\b|\*\s+as\s+\w+)[^;]*?from\s+["\']axios["\']',
    re.M,
)


class PackageResolutionError(Exception):
    """The installed bedrock-ui package could not be found or parsed.

    This is an environment error (exit 2), never a clean pass — an audit that
    cannot see the platform's real export surface has no basis for saying
    nothing collides with it.
    """


def _split_specifiers(block: str) -> list[str]:
    """`{ A, B as C, type D }` -> the names actually exported (`A`, `C`, `D`)."""
    names: list[str] = []
    for raw in block.split(","):
        part = raw.strip()
        if not part:
            continue
        part = re.sub(r"^type\s+", "", part)
        # `X as Y` exports Y; Y is the name a consumer could collide with.
        if " as " in part:
            part = part.split(" as ")[-1]
        part = part.strip()
        if part and part not in IGNORED_NAMES:
            names.append(part)
    return names


def _resolve(base: pathlib.Path, spec: str) -> pathlib.Path | None:
    """Resolve a relative TS import to a file on disk."""
    target = (base.parent / spec).resolve()
    for candidate in (
        target.with_suffix(".ts"),
        target.with_suffix(".tsx"),
        target / "index.ts",
        target / "index.tsx",
        target,
    ):
        if candidate.is_file():
            return candidate
    return None


def _exports_of(path: pathlib.Path) -> set[str]:
    """Every symbol a single file exports, ignoring re-exports."""
    text = path.read_text(encoding="utf-8", errors="replace")
    names: set[str] = set()
    names.update(_EXPORT_DECL.findall(text))
    names.update(_EXPORT_DEFAULT_FN.findall(text))
    for block in _EXPORT_BLOCK.findall(text):
        # `export { x } from "./y"` is a re-export, handled by the barrel walk.
        if "from" in block:
            continue
        names.update(_split_specifiers(block))
    return {name for name in names if name not in IGNORED_NAMES}


def _package_barrel(node_modules: pathlib.Path, package: str) -> pathlib.Path:
    """Find the entry-point source file for an installed package.

    Reads the package's own `package.json` `exports["."]` (falling back to
    `main`, then conventional `src/index.ts` / `index.ts` locations) rather
    than hardcoding a path, so this works for any bedrock-ui-shaped package
    dropped under a different consumer's `node_modules`.
    """
    package_dir = node_modules
    for part in package.split("/"):
        package_dir = package_dir / part

    manifest = package_dir / "package.json"
    if not manifest.is_file():
        raise PackageResolutionError(
            f"{package_dir} has no package.json - run npm install. "
            "A missing package is an environment problem, not a clean audit."
        )

    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PackageResolutionError(f"could not parse {manifest}: {exc}") from exc

    entry: str | None = None
    exports = data.get("exports")
    if isinstance(exports, dict):
        root = exports.get(".")
        if isinstance(root, str):
            entry = root
        elif isinstance(root, dict):
            entry = root.get("import") or root.get("default") or root.get("require")
    if entry is None and isinstance(data.get("main"), str):
        entry = data["main"]

    candidates = []
    if entry:
        candidates.append(package_dir / entry)
    candidates.extend(
        [
            package_dir / "src" / "index.ts",
            package_dir / "src" / "index.tsx",
            package_dir / "index.ts",
        ]
    )

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    raise PackageResolutionError(
        f"could not locate an entry-point source file for {package} under "
        f"{package_dir} - checked {[str(c) for c in candidates]}"
    )


def platform_exports(node_modules: pathlib.Path, package: str) -> set[str]:
    """Walk the package barrel, following `export *`, and collect every name."""
    barrel = _package_barrel(node_modules, package)

    names: set[str] = set()
    seen: set[pathlib.Path] = set()
    queue = [barrel]

    while queue:
        current = queue.pop()
        if current in seen:
            continue
        seen.add(current)

        text = current.read_text(encoding="utf-8", errors="replace")
        names.update(_exports_of(current))

        for spec in _EXPORT_STAR.findall(text):
            resolved = _resolve(current, spec)
            if resolved:
                queue.append(resolved)

        for block, spec in _EXPORT_NAMED_FROM.findall(text):
            names.update(_split_specifiers(block))
            resolved = _resolve(current, spec)
            if resolved:
                queue.append(resolved)

    return names


def _source_files(base: pathlib.Path) -> list[pathlib.Path]:
    if not base.is_dir():
        return []
    return sorted(
        path
        for path in base.rglob("*")
        if path.suffix in {".ts", ".tsx"}
        and not path.name.endswith(TEST_SUFFIXES)
    )


def audit(
    repo_root: pathlib.Path,
    source_root: pathlib.Path,
    collision_roots: list[pathlib.Path],
    package: str,
) -> list[str]:
    """Run all three §S1 rules against one app's source tree.

    `source_root` is the whole app source tree (used for rules 2 and 3);
    `collision_roots` is the subset checked against the platform's export
    surface for rule 1 (e.g. `components/` and `pages/`, but not every
    hook or util, which legitimately share names with library internals).

    Raises `PackageResolutionError` — never returns a false clean — when the
    installed package cannot be found or parsed.
    """
    problems: list[str] = []
    node_modules = (repo_root / source_root).parent / "node_modules"
    platform = platform_exports(node_modules, package)

    # --- rule 1: no local twin of a platform export ------------------------
    for folder in collision_roots:
        for path in _source_files(repo_root / folder):
            text = path.read_text(encoding="utf-8", errors="replace")
            forked = set(_SHADOWS.findall(text))
            rel = path.relative_to(repo_root).as_posix()

            for name in sorted(_exports_of(path) & platform):
                if name in forked:
                    continue
                problems.append(
                    f"{rel} exports `{name}`, which {package} already "
                    f"exports. Compose around the platform component rather "
                    f"than re-implementing it; if this is a deliberate fork, "
                    f"say so with a `@shadows {name}` marker and a reason."
                )

    # --- rule 2: one factory, one route map --------------------------------
    all_source = _source_files(repo_root / source_root)
    for symbol, label in (
        ("queryKeys", "query-key factory"),
        ("API_ROUTES", "route map"),
    ):
        pattern = re.compile(rf"^\s*export\s+const\s+{symbol}\b", re.M)
        owners = [
            path.relative_to(repo_root).as_posix()
            for path in all_source
            if pattern.search(path.read_text(encoding="utf-8", errors="replace"))
        ]
        if len(owners) != 1:
            problems.append(
                f"{len(owners)} files declare `export const {symbol}`: "
                f"{', '.join(owners) if owners else '(none)'}. There must be "
                f"exactly one {label}."
            )

    # --- rule 3: one HTTP client -------------------------------------------
    for path in all_source:
        text = path.read_text(encoding="utf-8", errors="replace")
        if _AXIOS_IMPORT.search(text):
            problems.append(
                f"{path.relative_to(repo_root).as_posix()} imports axios "
                f"directly. Use the platform's apiClient instead - it "
                f"carries the base URL, the auth header and the refresh "
                f"interceptor, and a bare axios call skips all three "
                f"silently."
            )

    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", default=".", help="repository root")
    parser.add_argument(
        "--source-root",
        default="frontend/src",
        help="the app's whole source tree, relative to --repo-root",
    )
    parser.add_argument(
        "--collision-root",
        action="append",
        dest="collision_roots",
        help="a directory (relative to --repo-root) checked against the "
        "platform's export surface; repeatable. Defaults to "
        "frontend/src/components and frontend/src/pages.",
    )
    parser.add_argument(
        "--package",
        default="@djntechnic/bedrock-ui",
        help="the installed platform package to check for collisions",
    )
    args = parser.parse_args(argv)

    repo_root = pathlib.Path(args.repo_root).resolve()
    source_root = pathlib.Path(args.source_root)
    collision_roots = [
        pathlib.Path(p)
        for p in (
            args.collision_roots
            or ["frontend/src/components", "frontend/src/pages"]
        )
    ]

    try:
        problems = audit(repo_root, source_root, collision_roots, args.package)
    except PackageResolutionError as exc:
        logger.error(str(exc))
        return 2

    for problem in problems:
        logger.error(problem)

    if not problems:
        logger.info("OK - no local twin of a platform export.")

    return 1 if problems else 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
