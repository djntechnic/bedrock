/**
 * @file useTableState.ts
 * @module frontend/src/hooks
 * @description Unified TanStack Table initialization hook. Eliminates the repeated
 * sorting/visibility useEffect pattern across all 5 grid components.
 *
 * Key invariant: this hook calls useUserGridConfig internally — grids pass only gridId.
 *
 * Per-user customization: initial sort/column-visibility state seeds from the
 * admin→user→session merge (see useUserGridConfig.ts's mergeUserGridPreference),
 * and `setSorting`/`setColumnVisibility` are wrapped so a user-driven change
 * also schedules a debounced persist. This is the single integration point
 * that gives every `<DataGrid>` consumer per-user sort/column persistence —
 * no per-grid wiring needed, the same "engine owns it once" pattern used for
 * the §S9 grid style tokens.
 */
import type { SortingState, VisibilityState } from "@tanstack/react-table";
import { type GridConfig } from "./useGridConfig";
export interface TableState {
    /** The resolved GridConfig for this gridId. */
    config: GridConfig;
    /** Current TanStack sort state. */
    sorting: SortingState;
    setSorting: React.Dispatch<React.SetStateAction<SortingState>>;
    /** Current column visibility state. */
    columnVisibility: VisibilityState;
    setColumnVisibility: React.Dispatch<React.SetStateAction<VisibilityState>>;
    /** Cell padding class — "px-2 py-1" in denseMode, otherwise "px-3 py-2". */
    cellPad: string;
    /** Header class — includes "sticky top-0 z-10" when stickyHeader is true. */
    headerClassName: string;
    /** Body class — includes "[&>tr:nth-child(even)]:bg-muted/20" when rowStriping is true. */
    bodyClassName: string;
    /** Row class — includes "whitespace-nowrap" when wrapText is false. */
    rowClassName: string;
    /** Convenience alias for config.isLoaded (now also gates on the user
     * preference fetch when authenticated, so nothing flashes un-personalized). */
    isLoaded: boolean;
    /** Parsed pinned filter set (the user's saved columnFilters snapshot), or
     * null when absent/malformed — DataGrid seeds its initial columnFilters
     * from this before falling back to admin per-column default_filter. */
    pinnedFilters: unknown[] | null;
    /** Admin→user merged column order — DataGrid seeds its runtime
     * `columnOrder` state from this instead of raw admin `column_order`. */
    columnOrder: string[];
    /** Persists a columnFilters change (debounced). */
    persistFilters: (filters: unknown[]) => void;
    /** Persists a column-order change (debounced). DataGrid calls this from
     * its single drag-reorder / admin-reorder funnel. */
    persistColumnOrder: (order: string[]) => void;
    /** Whether the user has pinned this grid as a dashboard source. */
    dashboardPin: boolean;
    /** Toggles dashboard-pin status. Immediate (not debounced). */
    setDashboardPin: (next: boolean) => void;
}
/**
 * Provides all TanStack Table state and derived CSS helpers for a grid.
 *
 * Automatically syncs sorting and column visibility with the admin→user
 * merged defaults when the config is first loaded or the gridId changes.
 * Re-initializes both states on gridId change so switching tabs (e.g.,
 * batting ↔ pitching) resets sort.
 *
 * The returned CSS helper strings (`cellPad`, `headerClassName`,
 * `bodyClassName`, `rowClassName`) are derived from admin `GridConfig` flags —
 * `denseMode`, `stickyHeader`, `rowStriping` and `wrapText` respectively — so
 * every grid stays wired to the centralized admin configuration layer rather
 * than hardcoding presentation.
 *
 * @param gridId - Stable identifier for the grid (e.g., `'leaderboard_batting'`).
 * @returns A {@link TableState} bundle: the resolved config, sort/visibility
 *   state pairs, derived CSS helper classes and an `isLoaded` convenience flag.
 *
 * @example
 * ```tsx
 * const { config, sorting, setSorting, columnVisibility, cellPad } =
 *   useTableState("leaderboard_batting");
 * const table = useReactTable({
 *   data,
 *   columns,
 *   state: { sorting, columnVisibility },
 *   onSortingChange: setSorting,
 * });
 * ```
 */
export declare function useTableState(gridId: string): TableState;
