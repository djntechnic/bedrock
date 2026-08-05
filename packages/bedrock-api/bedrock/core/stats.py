"""
Module:  stats.py
Layer:   api/core
Desc:    Tracking utility for API request statistics (hits, errors, last accessed).
"""
import re
from datetime import datetime, timedelta
from typing import Iterator, Optional

# Starlette path converters (e.g. ``{key:path}``, ``{id:int}``) are absent from
# the OpenAPI schema, which uses the bare ``{key}`` form. Normalising to the
# OpenAPI form keeps request telemetry, the route table, and the doc lookup on a
# single canonical path template.
_CONVERTER_RE = re.compile(r"{([^:}]+):[^}]+}")


def normalize_path_template(path: str) -> str:
    """Strip Starlette path converters so ``{key:path}`` becomes ``{key}``."""
    return _CONVERTER_RE.sub(r"{\1}", path)

# Global dictionary to track API hits and last accessed time.
# Keys are tuples of (method, path) e.g., ("GET", "/api/v1/players/{player_id}")
# NOTE: process-local and not persisted — data is lost on server restart.
api_stats = {}


def iter_route_specs(routes, prefix: str = "") -> Iterator[tuple[str, list[str], str]]:
    """
    Flatten an ASGI route table into ``(full_path, methods, name)`` tuples.

    FastAPI/Starlette (>= 0.139 / 1.3) no longer flatten sub-routers into
    ``app.routes``; instead each ``include_router`` call registers an
    ``_IncludedRouter`` wrapper whose child routes carry *relative* paths under
    an ``include_context.prefix``. Older versions flattened everything with
    absolute paths. This helper handles both shapes by descending into any
    ``original_router`` while accumulating the mount prefix, so callers always
    receive fully-qualified path templates.

    Args:
        routes: An iterable of ASGI route/router objects (e.g. ``app.routes``).
        prefix: Path prefix accumulated from enclosing routers.

    Yields:
        Tuples of ``(full_path, methods, name)`` for each concrete route. Mounts
        (e.g. static files) and websocket routes without HTTP methods are skipped.
    """
    for route in routes:
        original = getattr(route, "original_router", None)
        if original is not None:
            include_ctx = getattr(route, "include_context", None)
            sub_prefix = getattr(include_ctx, "prefix", "") or ""
            yield from iter_route_specs(original.routes, prefix + sub_prefix)
            continue

        path = getattr(route, "path", None)
        if path is None:
            continue
        methods = getattr(route, "methods", None)
        if not methods:
            continue
        yield normalize_path_template(prefix + path), list(methods), getattr(route, "name", "") or ""


def full_route_path(scope) -> Optional[str]:
    """
    Reconstruct the fully-qualified templated path for a matched request scope.

    ``scope["route"].path`` is *relative* to its include prefix under modern
    FastAPI, while ``scope["path"]`` holds the concrete request path. This
    strips the route's own (parameter-substituted) tail from the concrete path
    to recover the mount prefix, then re-attaches the templated tail — yielding
    the same absolute template used by :func:`iter_route_specs` so request
    telemetry keys join cleanly with the route table.

    Args:
        scope: The ASGI request scope of a matched route.

    Returns:
        The absolute templated path (e.g. ``/api/v1/rankings/config/sources/{source_key}``),
        or ``None`` when no route matched.
    """
    route = scope.get("route")
    if route is None:
        return None
    rel_template = getattr(route, "path", None)
    if rel_template is None:
        return scope.get("path")

    rel_concrete = rel_template
    for name, value in (scope.get("path_params") or {}).items():
        # Match both the bare ``{name}`` form and converter form ``{name:conv}``.
        rel_concrete = re.sub(
            r"{" + re.escape(name) + r"(:[^}]+)?}", str(value), rel_concrete
        )

    concrete_full = scope.get("path", "") or ""
    if rel_concrete and concrete_full.endswith(rel_concrete):
        prefix = concrete_full[: len(concrete_full) - len(rel_concrete)]
        return normalize_path_template(prefix + rel_template)
    # Fallback: relative path already absolute (older FastAPI) or no match.
    return normalize_path_template(rel_template)

def track_request(method: str, path: str, status_code: int):
    """
    Record a single API request in the in-memory stats tracker.

    Args:
        method: HTTP method string (e.g., 'GET', 'POST').
        path: Route path as registered (e.g., '/api/v1/players/{player_id}').
        status_code: HTTP response status code; >= 400 increments error count.

    Side effects:
        Mutates the module-level ``api_stats`` dict. Also prunes timestamps
        older than 24 hours to bound memory growth.
    """
    key = (method, path)
    if key not in api_stats:
        api_stats[key] = {
            "hits": 0,
            "errors": 0,
            "last_accessed": None,
            "timestamps": []
        }
    
    now = datetime.now()
    stats = api_stats[key]
    stats["hits"] += 1
    stats["last_accessed"] = now.isoformat()
    if status_code >= 400:
        stats["errors"] += 1
    stats["timestamps"].append(now)
    
    # Keep only timestamps in the last 24 hours
    cutoff = now - timedelta(hours=24)
    stats["timestamps"] = [t for t in stats["timestamps"] if t > cutoff]
