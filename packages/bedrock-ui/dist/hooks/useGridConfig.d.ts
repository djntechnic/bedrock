/**
 * @file useGridConfig.ts
 * @module frontend/src/hooks
 * @description Runtime grid configuration hook that merges global settings with column-specific metadata.
 */
import { type GridSetting, type GridColumnSetting } from "./useAdminPlatform";
/**
 * Consolidated configuration for a TanStack Table instance,
 * driving both functional behavior and visual presentation.
 */
export interface GridConfig {
    /** The unique identifier for the grid (e.g., 'leaderboard_batting'). */
    gridId: string;
    /** Screen/page this grid renders on (metadata; drives the admin Screen dropdown). */
    page: string | null;
    /** Number of rows to display per page by default. */
    defaultPageSize: number;
    /** Options available in the page size selector. */
    pageSizeOptions: number[];
    /** Whether client-side or server-side pagination is active. */
    paginationEnabled: boolean;
    /** Whether the table header should remain fixed during scroll. */
    stickyHeader: boolean;
    /** Whether alternating rows should have a background tint. */
    rowStriping: boolean;
    /** Whether to use reduced cell padding for high-density data. */
    denseMode: boolean;
    /** Default column ID to sort by on initial load. */
    defaultSortColumn: string | null;
    /** Default sort direction ('asc' or 'desc') on initial load. */
    defaultSortDirection: "asc" | "desc" | null;
    /** Whether to show the 'Total Rows' count in the footer/header. */
    showRowCount: boolean;
    /** Whether to show a 'Ranking' column based on row number. */
    showRanking: boolean;
    /** Whether cell content should wrap or truncate with ellipsis. */
    wrapText: boolean;
    /** Whether the user is allowed to hide/show columns at runtime. */
    allowColumnToggle: boolean;
    /** Whether the data can be exported to CSV/Excel. */
    allowExport: boolean;
    /** Map of column settings keyed by their stable column_id. */
    columns: Record<string, GridColumnSetting>;
    /**
     * Ordered list of **visible** column IDs for the table header/body.
     *
     * Visible-only, and that is a trap worth naming: a hidden-but-`editable`
     * column is absent from here, so anything deriving a working set (bulk edit,
     * a field picker) must iterate {@link GridConfig.columns} instead. This list
     * answers "what does the table render", never "what columns exist".
     */
    columnOrder: string[];
    /**
     * Global ready flag. Set to true only when both grid and column
     * metadata have been successfully fetched from the API.
     */
    isLoaded: boolean;
    /**
     * True when the config resolved but `app_grid_settings` holds no row for
     * this `gridId` — the grid was never seeded.
     *
     * It is separate from `isLoaded` because the two mean opposite things to a
     * consumer: not-loaded is "wait", unseeded is "this will never arrive".
     * Without the distinction the grid renders its defaults over zero columns,
     * which looks exactly like a grid whose query returned nothing.
     */
    isUnseeded: boolean;
    /** Whether the grid data is read-only. */
    readOnly: number;
    /** CSS color applied to header/cells of an ascending-sorted column (null = no highlight). */
    sortAscColor: string | null;
    /** CSS color applied to header/cells of a descending-sorted column (null = no highlight). */
    sortDescColor: string | null;
    /** CSS background color applied on row hover (null = use default Tailwind class). */
    hoverColor: string | null;
    /** Whether a compare-selection checkbox column is prepended. Config-driven replacement for the onSelectionChange prop. */
    allowSelection: boolean;
    /**
     * Which side of the grid the selection checkbox column sits on.
     *
     * "end" is the default because it is where the engine always put it; a grid
     * that wants the spreadsheet layout sets `selection_position = 'start'` in
     * `app_grid_settings` rather than waiting for a release.
     */
    selectionPosition: "start" | "end";
    /**
     * Whether the unified GridHeader renders a clean print / PDF layout trigger.
     * Config-driven per grid via the app_grid_settings.allow_print column so no
     * hardcoded print exemptions live in layout components.
     */
    allowPrintView: boolean;
    /** Optional title to display above the grid (surfaced for consumer use; not rendered by the hook). */
    title: string | null;
    /** Optional sub-header text. */
    subHeader: string | null;
    /** Optional footer text. */
    footer: string | null;
    /** Minimum width in pixels applied as the floor for all column minSize values. */
    minColumnWidth: number;
    /**
     * Tooltip open latency (ms) fed into every TooltipProvider. Sourced from the
     * grid's DB override when present, otherwise the centralized appSettings
     * default. Consumers apply it as `delayDuration={config.tooltipDelayDuration}`.
     */
    tooltipDelayDuration: number;
    /** Whether the unified GridHeader renders an inline search input. */
    showSearch: boolean;
    /** Whether the unified GridHeader renders the density toggle. */
    showDensityToggle: boolean;
    /** Whether the unified GridHeader renders the rank-highlight toggle. */
    showRankHighlight: boolean;
    /**
     * Row-object field carrying each row's stable ID. Drives the config-driven
     * selection column on `<DataGrid>` and TanStack row keying. Required as of
     * Phase 7 D1 — `<DataGrid>` throws if this is null at render time. Seed
     * via `row_key_column` in `app_grid_settings`.
     */
    rowKeyColumn: string | null;
    /** Semantic `<caption>` text rendered inside the `<Table>` (accessibility surface). */
    caption: string | null;
    /**
     * Phase 3: pin the first visible data column to the left edge as an
     * implicit sticky column. Explicit column-level `pinned` values always
     * win when set.
     */
    stickyFirstColumn: boolean;
    /**
     * Phase 5: allow end users to drag-and-drop column headers to reorder
     * within their session. The admin Grid Editor persists any reorder by
     * renumbering each column's column_order on drop.
     */
    allowColumnReorder: boolean;
    /**
     * Phase 10 B2: gates the expander column + `renderSubRow` slot on
     * `<DataGrid>`. The engine prepends the chevron column only when
     * both this flag is true AND the consumer supplies `renderSubRow`.
     */
    allowExpansion: boolean;
    /**
     * Phase 3 §S9: condensed tabular-numeral style for `cell_type: "number"`
     * cells. `"tabular"` applies the shared `.tabular-nums` utility class
     * (self-hosted Oswald + tabular-nums font-variant) via `renderCell()`.
     */
    numeralStyle: "default" | "tabular";
    /**
     * Phase 3 §S9: flashes a cell with the `--live-pulse` token cue
     * (`.animate-live-pulse`) when its value changes between renders.
     */
    liveUpdateHighlight: boolean;
    /**
     * Phase 3 §S9: tints each data row with an accent color the row supplies,
     * resolved through the host application's `registerRowAccentResolver()`
     * (see `rowAccentRegistry.ts`).
     */
    rowAccentReactive: boolean;
}
/**
 * Pure mapping from raw DB grid + column settings into the runtime-friendly
 * {@link GridConfig} shape. Extracted so both {@link useGridConfig} and the admin
 * Grid Editor's draft hook build config through one code path and never drift.
 *
 * `isLoaded` is passed in explicitly: the hook derives it from query resolution,
 * while the draft editor (which always has data in hand) passes `true`.
 *
 * @param gridId - The grid identifier.
 * @param gridSetting - The raw grid-level settings row (or undefined if absent).
 * @param colSettings - The raw column-level settings rows.
 * @param isLoaded - Whether the config should be treated as fully loaded.
 * @returns The consolidated GridConfig object.
 */
export declare function buildGridConfig(gridId: string, gridSetting: GridSetting | undefined, colSettings: GridColumnSetting[], isLoaded: boolean): GridConfig;
/**
 * Merges grid-level and column-level settings from two separate API queries.
 * isLoaded gates consumer components from rendering with default values
 * before config arrives — prevents a flash of wrong page size or sort
 * order on initial mount.
 *
 * @param gridId - The unique identifier for the grid configuration to load.
 * @returns The consolidated GridConfig object.
 */
export declare function useGridConfig(gridId: string): GridConfig;
