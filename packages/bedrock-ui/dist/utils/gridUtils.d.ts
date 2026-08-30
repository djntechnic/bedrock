/**
 * @file gridUtils.tsx
 * @module frontend/src/utils
 * @description Shared grid utilities: column factories, aggregation, gradient coloring,
 * and sizing helpers used across all TanStack Table grid components.
 */
import type { CSSProperties } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { GridColumnSetting } from "../hooks/useAdminPlatform";
/**
 * Computes an interpolated inline background style for a gradient cell.
 *
 * t = (value - colMin) / (colMax - colMin)
 * t=0 → fromColor, t=1 → toColor (linear RGB).
 *
 * Returns an empty object (no style) when:
 *  - colMin === colMax (prevents division by zero)
 *  - either color string is not a parseable hex color
 */
export declare function getGradientCellStyle(value: number, colMin: number, colMax: number, fromColor: string, toColor: string): CSSProperties;
/**
 * Computes the numeric min and max for a column across the provided rows.
 * Uses the current filtered/visible row set so gradients reflect the active view.
 * Returns null when no numeric values are present in the column.
 */
export declare function computeColumnMinMax(rows: Record<string, unknown>[], columnId: string): {
    min: number;
    max: number;
} | null;
/**
 * Returns TanStack Table size props derived from column config,
 * using gridMinColumnWidth as the floor for minSize.
 */
export declare function applyColumnSizing(col: GridColumnSetting, gridMinColumnWidth?: number): {
    size?: number;
    minSize: number;
    maxSize?: number;
};
/**
 * Adds a rank display column to a column list when showRanking is true.
 * The rank column shows the row's 1-based position in the current sorted model.
 * Displays rank icons (ranks 1-3) only when showRankIcon is true.
 * Position defaults to "end" (appended after data columns).
 */
export declare function prependRankColumn<T>(cols: ColumnDef<T>[], showRanking: boolean, colHelper: {
    display: (def: any) => ColumnDef<T>;
}, showRankIcon?: boolean, position?: "start" | "end"): ColumnDef<T>[];
/** Cosmetics and limits for {@link prependSelectionColumn}. */
export interface SelectionColumnOptions {
    /**
     * Cap on how many rows may be checked at once. Undefined means no cap.
     *
     * This used to be a hardcoded 3 — a player-comparison rule that had no
     * business applying to every grid on the platform, and that silently made
     * a bulk operation over a real selection impossible. Grids that want the
     * cap now ask for it.
     */
    maxSelected?: number;
    /** Header text. */
    headerLabel?: string;
    /** Header tooltip. */
    headerTitle?: string;
    /** Checkbox tooltip while it is still selectable. */
    cellTitle?: string;
    /** Checkbox tooltip once `maxSelected` is reached. */
    cellTitleAtLimit?: string;
}
/**
 * Adds a selection checkbox column when allowSelection is true.
 *
 * @param cols - The data columns.
 * @param allowSelection - False returns `cols` untouched.
 * @param selectedIds - Currently checked row ids.
 * @param onSelectionChange - Receives the next id list.
 * @param idField - Which row property holds the id (default: "mlb_id").
 * @param position - "start" puts the checkbox before the data columns,
 *   "end" (the default) after them.
 * @param options - See {@link SelectionColumnOptions}.
 * @returns The column list with the checkbox column inserted.
 */
export declare function prependSelectionColumn<T extends Record<string, unknown>>(cols: ColumnDef<T>[], allowSelection: boolean, selectedIds: number[], onSelectionChange: (ids: number[]) => void, idField?: keyof T, position?: "start" | "end", options?: SelectionColumnOptions): ColumnDef<T>[];
/** Aggregation function names supported by buildAggFooterRow. */
export type AggFn = "sum" | "avg" | "min" | "max" | "count";
/**
 * Computes the aggregate display value for a single column.
 * Returns null when rows is empty or the aggregate function is unsupported.
 */
export declare function computeAggValue(rows: Record<string, unknown>[], columnId: string, aggFn: AggFn): number | null;
/**
 * Formats an aggregate numeric value using the column's format_string.
 */
export declare function formatAggValue(value: number | null, formatString?: string | null): string;
/**
 * Checks whether any visible column has an aggregate function configured.
 * Used to decide if a footer row should be rendered at all.
 */
export declare function hasAggregates(colConfigs: Record<string, GridColumnSetting>): boolean;
