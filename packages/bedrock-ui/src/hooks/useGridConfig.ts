/**
 * @file useGridConfig.ts
 * @module frontend/src/hooks
 * @description Runtime grid configuration hook that merges global settings with column-specific metadata.
 */

import { useGridSettings, useGridColumns, type GridSetting, type GridColumnSetting }
  from "./useAdminPlatform";
import { DEFAULT_GRID_HEADER_CONFIG } from "../types/grid";

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
  /** Ordered list of visible column IDs for the table header/body. */
  columnOrder: string[];
  /** 
   * Global ready flag. Set to true only when both grid and column 
   * metadata have been successfully fetched from the API.
   */
  isLoaded: boolean;
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
  /** Whether the unified GridHeader renders medal / podium ranking toggles. */
  showMedalToggles: boolean;
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
   * Phase 3 §S9: tints each data row with its player's contrast-clamped
   * `--team-accent` color (via `teamColors.ts`) when the row carries a
   * resolvable `mlb_team_id`.
   */
  teamAccentReactive: boolean;
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
export function buildGridConfig(
  gridId: string,
  gridSetting: GridSetting | undefined,
  colSettings: GridColumnSetting[],
  isLoaded: boolean
): GridConfig {
  // Build column map
  const columns: Record<string, GridColumnSetting> = {};
  for (const col of colSettings) {
    columns[col.column_id] = col;
  }

  // Phase 2.c: bool coercion happens at the Pydantic layer — see
  // api/schemas/admin.py. Fields land here as JSON true/false; we pass them
  // through unchanged. `asBool` is a defensive fallback that survives a
  // consumer-authored draft object (e.g. GridPreview) that still uses 0/1
  // literals during the admin-editor migration.
  const asBool = (v: unknown, fallback: boolean): boolean => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
    return fallback;
  };

  const maxOrder = colSettings.reduce((m, c) => Math.max(m, c.column_order ?? 0), 0);

  if (asBool(gridSetting?.show_ranking, false) && !columns["ranking"]) {
    columns["ranking"] = {
      grid_setting_id: gridSetting?.grid_setting_id ?? 0,
      column_id: "ranking",
      label_override: "Rank (#)",
      tooltip_override: "Numeric rank column",
      default_visible: true,
      column_order: maxOrder + 1,
      null_display: "—",
      allow_sort: false,
      allow_sort_mode: "none",
      allow_filter: false,
      read_only: true,
      width: 50,
      min_width: 40,
      text_align: "center",
      wrap_text: false,
      resizable: false,
      cell_type: "number",
      group_by: false,
    };
  }

  if (asBool(gridSetting?.allow_selection, false) && !columns["_compare"]) {
    columns["_compare"] = {
      grid_setting_id: gridSetting?.grid_setting_id ?? 0,
      column_id: "_compare",
      label_override: "Selection (Cmp)",
      tooltip_override: "Compare selection column",
      default_visible: true,
      column_order: maxOrder + 2,
      null_display: "—",
      allow_sort: false,
      allow_sort_mode: "none",
      allow_filter: false,
      read_only: true,
      width: 36,
      min_width: 36,
      text_align: "center",
      wrap_text: false,
      resizable: false,
      cell_type: "text",
      group_by: false,
    };
  }

  // Ordered by column_order, only visible ones.
  // Filters by default_visible to ensure the initial table state matches
  // the admin-defined defaults.
  const columnOrder = [...colSettings]
    .filter((c) => asBool(c.default_visible, true))
    .sort((a, b) => a.column_order - b.column_order)
    .map((c) => c.column_id);

  const pageSizeOptions = (gridSetting?.page_size_options ?? "25,50,100,250")
    .split(",")
    .map(Number)
    .filter(Boolean);

  return {
    gridId,
    page: gridSetting?.page ?? null,
    defaultPageSize: gridSetting?.default_page_size ?? 50,
    pageSizeOptions,
    paginationEnabled: asBool(gridSetting?.pagination_enabled, true),
    stickyHeader: asBool(gridSetting?.sticky_header, true),
    rowStriping: asBool(gridSetting?.row_striping, true),
    denseMode: asBool(gridSetting?.dense_mode, false),
    defaultSortColumn: gridSetting?.default_sort_column ?? null,
    defaultSortDirection:
      (gridSetting?.default_sort_direction as "asc" | "desc" | null) ?? null,
    showRowCount: asBool(gridSetting?.show_row_count, true),
    showRanking: asBool(gridSetting?.show_ranking, false),
    wrapText: asBool(gridSetting?.wrap_text, false),
    allowColumnToggle: asBool(gridSetting?.allow_column_toggle, true),
    allowExport: asBool(gridSetting?.allow_export, true),
    columns,
    columnOrder,
    isLoaded,
    readOnly: asBool(gridSetting?.read_only, false) ? 1 : 0,
    sortAscColor: gridSetting?.sort_asc_color ?? null,
    sortDescColor: gridSetting?.sort_desc_color ?? null,
    hoverColor: gridSetting?.hover_color ?? null,
    allowSelection: asBool(gridSetting?.allow_selection, false),
    allowPrintView: asBool(gridSetting?.allow_print, false),
    title: gridSetting?.title ?? null,
    subHeader: gridSetting?.sub_header ?? null,
    footer: gridSetting?.footer ?? null,
    minColumnWidth: gridSetting?.min_column_width ?? 60,
    tooltipDelayDuration:
      gridSetting?.tooltip_delay_duration ??
      DEFAULT_GRID_HEADER_CONFIG.tooltipDelayDuration,
    showSearch:
      gridSetting?.show_search !== undefined
        ? asBool(gridSetting.show_search, true)
        : DEFAULT_GRID_HEADER_CONFIG.showSearch,
    showDensityToggle:
      gridSetting?.show_density_toggle !== undefined
        ? asBool(gridSetting.show_density_toggle, true)
        : DEFAULT_GRID_HEADER_CONFIG.showDensityToggle,
    showMedalToggles:
      gridSetting?.show_medal_toggles !== undefined
        ? asBool(gridSetting.show_medal_toggles, false)
        : DEFAULT_GRID_HEADER_CONFIG.showMedalToggles,
    rowKeyColumn: gridSetting?.row_key_column ?? null,
    caption: gridSetting?.caption ?? null,
    stickyFirstColumn: asBool(gridSetting?.sticky_first_column, false),
    allowColumnReorder: asBool(gridSetting?.allow_column_reorder, true),
    allowExpansion: asBool(gridSetting?.allow_expansion, false),
    numeralStyle: gridSetting?.numeral_style === "tabular" ? "tabular" : "default",
    liveUpdateHighlight: asBool(gridSetting?.live_update_highlight, false),
    teamAccentReactive: asBool(gridSetting?.team_accent_reactive, false),
  };
}

/**
 * Merges grid-level and column-level settings from two separate API queries.
 * isLoaded gates consumer components from rendering with default values
 * before config arrives — prevents a flash of wrong page size or sort
 * order on initial mount.
 *
 * @param gridId - The unique identifier for the grid configuration to load.
 * @returns The consolidated GridConfig object.
 */
export function useGridConfig(gridId: string): GridConfig {
  const { data: gridsData } = useGridSettings();
  const { data: colsData } = useGridColumns(gridId);

  const gridSetting: GridSetting | undefined = gridsData?.data?.find(
    (g) => g.grid_id === gridId
  );
  const colSettings: GridColumnSetting[] = colsData?.data ?? [];
  const isLoaded = gridsData !== undefined && colsData !== undefined;

  return buildGridConfig(gridId, gridSetting, colSettings, isLoaded);
}
