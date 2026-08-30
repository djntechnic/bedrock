/**
 * @file cellRenderers.tsx
 * @module frontend/src/components/grids
 * @description Shared cell renderer registry for consistent column display across all grids.
 *
 * Usage: call resolveCell(columnId, value, row) in any grid's cell definition.
 * Returns a ReactNode if the column has a registered renderer, undefined otherwise.
 *
 * renderCell() is the shared cell-content renderer that applies:
 *  - null_display fallback
 *  - format_string / cell_type formatting
 *  - conditional_format class (threshold-based)
 *  - gradient backgroundColor style (takes visual priority over conditional_format)
 *  - link_target navigation
 */
import type { ReactNode, CSSProperties } from "react";
import { getMediaCellTypes, type CellRenderOptions } from "./cellRegistry";
import type { GridColumnSetting } from "../../hooks/useAdminPlatform";
/** Composite payload envelope — a flat scalar or `{ value, meta }`. */
export type GridCellPayload<T = unknown> = T | {
    value: T;
    meta: Record<string, unknown>;
};
/** Type guard for the composite envelope. */
export declare function isCompositeCellPayload<T = unknown>(v: unknown): v is {
    value: T;
    meta: Record<string, unknown>;
};
/**
 * Unwrap a cell payload into its display value and (optional) meta object.
 * Flat scalars pass through with `meta = {}`. Consumers should always route
 * value/meta through this helper before dispatching to any renderer so the
 * composite shape is transparent to the rest of the pipeline.
 */
export declare function unwrapCellPayload<T = unknown>(v: unknown): {
    value: T;
    meta: Record<string, unknown>;
};
/** Parameters available to link_target resolution. */
export interface LinkResolveCtx {
    meta: Record<string, unknown>;
    row: Record<string, unknown>;
}
/**
 * Resolve a router path for a given link_target. Returns null when the
 * required identifier isn't available (e.g. team_page called without a
 * team id in meta/row) — callers then render the plain display value.
 */
export declare function resolveLinkPath(linkTarget: string | null | undefined, ctx: LinkResolveCtx): string | null;
/** Renders the rank column cell: rank icon (ranks 1–3) + numeric position. */
export declare function renderRankCell(rank: number): ReactNode;
/** The `cell_type` values that require the full row and are handled by the
 *  engine before delegating to `renderCell`. This is a function rather than a
 *  constant because registration is a boot-time side-effect: the set is only
 *  complete once the host app's renderer module has been imported. */
export { getMediaCellTypes };
/** Dispatch entry point used by `<DataGrid>` when a column's `cell_type` is
 *  one of the media renderers. Returns undefined when no renderer is
 *  registered for the cell_type — `cell_type` is admin-editable, so an unknown
 *  value must fall through to plain-text rendering rather than throw. */
export declare function renderMediaCell(cellType: string | null | undefined, value: unknown, row: Record<string, unknown>): ReactNode | undefined;
/**
 * Shared cell content renderer for all grids. Applies formatting, conditional
 * classes, gradient background, and link targets uniformly.
 *
 * Gradient takes visual priority over conditional_format when both are set.
 *
 * @param value      - Raw cell value from the accessor.
 * @param col        - Column config (format_string, cell_type, null_display, etc.).
 * @param columnId   - The column_id string (used for rate column detection).
 * @param gradientStyle - Optional pre-computed inline style from getGradientCellStyle().
 * @param navigate   - Optional router navigate function (required for link_target).
 * @param playerId   - Optional player_id for link_target="player_page".
 * @param linkCtx    - Meta/row context for config-driven link_target resolution.
 * @param numeralStyle - Grid-level `config.numeralStyle` (§S9 Phase 3). `"tabular"`
 *                       applies the shared `.tabular-nums` utility to numeric cells.
 */
export declare function renderCell(value: unknown, col: Pick<GridColumnSetting, "null_display" | "cell_type" | "format_string" | "conditional_format" | "link_target" | "wrap_text"> & {
    column_id?: string;
}, columnId: string, gradientStyle?: CSSProperties, navigate?: (path: string) => void, playerId?: number, linkCtx?: LinkResolveCtx, numeralStyle?: "default" | "tabular"): ReactNode;
/** Options threaded into a column renderer. Re-exported from the registry so
 *  existing consumers keep importing it from this module. */
export type ResolveCellOptions = CellRenderOptions;
/**
 * Resolves a cell renderer registered against a `column_id`.
 *
 * The engine owns no column conventions of its own: the host application
 * registers renderers via `registerColumnRenderer()` (MLBTracker does so in
 * components/domain/cellRenderers). Returns undefined when nothing is
 * registered, so the caller falls through to its own logic.
 *
 * @param columnId - The grid column_id string.
 * @param value    - The raw cell value from the accessor.
 * @param row      - The full row object (for sibling fields like mlb_team_id).
 * @param options  - Optional navigate fn and linkTarget for link rendering.
 */
export declare function resolveCell(columnId: string, value: unknown, row: Record<string, unknown>, options?: ResolveCellOptions): ReactNode | undefined;
