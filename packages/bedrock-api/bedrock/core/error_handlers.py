"""
Module:  error_handlers.py
Layer:   api/core
Desc:    The platform's exception handlers, and one call that registers them.

         `database.py` has documented the GRID_QUERY_FAILED envelope since
         Phase 2.b, but nothing ever registered a handler for it. The result
         was the worst available outcome for a data table: a query that blew
         up rendered as an empty grid, indistinguishable from a filter that
         matched nothing. Every consumer that noticed wrote the handler by
         hand, and every consumer that did not shipped the silent version.

         Wire it in the application's entry point, next to the rate limiter:

             from bedrock.core.error_handlers import register_error_handlers
             register_error_handlers(app)
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from loguru import logger
from starlette.responses import JSONResponse

from bedrock.core.database import DatabaseQueryError


async def database_query_error_handler(request: Request, exc: Exception) -> JSONResponse:
    """Translate a failed SELECT into the documented GRID_QUERY_FAILED envelope.

    The SQL goes to the log and never to the response — a failing statement
    names tables and columns, and the endpoint that raised it is often
    reachable by anyone who can see a grid.

    Typed against bare `Exception` because that is Starlette's handler
    signature; the registration below is what pins the concrete type, and the
    diagnostic fields are read defensively rather than asserted so an
    optimised build cannot turn a 500 into a crash.

    :param request: The request whose handler raised.
    :param exc: The originating query error, carrying the SQL and cause.
    :returns: A 500 carrying the stable error code `<DataGrid>` renders on.
    """
    logger.error(
        "Grid query failed path={} sql={} cause={}",
        request.url.path,
        getattr(exc, "sql", None),
        repr(getattr(exc, "original", None)),
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "code": "GRID_QUERY_FAILED",
                "message": "Database query failed. See server logs for the underlying SQL.",
            }
        },
    )


def register_error_handlers(app: FastAPI) -> None:
    """Register every platform exception handler on an application.

    One call rather than an exported handler per exception, so a consumer that
    upgrades picks up a newly handled exception without editing its entry
    point — which is the failure this issue was about in the first place.

    :param app: The FastAPI application to register against.
    """
    app.add_exception_handler(DatabaseQueryError, database_query_error_handler)
