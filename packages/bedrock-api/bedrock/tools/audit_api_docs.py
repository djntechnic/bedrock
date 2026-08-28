"""
Module:  audit_api_docs.py
Layer:   bedrock/tools
Desc:    Gate for the boundary between a consumer app's shipped `/api/v1`
         route surface and the human-readable reference that documents it.

         Every bedrock consumer ships an HTTP API, and every one of them
         builds it out of `include_router` calls. That is exactly the shape
         `bedrock.core.stats.iter_route_specs` exists to flatten: modern
         FastAPI/Starlette wraps each included sub-router in an
         `_IncludedRouter` object whose child routes carry paths relative to
         an `include_context.prefix`, so a naive walk of `app.routes` sees
         the wrapper objects and misses every real endpoint underneath. A
         doc-reconciliation gate that walked `app.routes` directly would
         silently under-count the shipped surface and pass a doc that is
         missing most of the API. Reusing `iter_route_specs` here is what
         keeps this gate, the request-telemetry table, and the admin route
         list agreeing on what "the route surface" means.

         Two findings, both blocking:
           1. A route the app ships is not mentioned in the reference doc.
           2. The reference doc mentions a `METHOD /prefix/...` line that no
              route in the app actually serves.

         This lives in the platform, not copied into each consumer
         (CollectIt, MLBTracker, ...), because the property being checked -
         "the documented API matches the shipped one" - belongs to
         consuming bedrock's routing, not to any app's domain. A second copy
         per consumer is exactly the kind of drift this whole mechanism
         exists to prevent.

         Unlike the design-tokens gate, a missing reference doc is NOT a
         clean pass here: every consumer with a shipped `/api/v1` surface
         is expected to maintain one, so a repo with routes but no doc at
         all has not "not yet adopted" this practice - it has nothing to
         reconcile against, which is an environment error (exit 2), not a
         silent success.

         Exit 0 clean, 1 on a violation, 2 on an environment error.

Usage:   python -m bedrock.tools.audit_api_docs --app api.main:app
         python -m bedrock.tools.audit_api_docs \\
             --repo-root . --doc docs/guide/api_reference.md \\
             --prefix /api/v1 --app api.main:app
"""
from __future__ import annotations

import argparse
import importlib
import pathlib
import re
import sys

from loguru import logger

from bedrock.core.stats import iter_route_specs

METHOD_TOKENS = ("GET", "POST", "PUT", "PATCH", "DELETE")


class EnvironmentProblem(Exception):
    """The app could not be imported, or the doc file could not be read.

    An environment error (exit 2), never a clean pass or a violation - the
    audit could not see what it was asked to reconcile.
    """


def _route_line_pattern(prefix: str) -> re.Pattern[str]:
    escaped = re.escape(prefix)
    return re.compile(
        r"\b(GET|POST|PUT|PATCH|DELETE)\s+(" + escaped + r"/[A-Za-z0-9_\-{}:/.]*)"
    )


def load_app(dotted_path: str):
    """Import a `module:attribute` path and return the attribute.

    Kept separate from `audit()` so the reconciliation logic itself never
    needs a real, importable consumer app to be exercised - a test builds a
    small FastAPI app in-process and hands it straight to `collect_shipped_routes`.
    """
    module_name, _, attr_name = dotted_path.partition(":")
    if not module_name or not attr_name:
        raise EnvironmentProblem(
            f"{dotted_path!r} is not a `module:attribute` path."
        )
    try:
        module = importlib.import_module(module_name)
    except Exception as exc:  # noqa: BLE001
        raise EnvironmentProblem(f"could not import {module_name!r}: {exc}") from exc
    try:
        return getattr(module, attr_name)
    except AttributeError as exc:
        raise EnvironmentProblem(
            f"{module_name!r} has no attribute {attr_name!r}"
        ) from exc


def collect_shipped_routes(app, prefix: str) -> set[tuple[str, str]]:
    """Enumerate an app's route surface under `prefix` as `(method, path)` pairs.

    Uses `iter_route_specs`, which recurses into `_IncludedRouter` mounts - a
    bare walk of `app.routes` yields only the outer router objects and
    misses every route registered through `include_router`.
    """
    out: set[tuple[str, str]] = set()
    for path, methods, _name in iter_route_specs(app.routes):
        if not path.startswith(prefix):
            continue
        for method in methods:
            if method in METHOD_TOKENS:
                out.add((method, path))
    return out


def collect_documented_routes(doc_path: pathlib.Path, prefix: str) -> set[tuple[str, str]]:
    """Every `METHOD prefix/...` line the reference doc mentions.

    Raises `EnvironmentProblem` when the file cannot be read - a missing
    reference doc is an environment problem for this gate (see module
    docstring), not something this function silently tolerates.
    """
    if not doc_path.is_file():
        raise EnvironmentProblem(f"{doc_path} not found - create it before running this gate.")
    try:
        text = doc_path.read_text(encoding="utf-8")
    except OSError as exc:
        raise EnvironmentProblem(f"could not read {doc_path}: {exc}") from exc

    pattern = _route_line_pattern(prefix)
    return {(m.group(1), m.group(2)) for m in pattern.finditer(text)}


def audit(shipped: set[tuple[str, str]], documented: set[tuple[str, str]]) -> list[str]:
    """Reconcile a shipped route set against a documented one.

    Pure and printing-free: callers collect both sets first (via
    `collect_shipped_routes`/`collect_documented_routes` or their own
    fixtures) so this can be exercised without a real app or a real file on
    disk.
    """
    problems: list[str] = []

    missing_from_docs = shipped - documented
    stale_in_docs = documented - shipped

    for method, path in sorted(missing_from_docs):
        problems.append(f"{method} {path} is shipped but not documented.")
    for method, path in sorted(stale_in_docs):
        problems.append(f"{method} {path} is documented but not shipped.")

    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", default=".", help="repository root")
    parser.add_argument(
        "--doc",
        default="docs/guide/api_reference.md",
        help="the API reference doc, relative to --repo-root",
    )
    parser.add_argument(
        "--prefix",
        default="/api/v1",
        help="the route prefix the reference doc covers",
    )
    parser.add_argument(
        "--app",
        default="api.main:app",
        help="dotted `module:attribute` path to the FastAPI app to introspect",
    )
    args = parser.parse_args(argv)

    repo_root = pathlib.Path(args.repo_root).resolve()
    doc_path = repo_root / args.doc

    # `--app` is imported by dotted path, so the repo whose routes are being
    # audited has to be importable. Without this the flag is a half-truth:
    # --repo-root would move the doc lookup but not the app lookup, and the
    # gate would reconcile one repo's doc against whatever `api.main` the
    # current working directory happened to resolve to.
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))

    try:
        app = load_app(args.app)
        shipped = collect_shipped_routes(app, args.prefix)
        documented = collect_documented_routes(doc_path, args.prefix)
    except EnvironmentProblem as exc:
        logger.error(str(exc))
        return 2

    problems = audit(shipped, documented)

    for problem in problems:
        logger.error(problem)

    if not problems:
        logger.info(f"OK - {len(shipped)} routes documented.")

    return 1 if problems else 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
