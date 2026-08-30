/**
 * @file previewStaging.ts
 * @module frontend/src/components/admin/gridEditor
 * @description Row shape and value synthesis for the Grid Editor preview.
 *
 *              What survived the static fixtures. The editor previews against
 *              the grid's registered live API endpoint (see
 *              apiPreviewRegistry.ts), but a configured column often has no
 *              counterpart in the response — a custom column, a renamed field,
 *              or a column added before the endpoint caught up. Without a
 *              value those cells render empty and the admin cannot see whether
 *              their number formatting or gradient wiring is right.
 *
 *              `stageValue` fills exactly those gaps, and only for numeric
 *              cell types where a synthetic value is meaningful.
 */
/** A preview row. Shape is whatever the grid's endpoint returns. */
export interface PreviewRow {
    [key: string]: unknown;
}
/**
 * Resolve the value a preview cell should show.
 *
 * @param row - The staged row.
 * @param columnId - The configured column's id.
 * @param cellType - The column's configured cell type.
 * @returns The row's own value when present; otherwise a stable pseudo-number
 *          for numeric columns so formatting and gradients are demonstrable,
 *          and null for everything else.
 */
export declare function stageValue(row: PreviewRow, columnId: string, cellType: string | null | undefined): unknown;
