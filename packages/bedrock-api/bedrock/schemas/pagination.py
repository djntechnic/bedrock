"""
Module:  pagination.py
Layer:   bedrock/schemas
Desc:    The server half of F3. A page envelope and the query parameters that
         produce one, so every paginated endpoint in every bedrock app has the
         same shape and `GridWrapper`'s `pagination` prop can be fed from it
         without a per-endpoint adapter.

         Kept deliberately small. This is a contract, not a query builder: it
         does not touch the database, does not compose SQL, and does not know
         what a row is. An endpoint uses `PageParams` for the inputs and
         `Page.build` for the output, and writes its own query in between —
         where the indexes and the joins it needs are visible.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Generic, Sequence, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")

#: Ceiling on `page_size`. Not a style preference: without one, `?page_size=1000000`
#: is a request to materialise the whole table, which is the denial-of-service
#: pagination was added to prevent.
MAX_PAGE_SIZE = 500

DEFAULT_PAGE_SIZE = 50


@dataclass(frozen=True)
class PageParams:
    """Validated `page` / `page_size`, as a FastAPI dependency.

    ``page`` is 1-based because that is what the pager renders and what a user
    types into a URL. ``offset`` converts once, here, so no endpoint has to get
    the ``(page - 1) * page_size`` right on its own.
    """

    page: int
    page_size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


def page_params(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(
        DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE,
        description=f"Rows per page (max {MAX_PAGE_SIZE})",
    ),
) -> PageParams:
    """FastAPI dependency yielding validated pagination inputs.

    The bounds live in `Query` rather than in a hand-rolled check so an
    out-of-range value is a 422 with a field-level message, and so the limits
    appear in the OpenAPI schema — which is where a client author looks before
    asking for a million rows.
    """
    return PageParams(page=page, page_size=page_size)


class Page(BaseModel, Generic[T]):
    """One page of results, plus what the client needs to render a pager.

    ``total`` and ``page_count`` are both present and that is not redundant:
    a large table's count is often an estimate, and a client showing "5,000
    rows" while paging through exactly 200 pages needs to know which of the two
    numbers to trust. `GridWrapper` prefers `page_count` when given it.
    """

    items: list[T]
    total: int
    page: int
    page_size: int
    page_count: int
    has_next: bool
    has_previous: bool

    @classmethod
    def build(cls, items: Sequence[T], total: int, params: PageParams) -> "Page[T]":
        """Assemble a page from a query's rows and its total count.

        `total` is the count of everything matching the filters, not
        `len(items)` — that is the single easiest thing to get wrong here, and
        it produces a pager that always claims one page.
        """
        page_count = max(1, math.ceil(total / params.page_size)) if total else 1
        return cls(
            items=list(items),
            total=total,
            page=params.page,
            page_size=params.page_size,
            page_count=page_count,
            has_next=params.page < page_count,
            has_previous=params.page > 1,
        )
