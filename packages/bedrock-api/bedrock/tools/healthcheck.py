"""
Module:  healthcheck.py
Layer:   bedrock/tools
Desc:    Container healthcheck probe. Exits 0 when the API is ready, 1 when it
         is not.

         Exists because the obvious `HEALTHCHECK CMD curl -f .../health/ready`
         does not work on a slim Python image: there is no curl, and installing
         one adds a package and a CVE surface to every deploy for the sake of a
         three-line request. This uses `urllib` from the standard library,
         which is already in the image because the application is Python.

         Kept dependency-free on purpose — it must run when the application
         itself cannot import, which is one of the states it is meant to
         detect.

Usage:   bedrock-healthcheck [--url URL] [--timeout SECONDS]
         Defaults to http://127.0.0.1:$PORT/api/v1/health/ready.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_PATH = "/api/v1/health/ready"
DEFAULT_TIMEOUT = 5.0


def default_url() -> str:
    """Probe the loopback interface, not the published hostname.

    A healthcheck runs *inside* the container, so it must not depend on DNS,
    the reverse proxy, or the ingress being up — otherwise it reports the
    application unhealthy when the load balancer is the thing that broke.
    """
    port = os.environ.get("PORT", "8000")
    return f"http://127.0.0.1:{port}{DEFAULT_PATH}"


def probe(url: str, timeout: float) -> tuple[bool, str]:
    """Return (ready, detail). Never raises."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:  # noqa: S310
            body = resp.read(4096).decode("utf-8", "replace")
            if resp.status != 200:
                return False, f"HTTP {resp.status}: {body[:200]}"
            return True, body[:200]
    except urllib.error.HTTPError as exc:
        # The 503 path. Read the body so the failure says *why* in
        # `docker inspect`, which is otherwise a blank "unhealthy".
        detail = ""
        try:
            payload = json.loads(exc.read().decode("utf-8", "replace"))
            detail = str(payload.get("message") or "")
        except Exception:  # noqa: BLE001
            pass
        return False, f"HTTP {exc.code}{': ' + detail if detail else ''}"
    except Exception as exc:  # noqa: BLE001 — connection refused, DNS, timeout.
        return False, f"{type(exc).__name__}: {exc}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="bedrock container healthcheck")
    parser.add_argument("--url", default=None, help="readiness URL to probe")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT,
                        help="seconds to wait for a response")
    args = parser.parse_args(argv)

    url = args.url or default_url()
    ready, detail = probe(url, args.timeout)
    if ready:
        return 0
    # stderr, so it lands in the healthcheck output Docker records.
    print(f"not ready: {url} -> {detail}", file=sys.stderr)
    return 1


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
