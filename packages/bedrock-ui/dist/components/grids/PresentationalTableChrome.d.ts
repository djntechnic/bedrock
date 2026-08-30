/**
 * @file PresentationalTableChrome.tsx
 * @module frontend/src/components/grids
 * @description Phase 7 A1 — outer chrome primitive for the 8 files on the
 * `PRESENTATIONAL_TABLES` allowlist (wizard steps, row-expansion tables,
 * pivots, inline-edit surfaces) so their border, sticky header, casing,
 * striping, hover, cell padding, empty state, loading state, and row-count
 * display match `<DataGrid>` pixel-for-pixel without dragging bespoke row /
 * expansion / editing logic through the engine.
 *
 * Consumers wrap their own `<thead>` + `<tbody>` in this primitive and apply
 * the exported `chromeClasses` constants to individual `<tr>`/`<th>`/`<td>`
 * elements. The primitive owns the outer container, the `<table>` element
 * itself, and the loading / empty state overlays.
 */
import type { ReactNode } from "react";
/**
 * Shared class constants — the "MUST match" list from `grid_blueprint.md §
 * Presentational tables`. Import these into each of the 8 presentational
 * files so their header / body / row / cell styling drifts back to a single
 * source of truth. Keep in sync with `<DataGrid>`'s equivalent classes.
 */
export declare const chromeClasses: {
    /** Outer container — rounded border + horizontal scroll fallback. */
    readonly container: "rounded border overflow-auto bg-background";
    /** `<table>` — full width, border-collapse, text-sm baseline. */
    readonly table: "w-full border-collapse text-sm";
    /** `<tr>` inside `<thead>` — sticky, border-bottom, muted background. */
    readonly headerRow: "border-b bg-muted/50 sticky top-0 z-10";
    /** `<th>` — uppercase casing, muted foreground. Add `text-center`/`text-right` as needed. */
    readonly headerCell: "px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap";
    /** `<tbody>` — zebra striping via `nth-child` selector. */
    readonly body: "[&>tr:nth-child(even)]:bg-muted/20";
    /** `<tr>` inside `<tbody>` — border + hover. */
    readonly row: "border-b border-border/40 hover:bg-muted/30 transition-colors";
    /** `<td>` — consistent padding + vertical align. */
    readonly cell: "px-3 py-1.5 align-middle";
};
export interface PresentationalTableChromeProps {
    /** Optional additional classes for the outer container div. */
    className?: string;
    /** Optional additional classes for the `<table>` element. */
    tableClassName?: string;
    /** Row count shown as a caption above the table. Skipped when undefined. */
    rowCount?: number;
    /** Label following the count (e.g. `"batches"` → `"3 batches"`). Defaults to `"rows"`. */
    countLabel?: string;
    /** When true, renders the shared loading skeleton in place of the body. */
    isLoading?: boolean;
    /** When true, renders the empty-state message in place of the body. */
    isEmpty?: boolean;
    /** Empty-state message override. */
    emptyMessage?: string;
    /** Column span for the loading / empty state cell. Defaults to 1. */
    colSpan?: number;
    /** Custom node rendered above the table (right of the row count when both present). */
    toolbar?: ReactNode;
    /** `<thead>` and `<tbody>` markup provided by the consumer. */
    children?: ReactNode;
}
/**
 * Outer chrome primitive. Owns the container, table element, row-count line,
 * and loading / empty state overlays. Consumers provide the head + body.
 */
export declare function PresentationalTableChrome({ className, tableClassName, rowCount, countLabel, isLoading, isEmpty, emptyMessage, colSpan, toolbar, children, }: PresentationalTableChromeProps): import("react").JSX.Element;
