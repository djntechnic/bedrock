# Deployment

bedrock is a library, so it cannot ship a deployable image — there is no
`main.py` here and no migrations of its own. What it ships instead is
`deploy/`: templates you copy into your application, plus the one piece that
really is platform code, `bedrock-healthcheck`.

```
deploy/
  Dockerfile.api        multi-stage API image
  Dockerfile.web        Vite build → nginx
  nginx.conf            SPA history fallback + /api proxy
  docker-compose.yml    API + web on SQLite
  .env.example          the environment contract
```

They work unmodified for the standard layout: `api/` holding a FastAPI app at
`api.main:app`, `bedrock_app/`, `migrations/`, and `frontend/` with a Vite
project.

## Quick start

```bash
cp deploy/.env.example .env
# set JWT_SECRET — nothing else is required
python -c "import secrets; print(secrets.token_urlsafe(48))"

docker compose -f deploy/docker-compose.yml up --build
# → http://localhost:8080
```

The API is not published to the host. The browser talks to nginx, which
proxies `/api` to the API container — one origin, so there is no CORS to
configure and the SPA bundle can carry an empty `VITE_API_BASE_URL` and work
in any environment.

## The database engine

**SQLite, and only SQLite.** The compose stack runs the API against a SQLite
file in its data volume, because that is the engine bedrock's schema is written
for: `baseline.sql` and `seed.sql` use `AUTOINCREMENT` and `datetime('now')`,
and the boot-time integrity and diagnostic checks issue `PRAGMA` and
`sqlite_master` queries unconditionally. Setting `DATABASE_URL` to a
`postgresql://` URL connects and then fails while applying migrations.

The connection layer has real Postgres plumbing — `psycopg2`, a dialect
branch, `%s` parameters that `DatabaseManager` rewrites for SQLite — which is
why this reads as more finished than it is. It is not a supported deployment,
and no CI job exercises it. Issue #25 tracks either completing the path or
removing the plumbing.

Until then the compose file's `db` service sits behind the `postgres` profile
and does not start. Do not plan a deployment around it.

What SQLite costs you is one writer at a time: concurrent writes serialise and
surface as `database is locked` under load. That is a real ceiling on a
write-heavy or multi-container deployment, and the reason #25 matters.

## The three health endpoints

This is the part most worth reading before wiring anything automated.

| Endpoint | Answers | Status |
| --- | --- | --- |
| `GET /api/v1/health` | the full diagnostic report | **always 200** |
| `GET /api/v1/health/live` | is the process running? | 200 |
| `GET /api/v1/health/ready` | can it serve traffic? | **503 when it cannot** |

Point healthchecks, load balancers and deploy gates at **`/health/ready`**.
`/health` answers 200 with `db_reachable: false`, which is right for the admin
Health page — it is a report, and the caller reads the body — and useless to an
orchestrator: a healthcheck on it marks a container healthy while every request
500s, so nothing restarts and a rolling deploy promotes the broken container
over the working one.

Readiness checks a database **read and write**. A database that has gone
read-only — a full disk, a read-only mount, a replica promoted the wrong way —
answers `SELECT 1` happily and fails every login, which is exactly the state
the probe exists to catch. It deliberately does *not* check mail or
storage: both degrade to a logged no-op by design, and failing readiness
because SMTP is down would pull a serviceable site out of rotation.

Liveness touches nothing. A liveness probe that queries the database conflates
"the app is wedged" with "the database is restarting", and killing the app in the
second case makes the outage longer.

### `bedrock-healthcheck`

A console script the package installs, used by the API image's `HEALTHCHECK`.
It exists because `curl -f .../health/ready` does not work on a slim Python
image — there is no curl, and installing one adds a package and its CVE surface
to every deploy for a three-line request. It uses `urllib` from the standard
library and has no imports from bedrock itself, because it must run in exactly
the states where the application cannot import.

```bash
bedrock-healthcheck                          # http://127.0.0.1:$PORT/api/v1/health/ready
bedrock-healthcheck --url URL --timeout 5
```

Exit 0 ready, 1 not, and the reason on stderr so `docker inspect` shows a cause
rather than a bare "unhealthy". It probes loopback on purpose: the check runs
inside the container, so depending on DNS or the ingress would report the app
unhealthy when the load balancer is what broke.

## The environment contract

`deploy/.env.example` is the full list, annotated. One variable has no safe
default:

- **`JWT_SECRET`** — unset, bedrock generates one and persists it to
  `app_config_settings` so restarts do not log everyone out. That is a
  development convenience and wrong in production two ways: the secret lives in
  the database it protects, and two containers generate two different secrets,
  so a token minted by one is rejected by the other.
Everything else has a working default. `POSTGRES_USER` / `POSTGRES_PASSWORD` /
`POSTGRES_DB` are still listed, but they configure the profile-gated `db`
service only, and nothing reads them unless you opt into a profile that does
not work yet. A test
(`test_env_example_documents_every_variable_config_reads`) asserts that every
variable `bedrock.core.config` reads appears in the example, so the contract
cannot drift out of the file that documents it.

Note that `VITE_API_BASE_URL` is **baked into the bundle at build time** — Vite
inlines `VITE_*`, so setting it on a running container does nothing. An image
is therefore environment-specific unless you use the default same-origin path,
which is why the compose file builds it empty.

## Scaling past one container

The compose file runs **one uvicorn worker**, and that is deliberate. Two
things in bedrock hold per-process state:

- **The rate limiter.** `slowapi`'s default backend is in-memory, so N workers
  means N independent counters and an effective limit of N× what is configured.
  `rate_limit.py` notes this is a config change — point it at Redis — if you
  horizontally scale.
- **The diagnostics scheduler.** A polling thread per process, so N workers run
  the same scheduled job N times.

So scale by running more containers behind a load balancer only once the rate
limiter has a shared backend; until then, one container, vertically sized.

Migrations run at application startup, which is fine for one container and a
race for several starting at once. Run them as a separate step before the
rollout when you get there.

## What this does not cover

- **TLS.** Terminate it at whatever sits in front — a cloud load balancer,
  Caddy, Traefik, or nginx with certbot. The image speaks plain HTTP on purpose:
  baking certificate handling into an application container makes renewal a
  redeploy.
- **Backups.** The database lives in the `api_data` volume along with uploads;
  back that volume up. bedrock ships `backup_database` / `restore_from_backup`,
  which take a consistent copy of a SQLite file that is being written to —
  copying the `.db` out from under a running process does not.
- **Kubernetes.** The probes are the part that transfers directly:
  `/health/live` as `livenessProbe`, `/health/ready` as `readinessProbe` and
  `startupProbe`. The rest of the manifests are yours.
- **Building the images in CI.** Deliberately not in the per-PR pipeline — it
  needs a daemon and a registry, and the per-PR gate is the deterministic
  suite. `test_deployment.py` covers the settings whose failure mode is silent
  (healthcheck target, the engine matching the schema, published ports,
  profile gating, non-root user,
  the forwarded client IP), which is the part that rots between builds.
