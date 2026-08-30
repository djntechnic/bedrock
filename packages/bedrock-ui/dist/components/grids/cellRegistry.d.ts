/**
 * @file cellRegistry.ts
 * @module frontend/src/components/grids
 * @description Extension points that let an application teach the grid engine
 * how to render its own domain cells, without the engine importing a single
 * domain component.
 *
 * Two independent dispatch axes, mirroring the two the engine already had:
 *
 *   * **Media renderers** keyed by `cell_type` — the admin-configurable value
 *     on `app_grid_column_settings`. Used for cells that need sibling row
 *     fields (a headshot needs `row.mlb_team_id`, not just the display name),
 *     which the base `renderCell` never receives.
 *
 *   * **Column renderers** keyed by `column_id` — the legacy convention where
 *     a column called `position` or `team` always renders the same way
 *     regardless of config.
 *
 * Registration is a module side-effect: the host app imports its registration
 * module once at boot (see `src/config/cellRenderers.tsx`, wired from
 * `main.tsx`). Tests that exercise domain cells import it the same way.
 *
 * Unregistered keys resolve to `undefined` rather than throwing. This matters:
 * `cell_type` is DB-driven, so an admin can set a value no build knows about,
 * and the correct response is to fall through to plain-text rendering, not to
 * crash the grid.
 */
import type { ReactNode } from "react";
/** Options threaded into a column renderer (router navigation + link config). */
export interface CellRenderOptions {
    /** Router navigate fn — required for link targets that route. */
    navigate?: (path: string) => void;
    /** Column `link_target` from admin config. */
    linkTarget?: string | null;
}
/**
 * Renders a cell whose `cell_type` needs the whole row.
 *
 * @param value - The raw cell value from the accessor.
 * @param row   - The full row object, for sibling identity fields.
 */
export type MediaCellRenderer = (value: unknown, row: Record<string, unknown>) => ReactNode;
/**
 * Renders a cell selected by its stable `column_id`.
 *
 * @param value   - The raw cell value from the accessor.
 * @param row     - The full row object, for sibling identity fields.
 * @param options - Navigation / link-target context.
 */
export type ColumnCellRenderer = (value: unknown, row: Record<string, unknown>, options?: CellRenderOptions) => ReactNode;
/**
 * Registers a renderer for a `cell_type`. Re-registering the same key
 * overwrites, which keeps hot-module reload and repeated test imports safe.
 *
 * @param cellType - The `app_grid_column_settings.cell_type` value.
 * @param render   - The renderer to invoke for that cell type.
 */
export declare function registerMediaRenderer(cellType: string, render: MediaCellRenderer): void;
/**
 * Registers a renderer for a `column_id`.
 *
 * @param columnId - The stable grid column id.
 * @param render   - The renderer to invoke for that column.
 */
export declare function registerColumnRenderer(columnId: string, render: ColumnCellRenderer): void;
/**
 * Registers one renderer under several `column_id` aliases — the common case
 * where `full_name`, `name` and `player_name` all mean the same thing.
 *
 * @param columnIds - The column ids to bind.
 * @param render    - The shared renderer.
 */
export declare function registerColumnRenderers(columnIds: readonly string[], render: ColumnCellRenderer): void;
/**
 * @param cellType - A `cell_type` value, possibly unregistered or nullish.
 * @returns The registered media renderer, or `undefined` to fall through.
 */
export declare function resolveMediaRenderer(cellType: string | null | undefined): MediaCellRenderer | undefined;
/**
 * @param columnId - A grid `column_id`.
 * @returns The registered column renderer, or `undefined` to fall through.
 */
export declare function resolveColumnRenderer(columnId: string | null | undefined): ColumnCellRenderer | undefined;
/**
 * @returns Every registered `cell_type`. The engine treats these as needing
 * the full row, so it routes them through the media pipeline before
 * delegating to `renderCell`.
 */
export declare function getMediaCellTypes(): Set<string>;
/**
 * @param cellType - A `cell_type` value.
 * @returns Whether a media renderer is registered for it.
 */
export declare function isMediaCellType(cellType: string | null | undefined): boolean;
/** Test helper: drops every registration. Not used by application code. */
export declare function __clearCellRegistry(): void;
