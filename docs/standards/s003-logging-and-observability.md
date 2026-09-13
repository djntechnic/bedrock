---
id: S003
title: "Logging & Observability Protocol"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s003_logging
cli_command: "python -m bedrock.tools.audit_s003_logging --root ."
---

## Purpose & Objective

`console.*` and bare `print()` output cannot be filtered, correlated, or
shipped to a log aggregator without a second pass over the codebase. A single
structured logging surface per layer — Pino on the frontend, Loguru on the
backend — means every log line already carries the shape an incident
responder needs, in every consumer, without per-app retrofitting.

## Non-Negotiable Invariants

- **Frontend**: `import { log } from "@djntechnic/bedrock-ui"`. Never
  `console.log` / `console.warn` / `console.error` / `console.debug` outside a
  declared exemption. Log calls carry structured payloads
  (`{ gridId, action, recordCount }`), never string concatenation.
- **Backend**: `from loguru import logger`. Never bare `print()`. Structured
  context goes through `logger.bind(...)` or keyword-argument message
  formatting, not string interpolation of secrets or free-form text.
- Sensitive fields (tokens, passwords, session identifiers) are redacted
  before serialization — configured once, not per call site.
- Scripts under `scripts/**` may be exempted per `bedrock.toml` — a one-off
  maintenance script printing to a human's terminal is not the same failure
  mode as a service emitting unstructured logs in production.
- Framework log ingestion (uvicorn, uvicorn.access, fastapi) is intercepted at
  a single boot-time integration point, not re-configured per route.

## Architecture & Code Contracts

**TypeScript — correct:**

```typescript
import { log } from "@djntechnic/bedrock-ui";

log.info({ gridId, columnCount: colSettings.length }, "useGridConfig: loaded");

try {
  await api.fetch(endpoint);
} catch (error) {
  log.error({ err: error, endpoint }, "API fetch failed");
}
```

**TypeScript — violation:**

```typescript
console.log("loaded grid config for " + gridId); // banned: bare console + string concat
```

**Python — correct:**

```python
from loguru import logger

logger.info("Pipeline started: {count} records", count=count)

try:
    run_pipeline()
except Exception:
    logger.exception("Pipeline context collapsed unexpectedly")
```

**Python — violation:**

```python
print(f"pipeline started: {count}")  # banned: bare print
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s003]
exempt_paths = [
  "scripts/**",
  "packages/bedrock-api/bedrock/tools/**",  # CLI audits print human-readable status to a terminal
]
```

A file under `exempt_paths` is skipped entirely by the AST/regex scan — it is
not a partial exemption, so exempted scripts still should not emit secrets to
stdout.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s003_logging --root .
```

- **Exit 0** — zero bare `console.*` in frontend source and zero bare `print`
  in backend source outside `exempt_paths`.
- **Exit 1** — a violation was found; the audit reports file, line, and the
  banned call.
- **Exit 2** — configuration error in `bedrock.toml`'s `[tool.bedrock.audit.s003]`
  section.
