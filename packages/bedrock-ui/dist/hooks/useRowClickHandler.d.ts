/**
 * @file useRowClickHandler.ts
 * @module frontend/src/hooks
 * @description Shared row-click handler factory for all grid components.
 * Eliminates the duplicated handleRowClick function and ensures config.readOnly
 * is forwarded correctly to the flyout store.
 */
import type { Row } from "@tanstack/react-table";
import type { GridConfig } from "./useGridConfig";
/**
 * Minimal row-data contract required to open the player fly-out. Every grid row
 * consumed by {@link useRowClickHandler} must expose (at least) these fields.
 */
export interface FlyoutRowData {
    /** MLB player identifier; a falsy value suppresses the fly-out entirely. */
    player_id?: number | null;
    /** Player display name; coerced to a string for the fly-out navigation list. */
    full_name?: string | number | null;
}
/**
 * Returns a `handleRowClick` callback that opens the player fly-out with the
 * correct `readOnly` flag derived from `config.readOnly`.
 *
 * The `flatRows` list passed to `openFlyout` is built from the visible rows at
 * the moment of the click, enabling previous/next navigation within the fly-out
 * without re-querying the table.
 *
 * @typeParam T     - Row-original shape; must satisfy {@link FlyoutRowData}.
 * @param config      - Current {@link GridConfig} (supplies the `readOnly` flag).
 * @param visibleRows - The current paginated + sorted row model from TanStack Table.
 * @returns A `(row, index) => void` handler that mutates the fly-out store. Rows
 *   without a `player_id` are ignored (no-op).
 */
export declare function useRowClickHandler<T extends FlyoutRowData>(config: GridConfig, visibleRows: Row<T>[]): (row: Row<T>, index: number) => void;
