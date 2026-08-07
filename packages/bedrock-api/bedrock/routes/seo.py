"""
Module:  seo.py
Layer:   bedrock/routes
Desc:    `/sitemap.xml` and `/robots.txt` (plan F5).

         **Mount this router at the site root, not under `/api/v1`.** Both
         files are only honoured at the root of a host — `/api/v1/robots.txt`
         is a file no crawler will ever request:

             app.include_router(seo.router)

         In the compose stack nginx serves the SPA and proxies `/api`, so
         reaching these means adding two `location` blocks that proxy to the
         API. `docs/seo.md` has them.
"""
from fastapi import APIRouter, Response

from bedrock.core.database import db
from bedrock.core.sitemap import (
    collect_entries,
    registered_source_names,
    render_robots,
    render_sitemap,
)

router = APIRouter()

_DEFAULT_BASE_URL = "http://localhost:5173"


def _base_url() -> str:
    """The site's public origin, from `system_base_url`.

    The same setting F1 builds its emailed links from — a site has one public
    origin and it should be configured once. A sitemap full of localhost URLs
    is the visible symptom of it being unset.
    """
    try:
        value = db.get_config("system_base_url", _DEFAULT_BASE_URL)
    except Exception:  # noqa: BLE001 — a crawler must not get a 500 for this.
        return _DEFAULT_BASE_URL
    return str(value).strip() or _DEFAULT_BASE_URL


def _index_allowed() -> bool:
    """`seo_allow_indexing`, default on.

    Off writes a blanket `Disallow: /`, which is what a staging deployment
    wants. It asks well-behaved crawlers not to index and is not access
    control — a staging site with real data still needs authentication.
    """
    try:
        return str(db.get_config("seo_allow_indexing", "true")).lower() != "false"
    except Exception:  # noqa: BLE001
        return True


@router.get("/sitemap.xml", include_in_schema=False)
def sitemap() -> Response:
    """Every URL the application has registered.

    An app that registers nothing gets a valid, empty `<urlset>` rather than a
    404 — the same "degrades when nothing is registered" contract every other
    registry has, and a crawler reading an empty sitemap simply crawls the
    links it finds instead.
    """
    xml = render_sitemap(collect_entries(), _base_url())
    return Response(
        content=xml,
        media_type="application/xml",
        # An hour: long enough that a crawler hitting it repeatedly costs
        # nothing, short enough that a new page is discoverable the same day.
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/robots.txt", include_in_schema=False)
def robots() -> Response:
    return Response(
        content=render_robots(_base_url(), allow=_index_allowed()),
        media_type="text/plain",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/api/v1/seo/sources", include_in_schema=False)
def sitemap_sources() -> dict:
    """Which sources are registered. For the admin surface and for debugging
    an empty sitemap, which is otherwise indistinguishable from a broken one."""
    return {"sources": list(registered_source_names())}
