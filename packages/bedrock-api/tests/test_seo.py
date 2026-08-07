"""
Module:  test_seo.py
Layer:   bedrock-api/tests
Desc:    The sitemap registry, its XML, and robots.txt (plan F5).

         The two that matter most: an app that registers nothing still gets a
         valid sitemap, and one broken source does not take the whole file
         down. A sitemap that 500s makes a crawler back off the entire site
         rather than one section of it.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from bedrock.core import sitemap as sm
from bedrock.core.sitemap import SitemapEntry, render_robots, render_sitemap
from bedrock.routes import seo

BASE = "https://example.test"


@pytest.fixture(autouse=True)
def clean_registry():
    # `__clear_sitemap_sources` is name-mangled at module scope the same way
    # every other registry's test helper is; reached through the module dict
    # for the same reason.
    clear = sm.__dict__["__clear_sitemap_sources"]
    clear()
    yield
    clear()


@pytest.fixture
def client(platform_db) -> TestClient:
    app = FastAPI()
    app.include_router(seo.router)
    return TestClient(app)


def entries(*locs: str) -> list[SitemapEntry]:
    return [SitemapEntry(loc=loc) for loc in locs]


# ── The registry ─────────────────────────────────────────────────────────────

def test_nothing_registered_yields_an_empty_but_valid_sitemap(client):
    resp = client.get("/sitemap.xml")
    assert resp.status_code == 200
    root = ET.fromstring(resp.text)
    assert root.tag.endswith("urlset")
    assert list(root) == []


def test_sources_are_collected_in_registration_order():
    sm.register_sitemap_source("pages", lambda: entries("/", "/about"))
    sm.register_sitemap_source("sets", lambda: entries("/sets/1"))
    assert [e.loc for e in sm.collect_entries()] == ["/", "/about", "/sets/1"]


def test_re_registering_a_name_overwrites():
    """Repeated imports — tests, reloaders — must be idempotent."""
    sm.register_sitemap_source("pages", lambda: entries("/old"))
    sm.register_sitemap_source("pages", lambda: entries("/new"))
    assert [e.loc for e in sm.collect_entries()] == ["/new"]


def test_a_duplicate_url_appears_once():
    """Two sources listing the same page is a normal consequence of
    independent registration; a duplicate in the file is a defect a crawler
    reports."""
    sm.register_sitemap_source("a", lambda: entries("/", "/shared"))
    sm.register_sitemap_source("b", lambda: entries("/shared", "/b"))
    assert [e.loc for e in sm.collect_entries()] == ["/", "/shared", "/b"]


def test_a_raising_source_is_skipped_and_the_rest_survive():
    def broken() -> list[SitemapEntry]:
        raise RuntimeError("query failed")

    sm.register_sitemap_source("broken", broken)
    sm.register_sitemap_source("pages", lambda: entries("/", "/about"))

    assert [e.loc for e in sm.collect_entries()] == ["/", "/about"]


def test_a_broken_source_does_not_500_the_endpoint(client):
    def broken() -> list[SitemapEntry]:
        raise RuntimeError("query failed")

    sm.register_sitemap_source("broken", broken)
    assert client.get("/sitemap.xml").status_code == 200


def test_the_url_ceiling_truncates_rather_than_serving_something_invalid():
    """A file over 50,000 URLs is rejected outright by the protocol."""
    sm.register_sitemap_source(
        "many", lambda: [SitemapEntry(loc=f"/p/{i}") for i in range(sm.MAX_URLS + 10)]
    )
    assert len(sm.collect_entries()) == sm.MAX_URLS


# ── The XML ──────────────────────────────────────────────────────────────────

def test_relative_locs_become_absolute():
    xml = render_sitemap(entries("/sets/1"), BASE)
    assert f"<loc>{BASE}/sets/1</loc>" in xml


def test_an_absolute_loc_is_left_alone():
    xml = render_sitemap(entries("https://cdn.example/thing"), BASE)
    assert "<loc>https://cdn.example/thing</loc>" in xml


def test_a_query_string_is_escaped():
    """One raw ampersand makes the whole document unparseable, so a single row
    with a query string takes down the entire sitemap."""
    xml = render_sitemap(entries("/search?q=a&page=2"), BASE)
    assert "&amp;" in xml
    ET.fromstring(xml)  # parses


def test_optional_fields_are_emitted_only_when_given():
    xml = render_sitemap(
        [SitemapEntry(loc="/a", lastmod="2026-08-07", changefreq="daily", priority=0.8)],
        BASE,
    )
    assert "<lastmod>2026-08-07</lastmod>" in xml
    assert "<changefreq>daily</changefreq>" in xml
    assert "<priority>0.8</priority>" in xml

    bare = render_sitemap(entries("/b"), BASE)
    assert "lastmod" not in bare
    assert "priority" not in bare


@pytest.mark.parametrize("given,expected", [(1.7, "1.0"), (-3.0, "0.0")])
def test_an_out_of_range_priority_is_clamped_not_rejected(given, expected):
    xml = render_sitemap([SitemapEntry(loc="/a", priority=given)], BASE)
    assert f"<priority>{expected}</priority>" in xml


def test_a_trailing_slash_on_the_base_does_not_double_up():
    xml = render_sitemap(entries("/a"), "https://example.test/")
    assert "<loc>https://example.test/a</loc>" in xml


def test_the_document_parses_with_the_sitemaps_namespace():
    xml = render_sitemap(entries("/a", "/b"), BASE)
    root = ET.fromstring(xml)
    assert root.tag == "{http://www.sitemaps.org/schemas/sitemap/0.9}urlset"
    assert len(list(root)) == 2


# ── robots.txt ───────────────────────────────────────────────────────────────

def test_robots_points_at_the_sitemap():
    assert f"Sitemap: {BASE}/sitemap.xml" in render_robots(BASE)


def test_robots_allows_everything_by_default():
    text = render_robots(BASE)
    assert "Disallow: /\n" not in text


def test_robots_can_block_a_staging_deployment():
    assert "Disallow: /" in render_robots(BASE, allow=False)


def test_robots_can_exclude_specific_paths():
    text = render_robots(BASE, disallow=("/admin", "/api"))
    assert "Disallow: /admin" in text
    assert "Disallow: /api" in text


def test_robots_is_served_as_plain_text(client):
    resp = client.get("/robots.txt")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/plain")


def test_the_sitemap_is_served_as_xml_and_cacheable(client):
    resp = client.get("/sitemap.xml")
    assert resp.headers["content-type"].startswith("application/xml")
    assert "max-age" in resp.headers["cache-control"]


def test_the_sources_endpoint_names_what_is_registered(client):
    """An empty sitemap is otherwise indistinguishable from a broken one."""
    sm.register_sitemap_source("pages", lambda: entries("/"))
    assert client.get("/api/v1/seo/sources").json()["sources"] == ["pages"]
