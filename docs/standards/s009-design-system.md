---
id: S009
title: "Design System"
status: active
tier: platform
enforced_by: bedrock.tools.s009_audit_design_tokens
cli_command: "python scripts/audit/s009_audit_design_tokens.py --root ."
---

# Standard S009: Design System

## Purpose & Objective

A literal hex value inlined in a component works until the next theme
switch, at which point it is the one element that doesn't move. Every color
resolving through a semantic token means a consumer can ship new themes (or
let users create custom ones) without hunting component files for hardcoded
values, and `packages/bedrock-ui/styles/tokens.css` stays the single source
of truth every built-in and custom theme derives from.

## Non-Negotiable Invariants

- No literal hex/rgb/hsl value in `.tsx` or `.css` outside `tokens.css`
  itself. Every color resolves through a token
  (`hsl(var(--token))`, a Tailwind color utility backed by `@theme`, or a
  computed brand accent derived from token-aware contrast logic).
- A new token is added to `styles/tokens.css` **before** it is consumed
  anywhere in code — token-first, not retrofitted.
- A new color token propagates to every surface a token must reach: the root
  token file, every built-in theme's value set, the derivation path for
  newly created custom themes, and a migration path for existing
  custom themes with a frozen snapshot predating the token.
- Grid-bearing components resolve color through `config.*` (§S002 —
  `sortAscColor`, `gradient_from_color`, etc.), never a token directly. An
  admin-configured color may itself be *set* to a token's resolved value, but
  the component reads `config.*`.
- Structural tokens (spacing, breakpoints, elevation, z-index, motion timing)
  are defined once, theme-invariant, and never duplicated per theme.
- Every motion addition respects `prefers-reduced-motion` — drop the
  animation, keep the end-state as a static style. When the reduced-motion
  gate must be assertable in a component test rather than only visually
  verified, it is applied in application code (conditionally adding the
  animating class), not solely inside a CSS `@media` block.
- Semantic color roles are named for their meaning, not their hue —
  `primary`, `warning`, `destructive`, `neutral` (and the domain's own
  additions in the same style) — never `orange`, `red`, `gray`. A bare
  Tailwind color-shade utility (`bg-orange-500`, `text-red-600`) is banned
  outside `tokens.css` itself for the same reason a literal hex value is:
  both hardcode a hue that a token was supposed to abstract away.
- A palette registers with the theme provider as a complete, named set —
  partial palettes that leave some semantic roles unresolved and silently
  falling back to another theme's values are a defect, not an acceptable
  gap.

## Structural Token Categories

Every theme-invariant structural scale is defined exactly once and reused by
every theme:

- **Spacing** — a rounded step scale (e.g. `--space-xs` through
  `--space-2xl`), consumed via arbitrary-value syntax if not Tailwind's own
  namespace.
- **Breakpoints** — overrides declared once in the design token layer, not
  re-guessed per component with an inline pixel value.
- **Elevation** — a small ordered set of shadow tokens (flush through
  deepest-floating), theme-aware via `hsl(var(--foreground) / alpha)` so
  shadow tint follows the active theme instead of a fixed black.
- **Z-index** — a named, ordered stacking scale (base, dropdown, sticky,
  overlay, modal, popover, toast, tooltip) so two components never silently
  collide on an ad hoc magic number.

## Architecture & Code Contracts

**CSS — correct:**

```css
:root {
  --brand-accent: 38 92% 55%;
}
.dark {
  --brand-accent: 38 92% 62%;
}
```

```tsx
<div className="bg-brand-accent text-foreground" />
```

**Violation:**

```tsx
<div style={{ backgroundColor: "#f59e0b" }} />  // literal hex, bypasses the token
```

**TypeScript — grid color resolution, correct (config wins over a bare token):**

```tsx
const sortColor = column.sortAscColor ?? config.sortAscColor ?? null;
```

## Exceptions & Audit Exemptions

```toml
[tool.bedrock.audit.s009]
exempt_paths = [
  "packages/bedrock-ui/src/context/ThemeContext.tsx",  # BUILT_IN_THEMES raw hex is the source tokens derive from
]
exempt_literals = [
  "#1e293b",  # HIGH_CONTRAST_FALLBACK — deliberate theme-agnostic fallback, locked decision
]
```

Every `exempt_literals` entry must be paired with a comment at its use site
explaining why it is exempt — an undocumented literal in an exempted file
still fails review even though the audit does not flag it mechanically.

## Verification & Enforcement Gate

```bash
python scripts/audit/s009_audit_design_tokens.py --root .
```

- **Exit 0** — no literal hex/rgb/hsl outside `exempt_paths`/`exempt_literals`,
  no grid component reading a token directly instead of `config.*`.
- **Exit 1** — a violation was found; the audit reports the file, line, and
  literal value.
- **Exit 2** — configuration error in `bedrock.toml`.
