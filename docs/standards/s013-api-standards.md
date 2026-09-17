---
id: S013
title: "API Standards & Admin Interactivity"
status: active
tier: platform
enforced_by: bedrock.tools.audit_api_docs
cli_command: "python -m bedrock.tools.audit_api_docs --app api.main:app"
---

# Standard S013: API Standards & Admin Interactivity

## Purpose & Objective

An API surface without strict architectural boundaries inevitably suffers from payload drift, leaky abstractions, inconsistent authentication checks, and documentation decay. When endpoints return divergent envelopes, expose foreign user data through enumeration, or fail to document parameters, client applications become brittle and development stalls.

Standard S013 establishes the non-negotiable architecture, validation, security, documentation, and operator inspection contracts for all HTTP endpoints across Bedrock and consumer applications. Every API endpoint must conform to uniform RESTful conventions, wrap responses in the canonical `ApiResponse[T]` envelope, enforce row-level existence-hiding security, be machine-documented in the OpenAPI schema, and be testable and inspectable in real-time via the application's Admin Console.

## Non-Negotiable Invariants

1. **Uniform Prefixing & Resource Naming:** All versioned HTTP endpoints must mount under `/api/v1/...`. URL paths must use lowercase kebab-case for resource collections (e.g., `/api/v1/user-preferences`, `/api/v1/collection/cards`). Verbs are prohibited in resource paths except for specialized state machine transitions or action controllers (e.g., `/api/v1/auth/change-password`, `/api/v1/transactions/{id}/complete`).
2. **Canonical Response Envelope:** All application and platform endpoints must return data encapsulated in the canonical `ApiResponse[T]` schema:
   ```json
   {
     "status": "ok",
     "data": { ... },
     "message": "Optional user-facing message",
     "errors": []
   }
   ```
3. **Strict HTTP Status Code Semantics:** Status codes must convey exact operational outcomes:
   - `200 OK`: Successful read, computation, or mutation returning a response payload.
   - `201 Created`: Successful creation of a new entity, returning the created resource.
   - `204 No Content`: Successful deletion or state change returning no payload body.
   - `400 Bad Request`: Domain guardrail violation or business rule rejection with an actionable message (e.g., attempting to sell more items than held in stock).
   - `401 Unauthorized`: Missing, expired, invalid, or revoked Bearer JWT (`WWW-Authenticate: Bearer`).
   - `403 Forbidden`: Authenticated caller lacks required role (`require_role`) or disabled module (`require_module`).
   - `404 Not Found`: Resource missing **or owned by another user** (existence-hiding invariant).
   - `409 Conflict`: Unique constraint violation, duplicate identifier, or administrative self-protection (e.g., an administrator cannot deactivate their own account or remove their own `admin` role).
   - `422 Unprocessable Entity`: Schema validation failure emitted by Pydantic.
   - `429 Too Many Requests`: Rate limit exceeded. Returns standard error envelope with `Retry-After: 60`.
4. **Row-Level Existence-Hiding:** Multi-tenant and user-owned resources (e.g. private collections, inventories, drafts, preferences) must strictly enforce owner isolation. Requesting a resource ID owned by another user must return **`404 Not Found`, never `403 Forbidden`**, ensuring foreign resource existence never leaks to probe attacks.
5. **Declarative Security Boundaries:** Security dependencies must be declared statically on route decorators using FastAPI dependencies (`require_role(...)`, `require_module(...)`, `get_current_user`). Ad hoc authorization checks (e.g. `if current_user.role == ...`) inside handler bodies are strictly prohibited (§S010).
6. **Pydantic Model Authority:** All request bodies and structured responses must be defined using Pydantic models (`BaseModel`). Raw untyped `dict` payloads without schema validation are prohibited.
7. **Mandatory Route Docstrings:** Every route handler function must include an enriched Python docstring containing:
   - A one-line summary of the operation.
   - A detailed behavioral description, business logic constraints, and query/path parameter semantics.
   - Explicit notes on permissions, error shapes, and audit logging side-effects.
8. **Zero Undocumented Routes:** 100% of `/api/v1` routes must be fully documented in the generated OpenAPI specification. A versioned route lacking a description, parameter definitions, or response models is a blocking defect.
9. **Admin Portal Interactivity & Inspection:** Every consumer application must expose an interactive Admin Health portal at `/admin?tab=health` providing two synchronized surfaces:
   - **API Routes Explorer (`GET /api/v1/admin/api-health`):** Aggregates live operational telemetry (Total Hits, Hits 24h, Errors, Error Rate, Undocumented count), filterable search with "Undocumented only" toggle, and collapsible route cards detailing method, path, docstrings, query/path parameters, request body schemas, response schemas, and tags.
   - **Interactive Spec Panel (`ApiSpecPanel.tsx`):** Embeds a theme-matched Swagger UI instance pointed at `/openapi.json` supporting live in-browser execution with automatic admin Bearer token injection, along with one-click export anchors for the raw OpenAPI JSON specification and committed Postman collection assets.

