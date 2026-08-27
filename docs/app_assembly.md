# Assembling an application

`bedrock.core.app_factory.create_app()` builds the FastAPI application: every
platform router at its documented prefix, the platform's exception handlers,
the rate limiter, CORS, and the database boot sequence in lifespan.

```python
from bedrock.core.app_factory import RouterMount, create_app

from api.routes import ROUTERS, PREFIX
import api.domain  # noqa: F401 — registrations are import side effects

app = create_app(
    title="CollectIt API",
    version="0.1.0",
    routers=[RouterMount(r, prefix=PREFIX) for r in ROUTERS],
    root_message="CollectIt API is running",
)
```

That is the whole entry point. Before this existed, the reference for it was
`packages/bedrock-api/tests/conftest.py::build_app()` — a fixture, which two
consumers copied and then drifted from independently. The fixture now *calls*
`create_app()`, so the reference and the implementation cannot disagree.

## What it does, in order

Construction:

1. CORS, from `cors_origins` or the `CORS_ALLOWED_ORIGINS` environment
   variable (comma-separated), defaulting to `http://localhost:5173`.
2. `register_error_handlers()` — including the `DatabaseQueryError` handler
   that logs the failing SQL and keeps it out of the response body. Skip it and
   a failed grid query returns an empty array, so the frontend renders an empty
   grid instead of an error state.
3. The rate limiter, with **bedrock's** 429 handler rather than slowapi's
   default: it records the trip in the auth activity log and returns the
   platform error envelope.
4. The seven platform routers, from `PLATFORM_ROUTER_MOUNTS`.
5. `bedrock.routes.seo`, mounted with **no prefix** — it declares absolute
   paths (`/robots.txt`, `/sitemap.xml`), which is why it is not in the mount
   map and why it needs its own `mount_seo` flag. Pass `mount_seo=False` for an
   application with no public face.
6. The host's own routers, then the optional `GET /` liveness probe.

Boot (lifespan), unless `bootstrap=False`:

```
db.validate_connection()
  → before_migrations hooks
  → apply_migrations()      # raises on failure; a half-migrated schema is worse
  → warn_on_drift()         # advisory, never raises
  → assert_database_healthy()
  → after_bootstrap hooks
  → (serving)
  → on_shutdown hooks
  → db.close_pool()
```

## The hooks, and what each is for

| Parameter | Runs | What a consumer puts here |
| --- | --- | --- |
| `before_migrations` | after the connection is validated, before migrations | anything that must guarantee a schema exists first — a baseline bootstrap, a pin assertion |
| `after_bootstrap` | once the database is up and healthy | schedulers, warm caches, background workers |
| `on_shutdown` | on the way down, before the pool closes | stopping what `after_bootstrap` started |

A hook that raises aborts startup, and migrations do not run. That is the
point: a host that cannot satisfy its own precondition should refuse to serve
rather than migrate into a state nobody intended.

## What stays with the host

Its own routers, its static mounts, its own middleware, and the **eager
imports** that register its contributions to the platform's extension points
([`extension_points.md`](extension_points.md)).

Registration must remain an import side effect — never an `after_bootstrap`
hook. ASGI test transports do not run lifespan, so anything registered there is
invisible to every endpoint test, and the failure shows up as a registry that
is mysteriously empty under test and full in production.

## `bootstrap=False`

Builds the application without a lifespan: no connection validation, no
migrations, no health assertion. This is what a test harness wants — the app
under test is assembled exactly as production assembles it, but the database
is whatever the fixture points at. It is not a production mode.
