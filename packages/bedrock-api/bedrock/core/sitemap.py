"""
Module:  sitemap.py
Layer:   bedrock/core
Desc:    The sitemap registry and its XML (plan F5).

         A *registry*, not a provider, by the test in
         `docs/extension_points.md`: every source contributes and all of them
         run. A catalog's set pages and a blog's posts both belong in the same
         sitemap.

         The platform cannot know a single URL of an application, so it knows
         none. It owns the format, the size limits, the escaping and the
         caching; the application answers "what is at this site?".

         Failure policy: a raising source is **logged and skipped**, and the
         rest of the sitemap is served. The alternative is that one broken
         query takes every URL out of the file, and a sitemap that 500s is
         worse for a crawler than one missing a section — the crawler backs off
         the whole site rather than one part of it.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Literal
from xml.sax.saxutils import escape

from loguru import logger

#: Hard ceiling from the sitemaps.org protocol. A file over this is rejected
#: outright, so truncating with a warning beats serving something invalid.
MAX_URLS = 50_000

ChangeFreq = Literal[
    "always", "hourly", "daily", "weekly", "monthly", "yearly", "never"
]


@dataclass(frozen=True)
class SitemapEntry:
    """One URL. `loc` is a path (`/sets/12`) or an absolute URL."""

    loc: str
    #: ISO 8601. Crawlers use it to decide what to re-fetch, so an honest value
    #: is worth more than a generated one — `datetime.now()` on every entry
    #: tells a crawler the whole site changed and teaches it to ignore the field.
    lastmod: str | None = None
    changefreq: ChangeFreq | None = None
    #: 0.0–1.0, *relative within this site*. It does not affect ranking against
    #: anyone else, and marking everything 1.0 says nothing at all.
    priority: float | None = None


SitemapSource = Callable[[], list[SitemapEntry]]

_sources: dict[str, SitemapSource] = {}


def register_sitemap_source(name: str, fn: SitemapSource) -> None:
    """Register a source of public URLs.

    Re-registering a name overwrites, which is what keeps repeated imports
    (tests, reloaders) idempotent — the same contract as every other registry.
    """
    _sources[name] = fn


def registered_source_names() -> tuple[str, ...]:
    return tuple(_sources)


def __clear_sitemap_sources() -> None:
    """Test helper. Module scope only."""
    _sources.clear()


def collect_entries() -> list[SitemapEntry]:
    """Every registered source's URLs, in registration order.

    Deduplicates by `loc`, first occurrence winning: two sources listing the
    same page is a normal consequence of independent registration, and a
    duplicated URL in a sitemap is a defect a crawler will report.
    """
    seen: set[str] = set()
    entries: list[SitemapEntry] = []

    for name, fn in _sources.items():
        try:
            produced = fn()
        except Exception as exc:  # noqa: BLE001 — see the module docstring.
            logger.error("Sitemap source {!r} failed: {}", name, exc)
            continue
        for entry in produced:
            if entry.loc in seen:
                continue
            seen.add(entry.loc)
            entries.append(entry)

    if len(entries) > MAX_URLS:
        logger.warning(
            "Sitemap has {} URLs, over the {} limit — truncating. Split it into "
            "a sitemap index when a section grows this large.",
            len(entries), MAX_URLS,
        )
        entries = entries[:MAX_URLS]

    return entries


def _absolute(loc: str, base_url: str) -> str:
    if loc.startswith(("http://", "https://")):
        return loc
    return f"{base_url.rstrip('/')}/{loc.lstrip('/')}"


def render_sitemap(entries: list[SitemapEntry], base_url: str) -> str:
    """Serialise entries as sitemaps.org XML.

    Every value is escaped. `loc` in particular: a URL with a query string
    contains `&`, which is not valid raw XML, and one unescaped ampersand makes
    the whole document unparseable — so the entire sitemap is rejected because
    of one row.
    """
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for entry in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{escape(_absolute(entry.loc, base_url))}</loc>")
        if entry.lastmod:
            lines.append(f"    <lastmod>{escape(entry.lastmod)}</lastmod>")
        if entry.changefreq:
            lines.append(f"    <changefreq>{escape(entry.changefreq)}</changefreq>")
        if entry.priority is not None:
            # Clamped rather than rejected: an out-of-range value is a caller's
            # slip, and refusing to serve the sitemap over it is out of
            # proportion.
            clamped = min(1.0, max(0.0, entry.priority))
            lines.append(f"    <priority>{clamped:.1f}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def render_robots(base_url: str, *, allow: bool = True,
                  disallow: tuple[str, ...] = ()) -> str:
    """robots.txt, pointing at the sitemap.

    `allow=False` writes a blanket `Disallow: /` for a staging deployment.
    Note what that does and does not do: it asks well-behaved crawlers not to
    index, and it is not access control. A staging site with real data still
    needs authentication.
    """
    lines = ["User-agent: *"]
    if not allow:
        lines.append("Disallow: /")
    else:
        for path in disallow:
            lines.append(f"Disallow: {path}")
        if not disallow:
            lines.append("Disallow:")
    lines.append("")
    lines.append(f"Sitemap: {base_url.rstrip('/')}/sitemap.xml")
    return "\n".join(lines) + "\n"
