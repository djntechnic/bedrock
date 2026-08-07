"""
Module:  test_pagination.py
Layer:   bedrock-api/tests
Desc:    The page envelope and its query parameters (plan F3, server half).
"""
from __future__ import annotations

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from bedrock.schemas.pagination import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    Page,
    PageParams,
    page_params,
)

ROWS = [{"id": i} for i in range(1, 501)]


@pytest.fixture(scope="module")
def client() -> TestClient:
    app = FastAPI()

    @app.get("/items", response_model=Page[dict])
    def list_items(params: PageParams = Depends(page_params)):
        window = ROWS[params.offset:params.offset + params.limit]
        return Page.build(window, total=len(ROWS), params=params)

    return TestClient(app)


# ── PageParams ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("page,size,offset", [
    (1, 50, 0),
    (2, 50, 50),
    (3, 25, 50),
    (10, 100, 900),
])
def test_offset_is_derived_from_a_one_based_page(page, size, offset):
    assert PageParams(page=page, page_size=size).offset == offset


def test_defaults_need_no_query_string(client):
    body = client.get("/items").json()
    assert body["page"] == 1
    assert body["page_size"] == DEFAULT_PAGE_SIZE
    assert len(body["items"]) == DEFAULT_PAGE_SIZE


def test_page_zero_is_rejected(client):
    # 0 would produce a negative offset, which SQLite accepts and Postgres
    # rejects — a bug that only appears after the database is swapped.
    assert client.get("/items?page=0").status_code == 422


@pytest.mark.parametrize("size", [0, -1, MAX_PAGE_SIZE + 1, 1_000_000])
def test_page_size_is_bounded(client, size):
    """Without a ceiling, `?page_size=1000000` asks the server to materialise
    the whole table — the denial of service pagination exists to prevent."""
    assert client.get(f"/items?page_size={size}").status_code == 422


def test_the_bounds_are_in_the_openapi_schema(client):
    spec = client.get("/openapi.json").json()
    params = {p["name"]: p for p in spec["paths"]["/items"]["get"]["parameters"]}
    assert params["page_size"]["schema"]["maximum"] == MAX_PAGE_SIZE
    assert params["page"]["schema"]["minimum"] == 1


# ── Page.build ───────────────────────────────────────────────────────────────

def test_a_middle_page_reports_both_neighbours(client):
    body = client.get("/items?page=3&page_size=100").json()
    assert [r["id"] for r in body["items"]][0] == 201
    assert body["page_count"] == 5
    assert body["has_next"] is True
    assert body["has_previous"] is True


def test_the_first_page_has_no_previous(client):
    body = client.get("/items?page=1&page_size=100").json()
    assert body["has_previous"] is False
    assert body["has_next"] is True


def test_the_last_page_has_no_next(client):
    body = client.get("/items?page=5&page_size=100").json()
    assert body["has_next"] is False
    assert len(body["items"]) == 100


def test_a_short_final_page_is_not_padded(client):
    body = client.get("/items?page=6&page_size=90").json()
    assert body["page_count"] == 6
    assert len(body["items"]) == 50
    assert body["has_next"] is False


def test_a_page_past_the_end_is_empty_rather_than_an_error(client):
    """A stale bookmark should render an empty grid, not a 404. The client can
    see from `page_count` that it overshot."""
    body = client.get("/items?page=99&page_size=100").json()
    assert body["items"] == []
    assert body["page_count"] == 5
    assert body["has_next"] is False


def test_an_empty_result_still_reports_one_page():
    """Zero pages would make the pager render `1 / 0`."""
    page = Page.build([], total=0, params=PageParams(page=1, page_size=50))
    assert page.page_count == 1
    assert page.total == 0
    assert page.has_next is False
    assert page.has_previous is False


def test_total_is_the_filtered_count_not_the_page_length():
    """The easiest thing to get wrong here: passing `len(items)` produces a
    pager that always claims exactly one page."""
    page = Page.build(ROWS[:50], total=500, params=PageParams(page=1, page_size=50))
    assert page.total == 500
    assert page.page_count == 10
    assert page.has_next is True


def test_page_count_survives_a_total_that_is_not_a_multiple():
    page = Page.build([], total=101, params=PageParams(page=1, page_size=50))
    assert page.page_count == 3
