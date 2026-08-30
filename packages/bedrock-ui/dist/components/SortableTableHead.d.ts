/**
 * @file SortableTableHead.tsx
 * @module frontend/src/components
 * @description Shared sortable column header component. Applies column-level sort colors
 * with grid-level fallback, dotted-underline tooltip, and alignment helpers.
 *
 * Sort color resolution: col.sort_asc_color ?? grid.sort_asc_color ?? null
 * (column overrides grid; grid is fallback; null = no inline style).
 */
import type { Header } from "@tanstack/react-table";
import type { GridColumnSetting } from "../hooks/useAdminPlatform";
interface SortableTableHeadProps<T> {
    header: Header<T, unknown>;
    /** Column-level config — provides per-column sort colors and tooltip. */
    colConfig?: GridColumnSetting;
    /** Grid-level ascending sort color (fallback when column has none). */
    gridSortAscColor?: string | null;
    /** Grid-level descending sort color (fallback when column has none). */
    gridSortDescColor?: string | null;
    /** Additional CSS classes applied to the TableHead element. */
    className?: string;
    /** When true, pins this header cell at left:0 for horizontal scroll freeze. */
    sticky?: boolean;
    /** Tooltip open latency (ms). Config-driven; falls back to the centralized default. */
    tooltipDelayDuration?: number;
    /** Grid identifier surfaced on structured sort-interaction logs. */
    gridId?: string;
    /** Sticky offset (px) applied via inline style when the column is pinned left. */
    pinnedOffsetLeft?: number;
    /** Sticky offset (px) applied via inline style when the column is pinned right. */
    pinnedOffsetRight?: number;
    /**
     * When set, this header participates in `@dnd-kit` column reordering under
     * the surrounding `SortableContext` (mounted by `useDraggableColumns`). A
     * grip icon appears next to the label and owns the drag listeners so
     * clicking the cell body still triggers the sort toggle unchanged.
     * Omit to opt this header out of DnD (e.g. static rank/selection cells).
     */
    dndId?: string;
}
export declare function SortableTableHead<T>(props: SortableTableHeadProps<T>): import("react").JSX.Element;
export {};
