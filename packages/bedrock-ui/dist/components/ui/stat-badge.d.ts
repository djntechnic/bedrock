/**
 * @file stat-badge.tsx
 * @module frontend/src/components/ui
 * @description Shared pill badge for compact stat deltas and status values. Maps
 * a semantic variant to the theme's CSS-variable color tokens so positive /
 * negative / warning / neutral values render consistently in both light and dark
 * themes without per-call-site color strings.
 */
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
/**
 * Renders a colored stat pill.
 *
 * @param props - See {@link StatBadgeProps}.
 * @returns The badge span styled per `variant`.
 */
export declare function StatBadge({ value, variant, className }: StatBadgeProps): import("react").JSX.Element;
export {};