## Architecture & Code Contracts

### Python — Route Definition & Envelope Contract:
```python
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from bedrock.schemas.base import ApiResponse
from bedrock.dependencies import require_role
from bedrock.services import user_service as _us

router = APIRouter(prefix="/api/v1/collection", tags=["collection"])

class CardCreatePayload(BaseModel):
    card_name: str = Field(..., min_length=1, max_length=200, description="Canonical player or subject card name")
    card_number: str = Field(..., max_length=50, description="Set card checklist identifier")
    condition_score: float | None = Field(default=None, ge=1.0, le=10.0, description="Numerical condition grade (1-10)")

class CardResponse(BaseModel):
    collection_card_id: int
    card_name: str
    card_number: str
    owner_id: int

@router.post(
    "/cards",
    response_model=ApiResponse[CardResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create a new collection card",
    description="Registers a new card entry into the authenticated caller's collection. The owner_id is resolved directly from caller credentials.",
)
def create_card(
    payload: CardCreatePayload,
    current_user: _us.UserRecord = Depends(require_role("member")),
) -> ApiResponse[CardResponse]:
    card = _card_service.create_user_card(
        owner_id=current_user.user_id,
        card_name=payload.card_name,
        card_number=payload.card_number,
    )
    return ApiResponse(status="ok", data=CardResponse.model_validate(card))
```

### Python — Row-Level Existence Hiding:
```python
@router.get(
    "/cards/{card_id}",
    response_model=ApiResponse[CardResponse],
    summary="Retrieve single card by identifier",
    description="Fetches card details. Returns 404 if the card does not exist OR if it belongs to another user.",
)
def get_card(
    card_id: int,
    current_user: _us.UserRecord = Depends(require_role("member")),
) -> ApiResponse[CardResponse]:
    card = _card_service.get_user_card(card_id=card_id, owner_id=current_user.user_id)
    if card is None:
        # 404 existence hiding: never emit 403 to prevent probing ID sequences
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    return ApiResponse(status="ok", data=CardResponse.model_validate(card))
```

### TypeScript/React — Admin Spec Panel Consumption:
```tsx
import { lazy, Suspense } from "react";
import { Download, FileJson } from "lucide-react";
import "swagger-ui-react/swagger-ui.css";

const SwaggerUI = lazy(() => import("swagger-ui-react"));

export function ApiSpecPanel({ specUrl, postmanUrl }: { specUrl: string; postmanUrl?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
        <a href={specUrl} download="openapi.json" className="inline-flex items-center gap-1.5 text-xs font-medium">
          <FileJson className="h-3.5 w-3.5" /> Export OpenAPI Spec
        </a>
      </div>
      <div className="swagger-ui-theme rounded-lg border border-border bg-background">
        <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading OpenAPI Spec…</p>}>
          <SwaggerUI url={specUrl} docExpansion="none" />
        </Suspense>
      </div>
    </div>
  );
}
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.api_docs]
exempt_paths = [
  "/health",          # Bare process probe outside /api/v1
  "/health/live",     # Kubernetes liveness probe
  "/health/ready",    # Load balancer readiness probe
]
```

Any endpoint legitimately mounted outside `/api/v1` (such as unversioned infrastructure probes) must be declared in `bedrock.toml` under `[tool.bedrock.audit.api_docs].exempt_paths`. Unregistered unversioned endpoints fail review automatically.

## Verification & Enforcement Gate

1. **Static API Documentation Reconciliation Gate:**
   ```bash
   python -m bedrock.tools.audit_api_docs --app api.main:app --doc docs/guide/api_reference.md
   ```
   - **Exit 0:** All shipped `/api/v1` routes match the documentation in `api_reference.md` 1:1.
   - **Exit 1:** Unshipped routes documented, or shipped routes missing from reference documentation.
   - **Exit 2:** Environment error, missing document, or FastAPI app import failure.

2. **Automated Zero-Undocumented Route Unit Test:**
   ```python
   @pytest.mark.asyncio
   async def test_no_versioned_route_is_undocumented():
       """Asserts that 100% of /api/v1 routes in /api-health are documented."""
       async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
           resp = await client.get("/api/v1/admin/api-health")
       assert resp.status_code == 200
       routes = resp.json()["data"]
       undocumented = [f"{r['method']} {r['path']}" for r in routes if not r["documented"]]
       assert undocumented == [], f"Undocumented routes detected: {undocumented}"
   ```
