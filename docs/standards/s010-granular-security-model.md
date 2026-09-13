---
id: S010
title: "Granular Security Model"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s010_security
cli_command: "python -m bedrock.tools.audit_s010_security --root ."
---

# Standard S010: Granular Security Model

## Purpose & Objective

A route protected only by "is this user logged in" cannot express "this user
is logged in but not allowed to touch this resource" — the two collapse into
the same allow/deny bit and every finer-grained authorization decision ends
up hand-rolled per route, inconsistently, by whoever wrote it. Bedrock's
security context resolves permission at the route boundary from a declared,
inspectable model, so authorization logic is reviewable in one place instead
of scattered as ad hoc `if user.role == ...` checks.

## Non-Negotiable Invariants

- Every route that mutates or returns non-public data declares its required
  permission through the platform's security-context mechanism — never a
  bare `if current_user` check standing in for an authorization decision.
- Permission checks resolve at the route boundary, before handler logic runs.
  A handler that fetches data first and checks permission after the fact
  leaks state (timing, error shape, partial side effects) regardless of the
  final response.
- Route permissions are declared, not computed ad hoc per request — the set
  of roles/scopes a route accepts is inspectable statically, without tracing
  runtime branches.
- A permission-denied request returns a consistent, minimal-information
  response (no distinction between "resource does not exist" and "resource
  exists but you may not see it" unless the route's contract explicitly
  requires that distinction).
- Session and token validation happens once, in shared middleware — no route
  handler re-implements its own token-parsing or session-lookup logic.
- Elevated operations (role changes, destructive admin actions) require a
  freshly-verified session, not a session token that may be hours old — a
  stale-session bypass on a high-privilege route is a Class B defect
  (§S006), not a minor regression.

## Architecture & Code Contracts

**Python — correct, declared permission at the route boundary:**

```python
from bedrock.core.security import require_permission

@router.delete("/admin/users/{user_id}")
@require_permission("users:delete")
def delete_user(user_id: int, ctx: SecurityContext = Depends(get_security_context)):
    return user_service.delete(user_id)
```

**Python — violation, ad hoc check inside the handler:**

```python
@router.delete("/admin/users/{user_id}")
def delete_user(user_id: int, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":   # bypasses the declared security-context model
        raise HTTPException(403)
    return user_service.delete(user_id)
```

**Python — audit check shape:**

```python
def audit_route_has_permission(route: RouteInfo) -> bool:
    if route.method in {"GET"} and route.is_public:
        return True
    return route.has_decorator("require_permission")
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s010]
exempt_paths = [
  "packages/bedrock-api/bedrock/routes/health.py",   # liveness/readiness probes, no user data
  "packages/bedrock-api/bedrock/routes/auth.py",     # pre-authentication routes by definition
]
```

A route legitimately public (no authentication required) is exempted by a
declared `is_public=True` route attribute, inspected by the audit — not by
omitting the permission decorator silently.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s010_security --root .
```

- **Exit 0** — every non-public, non-exempt route declares a permission
  through the security-context mechanism; no ad hoc role check found inside
  a handler body.
- **Exit 1** — an undeclared or ad hoc permission check was found; the audit
  reports the route and file/line.
- **Exit 2** — configuration error in `bedrock.toml`.
