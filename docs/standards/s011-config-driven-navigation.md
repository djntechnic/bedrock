---
id: S011
title: "Config-Driven Navigation"
status: active
tier: platform
enforced_by: bedrock.tools.audit_s011_navigation
cli_command: "python -m bedrock.tools.audit_s011_navigation --root ."
---

# Standard S011: Config-Driven Navigation

## Purpose & Objective

A hardcoded `<Link>` tree in a sidebar or header means adding a nav item is a
code change instead of a config edit, and means the active-route highlight,
permission gating, and responsive collapse behavior all have to be
re-implemented per consumer. Routing all navigation through bedrock's
`navRegistry` and a config-driven hierarchy keeps the sidebar, breadcrumb,
and command palette derived from one source instead of three.

## Non-Negotiable Invariants

- Navigation structure is declared through the platform's `navRegistry` /
  `navConfig` — never a hardcoded `<Link>` tree or raw `<a>` list in
  `AppSidebar`, `AppFooter`, `PageHeader`, or `Breadcrumb`.
- Active-route resolution is dynamic: the currently active nav item is
  derived by matching the router's live location against the registry, never
  hardcoded as a per-page prop.
- Nav items support parent-child nesting, `sortOrder`, and visual overrides
  (`labelOverride`, `iconOverride`, `tooltipOverride`, `isHidden`) merged from
  defaults at render time — a hidden item is suppressed regardless of the
  viewing user's permissions.
- Route access is security-driven: an item disabled or hidden by the
  consumer's permission model renders `<PermissionDenied>` in place when
  navigated to directly, without breaking page layout.
- The sidebar is responsive by contract: it collapses to an overlay below the
  documented breakpoint and exposes the same nav tree through a mobile-first
  affordance — never a separate, independently maintained mobile nav config.
- `CommandPalette` entries are sourced from the same `navRegistry`, not a
  parallel hardcoded command list.

## Architecture & Code Contracts

**TypeScript — correct:**

```tsx
import { navRegistry } from "@djntechnic/bedrock-ui";

export function AppSidebar() {
  const items = navRegistry.getVisibleItems(currentUser);
  return (
    <nav>
      {items.map((item) => (
        <NavLink key={item.id} to={item.route} active={item.isActive}>
          {item.labelOverride ?? item.label}
        </NavLink>
      ))}
    </nav>
  );
}
```

**Violation:**

```tsx
// Hardcoded nav tree — bypasses navRegistry entirely.
<nav>
  <a href="/dashboard">Dashboard</a>
  <a href="/reports">Reports</a>
</nav>
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s011]
exempt_paths = [
  "packages/bedrock-ui/src/components/AppSidebar.tsx",  # the navRegistry consumer itself
  "packages/bedrock-ui/src/components/CommandPalette.tsx",
]
```

A consumer's marketing/landing pages outside the authenticated app shell are
exempt by default — this standard governs the authenticated navigation
surface, not public-facing static links.

## Verification & Enforcement Gate

```bash
python -m bedrock.tools.audit_s011_navigation --root .
```

- **Exit 0** — no hardcoded nav tree found outside `exempt_paths`; every
  `AppSidebar` / `Breadcrumb` / `CommandPalette` render path sources from
  `navRegistry`.
- **Exit 1** — a hardcoded `<Link>`/`<a>` tree was found in a governed
  component; the audit reports the file and line.
- **Exit 2** — configuration error in `bedrock.toml`.
