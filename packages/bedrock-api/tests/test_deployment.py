"""
Module:  test_deployment.py
Layer:   bedrock-api/tests
Desc:    Invariants of the deployment manifests (plan F2).

         These are not "does it build" tests — that needs a Docker daemon and
         belongs in a scheduled job, not the per-PR gate. They cover the
         narrower and more valuable thing: the handful of settings whose
         failure mode is *silent*. A healthcheck pointed at the wrong endpoint,
         a `depends_on` without a condition, a published Postgres port — none
         of those break the build, none fail at startup, and all of them are
         only discovered in production.
"""
from __future__ import annotations

import pathlib

import pytest

yaml = pytest.importorskip("yaml")

REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
DEPLOY = REPO_ROOT / "deploy"
COMPOSE = DEPLOY / "docker-compose.yml"
DOCKERFILE_API = DEPLOY / "Dockerfile.api"
DOCKERFILE_WEB = DEPLOY / "Dockerfile.web"
NGINX = DEPLOY / "nginx.conf"
ENV_EXAMPLE = DEPLOY / ".env.example"


@pytest.fixture(scope="module")
def compose() -> dict:
    return yaml.safe_load(COMPOSE.read_text(encoding="utf-8"))


# ── The files exist and parse ────────────────────────────────────────────────

@pytest.mark.parametrize("path", [
    COMPOSE, DOCKERFILE_API, DOCKERFILE_WEB, NGINX, ENV_EXAMPLE,
])
def test_manifest_exists(path: pathlib.Path):
    assert path.is_file(), f"{path} is missing"


def test_compose_declares_the_three_services(compose):
    assert set(compose["services"]) == {"db", "api", "web"}


# ── Healthchecks ─────────────────────────────────────────────────────────────

def test_api_healthcheck_uses_the_readiness_endpoint():
    """`bedrock-healthcheck` probes /health/ready, which answers 503 when the
    database is unreachable. Pointing it at /health instead would mark a
    container healthy while every request 500s — the whole reason the
    readiness endpoint exists."""
    text = DOCKERFILE_API.read_text(encoding="utf-8")
    assert "HEALTHCHECK" in text
    assert "bedrock-healthcheck" in text


def test_api_healthcheck_allows_time_for_migrations():
    """A fresh database applies the whole migration chain before the app
    serves. Without a start-period the container is killed mid-migration and
    restarts into a half-applied schema."""
    text = DOCKERFILE_API.read_text(encoding="utf-8")
    line = next(ln for ln in text.splitlines() if ln.startswith("HEALTHCHECK"))
    assert "--start-period=" in line
    seconds = int(line.split("--start-period=")[1].split("s")[0])
    assert seconds >= 30, "too short for a first-boot migration run"


def test_db_healthcheck_names_the_user_and_database(compose):
    """Bare `pg_isready` probes a database named after the OS user, which does
    not exist here — the check would fail forever and the API, gated on
    service_healthy, would never start."""
    test = " ".join(compose["services"]["db"]["healthcheck"]["test"])
    assert "-U" in test and "-d" in test


def test_api_waits_for_the_database_to_be_healthy_not_merely_started(compose):
    """The API applies migrations at boot. Against a Postgres still
    initialising, that fails and takes the container with it."""
    assert compose["services"]["api"]["depends_on"]["db"]["condition"] == "service_healthy"


# ── Security posture ─────────────────────────────────────────────────────────

def test_postgres_is_not_published_to_the_host(compose):
    """An exposed Postgres carrying a development password is the most common
    way one of these stacks is compromised."""
    assert "ports" not in compose["services"]["db"], (
        "the db service must not publish a port by default"
    )


def test_postgres_password_has_no_default(compose):
    """`:?` makes compose refuse to start rather than silently booting the
    database with a blank or guessable password."""
    env = compose["services"]["db"]["environment"]
    assert str(env["POSTGRES_PASSWORD"]).startswith("${POSTGRES_PASSWORD:?")


def test_the_api_image_does_not_run_as_root():
    text = DOCKERFILE_API.read_text(encoding="utf-8")
    assert "USER bedrock" in text
    # After the last COPY/RUN, or the build steps fail on permissions.
    assert text.index("USER bedrock") > text.index("RUN mkdir -p /app/data")


def test_the_runtime_stage_carries_no_compiler():
    """The builder stage installs build-essential to compile psycopg2 and
    bcrypt wheels; the runtime stage must not, or every deploy ships a
    toolchain and its CVE surface."""
    text = DOCKERFILE_API.read_text(encoding="utf-8")
    runtime = text[text.index("FROM python:3.11-slim AS runtime"):]
    assert "build-essential" not in runtime
    assert "libpq5" in runtime, "psycopg2 needs the client library at runtime"


# ── Wiring that is invisible when wrong ──────────────────────────────────────

def test_app_root_is_set_explicitly_in_the_image():
    """bedrock resolves .env, data/ and migrations/ from BEDROCK_APP_ROOT,
    falling back to the working directory. Same value here — until something
    starts the process from elsewhere, and then the app silently finds no
    migrations."""
    assert "BEDROCK_APP_ROOT=/app" in DOCKERFILE_API.read_text(encoding="utf-8")


def test_nginx_forwards_the_client_ip():
    """bedrock's rate limiter and audit log read X-Forwarded-For. Without it
    every request appears to come from the proxy: one visitor exhausting a
    limit locks out everyone, and the security log records the container's
    IP for every event."""
    text = NGINX.read_text(encoding="utf-8")
    assert "X-Forwarded-For" in text
    assert "X-Real-IP" in text


def test_nginx_serves_the_spa_history_fallback():
    """Every deep link is a client-side route — including the password-reset
    link bedrock emails. Without the fallback they all 404."""
    assert "/index.html" in NGINX.read_text(encoding="utf-8")


def test_nginx_does_not_cache_the_entry_document():
    """index.html names the current asset hashes. A cached copy pins a
    returning visitor to a deployment whose assets are already deleted."""
    text = NGINX.read_text(encoding="utf-8")
    entry = text[text.index("location = /index.html"):]
    assert "no-store" in entry.split("}")[0]


def test_the_api_proxy_targets_the_compose_service_name(compose):
    assert "proxy_pass http://api:8000" in NGINX.read_text(encoding="utf-8")
    assert "api" in compose["services"]


# ── The env contract ─────────────────────────────────────────────────────────

def test_env_example_documents_every_variable_config_reads():
    """A setting bedrock reads and the example does not mention is a setting
    an operator discovers by having it not work."""
    from bedrock.core import config as config_module

    source = pathlib.Path(config_module.__file__).read_text(encoding="utf-8")
    read_names = set()
    for line in source.splitlines():
        if "os.environ.get(" in line:
            read_names.add(line.split('os.environ.get("')[1].split('"')[0])

    documented = ENV_EXAMPLE.read_text(encoding="utf-8")
    missing = sorted(n for n in read_names if n not in documented)
    assert missing == [], f"undocumented environment variables: {missing}"


def test_env_example_ships_no_secret_values():
    """It is a template that gets copied. A filled-in value here becomes a
    real deployment's real secret."""
    for line in ENV_EXAMPLE.read_text(encoding="utf-8").splitlines():
        if line.startswith(("JWT_SECRET", "SMTP_PASSWORD", "POSTGRES_PASSWORD",
                            "CLOUDFLARE_API_TOKEN")):
            assert line.split("=", 1)[1] == "", f"{line!r} carries a value"
