/**
 * @file stat-badge.tsx
 * @module frontend/src/components/ui
 * @description Shared pill badge for compact stat deltas and status values. Maps
 * a semantic variant to the theme's CSS-variable color tokens so positive /
 * negative / warning / neutral values render consistently in both light and dark
 * themes without per-call-site color strings.
 */

import { cn } from "../../lib/utils";

/** Semantic color variant for a {@link StatBadge}. */
export type StatBadgeVariant = "positive" | "negative" | "warning" | "neutral";

/** Props for {@link StatBadge}. */
interface StatBadgeProps {
  /** Display text (e.g. a formatted delta like `"+0.045"`). */
  value: string;
  /** Semantic variant driving the badge's color tokens. */
  variant: StatBadgeVariant;
  /** Extra classes merged onto the badge span. */
  className?: string;
}

const VARIANT_STYLE: Record<StatBadgeVariant, React.CSSProperties> = {
  positive: { backgroundColor: "hsl(var(--positive) / 0.15)", color: "hsl(var(--positive))" },
  negative: { backgroundColor: "hsl(var(--negative) / 0.15)", color: "hsl(var(--negative))" },
  warning:  { backgroundColor: "hsl(var(--warning)  / 0.15)", color: "hsl(var(--warning))"  },
  neutral:  { backgroundColor: "hsl(var(--neutral)  / 0.15)", color: "hsl(var(--neutral))"  },
};

/**
 * Renders a colored stat pill.
 *
 * @param props - See {@link StatBadgeProps}.
 * @returns The badge span styled per `variant`.
 */
export function StatBadge({ value, variant, className }: StatBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5",
        "text-[11px] font-semibold tabular-nums leading-none whitespace-nowrap",
        className,
      )}
      style={VARIANT_STYLE[variant]}
    >
      {value}
    </span>
  );
}
