/**
 * @file gridUtils.tsx
 * @module frontend/src/utils
 * @description Shared grid utilities: column factories, aggregation, gradient coloring,
 * and sizing helpers used across all TanStack Table grid components.
 */

import type { CSSProperties } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { GridColumnSetting } from "../hooks/useAdminPlatform";
import { getRankIcon } from "./rankStyle";

// ─── Gradient coloring ─────────────────────────────────────────────────────────

/**
 * Parses a CSS hex color string (#rgb or #rrggbb) to RGB components.
 * Returns null if the string is not a recognizable hex format.
 */
function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

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
export function getGradientCellStyle(
  value: number,
  colMin: number,
  colMax: number,
  fromColor: string,
  toColor: string,
): CSSProperties {
  if (colMin === colMax) return {};
  const from = parseHexColor(fromColor);
  const to = parseHexColor(toColor);
  if (!from || !to) return {};
  const t = Math.max(0, Math.min(1, (value - colMin) / (colMax - colMin)));
  const r = Math.round(from.r + t * (to.r - from.r));
  const g = Math.round(from.g + t * (to.g - from.g));
  const b = Math.round(from.b + t * (to.b - from.b));
  return { backgroundColor: `rgb(${r},${g},${b})` };
}

/**
 * Computes the numeric min and max for a column across the provided rows.
 * Uses the current filtered/visible row set so gradients reflect the active view.
 * Returns null when no numeric values are present in the column.
 */
export function computeColumnMinMax(
  rows: Record<string, unknown>[],
  columnId: string,
): { min: number; max: number } | null {
  const vals = rows
    .map((r) => r[columnId])
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

// ─── Column sizing ──────────────────────────────────────────────────────────────

/**
 * Returns TanStack Table size props derived from column config,
 * using gridMinColumnWidth as the floor for minSize.
 */
export function applyColumnSizing(
  col: GridColumnSetting,
  gridMinColumnWidth = 60,
): { size?: number; minSize: number; maxSize?: number } {
  return {
    size: col.width ?? undefined,
    minSize: Math.max(col.min_width || 0, gridMinColumnWidth),
    maxSize: col.max_width ?? undefined,
  };
}

// ─── Rank column ───────────────────────────────────────────────────────────────

/**
 * Adds a rank display column to a column list when showRanking is true.
 * The rank column shows the row's 1-based position in the current sorted model.
 * Displays medals (ranks 1-3) only when showMedals is true.
 * Position defaults to "end" (appended after data columns).
 */
export function prependRankColumn<T>(
  cols: ColumnDef<T>[],
  showRanking: boolean,
  colHelper: { display: (def: any) => ColumnDef<T> },
  showMedals: boolean = false,
  position: "start" | "end" = "end",
): ColumnDef<T>[] {
  if (!showRanking) return cols;

  const rankCell = (info: any) => {
    const rank = info.table.getRowModel().rows.findIndex((r: any) => r.id === info.row.id) + 1;
    const icon = showMedals ? getRankIcon(rank) : null;
    return (
      <span className="flex items-center gap-1 text-muted-foreground tabular-nums">
        {icon}
        {rank}
      </span>
    );
  };

  const existingIdx = cols.findIndex((c) => (c as any).id === "ranking");
  if (existingIdx !== -1) {
    const existing = cols[existingIdx];
    const updated: ColumnDef<T> = {
      ...existing,
      enableSorting: false,
      cell: rankCell,
    };
    const nextCols = [...cols];
    nextCols[existingIdx] = updated;
    return nextCols;
  }

  const rankCol = colHelper.display({
    id: "ranking",
    header: () => <span className="text-muted-foreground">#</span>,
    size: 50,
    enableSorting: false,
    enableHiding: false,
    cell: rankCell,
  });
  return position === "start" ? [rankCol, ...cols] : [...cols, rankCol];
}

// ─── Selection column ───────────────────────────────────────────────────────────

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
export function prependSelectionColumn<T extends Record<string, unknown>>(
  cols: ColumnDef<T>[],
  allowSelection: boolean,
  selectedIds: number[],
  onSelectionChange: (ids: number[]) => void,
  idField: keyof T = "mlb_id" as keyof T,
  position: "start" | "end" = "end",
  options: SelectionColumnOptions = {},
): ColumnDef<T>[] {
  if (!allowSelection) return cols;

  const {
    maxSelected,
    headerLabel = "Sel",
    headerTitle = "Select rows",
    cellTitle = "Select row",
    cellTitleAtLimit = "Selection limit reached",
  } = options;

  const checkCell = ({ row }: any) => {
    const id = row.original[idField] as number | undefined;
    // `id == null`, not `!id`: 0 is a legitimate row key, and dropping the
    // checkbox for it makes exactly one row unselectable for no reason.
    if (id == null) return null;
    const checked = selectedIds.includes(id);
    const disabled =
      !checked && maxSelected !== undefined && selectedIds.length >= maxSelected;
    return (
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        title={disabled ? cellTitleAtLimit : cellTitle}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          e.stopPropagation();
          if (e.target.checked) {
            onSelectionChange([...selectedIds, id]);
          } else {
            onSelectionChange(selectedIds.filter((x) => x !== id));
          }
        }}
        className="h-4 w-4 cursor-pointer disabled:opacity-30"
      />
    );
  };

  const existingIdx = cols.findIndex((c) => (c as any).id === "_compare");
  if (existingIdx !== -1) {
    const existing = cols[existingIdx];
    const updated: ColumnDef<T> = {
      ...existing,
      enableSorting: false,
      cell: checkCell,
    };
    const nextCols = [...cols];
    nextCols[existingIdx] = updated;
    return nextCols;
  }

  const checkCol: ColumnDef<T> = {
    id: "_compare",
    header: () => (
      <span
        className="text-xs font-medium text-muted-foreground"
        title={headerTitle}
      >
        {headerLabel}
      </span>
    ),
    size: 36,
    enableSorting: false,
    enableHiding: false,
    cell: checkCell,
  };
  return position === "start" ? [checkCol, ...cols] : [...cols, checkCol];
}

// ─── Footer aggregate row ───────────────────────────────────────────────────────

/** Aggregation function names supported by buildAggFooterRow. */
export type AggFn = "sum" | "avg" | "min" | "max" | "count";

/**
 * Computes the aggregate display value for a single column.
 * Returns null when rows is empty or the aggregate function is unsupported.
 */
export function computeAggValue(
  rows: Record<string, unknown>[],
  columnId: string,
  aggFn: AggFn,
): number | null {
  const vals = rows
    .map((r) => r[columnId])
    .filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  switch (aggFn) {
    case "sum":   return vals.reduce((a, b) => a + b, 0);
    case "avg":   return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "min":   return Math.min(...vals);
    case "max":   return Math.max(...vals);
    case "count": return vals.length;
  }
}

/**
 * Formats an aggregate numeric value using the column's format_string.
 */
export function formatAggValue(
  value: number | null,
  formatString?: string | null,
): string {
  if (value == null) return "—";
  const fmt = formatString ?? "";
  if (fmt.includes(".3f")) return value.toFixed(3);
  if (fmt.includes(".2f")) return value.toFixed(2);
  if (fmt.includes(".1f")) return value.toFixed(1);
  return Math.round(value).toLocaleString();
}

/**
 * Checks whether any visible column has an aggregate function configured.
 * Used to decide if a footer row should be rendered at all.
 */
export function hasAggregates(
  colConfigs: Record<string, GridColumnSetting>,
): boolean {
  return Object.values(colConfigs).some(
    (c) => c.aggregate_function && !!c.default_visible,
  );
}
