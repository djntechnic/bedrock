/**
 * @file gridMocks.ts
 * @module @djntechnic/bedrock-ui/test
 * @description Shared mock factories for grid configuration used across grid tests.
 */

import type { GridConfig } from "../hooks/useGridConfig";
import type { GridColumnSetting } from "../hooks/useAdminPlatform";

/** Builds a minimal default GridConfig suitable for tests. */
export function makeGridConfig(overrides: Partial<GridConfig> = {}): GridConfig {
  return {
    gridId: "test_grid",
    page: null,
    defaultPageSize: 50,
    pageSizeOptions: [25, 50, 100],
    paginationEnabled: true,
    stickyHeader: true,
    rowStriping: true,
    denseMode: false,
    defaultSortColumn: null,
    defaultSortDirection: null,
    showRowCount: true,
    showRanking: false,
    wrapText: false,
    allowColumnToggle: true,
    allowExport: true,
    columns: {},
    columnOrder: [],
    isLoaded: true,
    readOnly: 0,
    sortAscColor: null,
    sortDescColor: null,
    hoverColor: null,
    allowSelection: false,
    allowPrintView: false,
    title: null,
    subHeader: null,
    footer: null,
    minColumnWidth: 60,
    tooltipDelayDuration: 150,
    showSearch: false,
    showDensityToggle: true,
    showRankHighlight: false,
    rowKeyColumn: "id",
    caption: null,
    stickyFirstColumn: false,
    allowColumnReorder: true,
    allowExpansion: false,
    numeralStyle: "default",
    liveUpdateHighlight: false,
    rowAccentReactive: false,
    isUnseeded: false,
    selectionPosition: "end",
    ...overrides,
  };
}

/** Builds a minimal column setting for use in column maps. */
export function makeColumnSetting(overrides: Partial<GridColumnSetting> = {}): GridColumnSetting {
  return {
    column_setting_id: 1,
    grid_setting_id: 1,
    column_id: "test_col",
    label_override: null,
    tooltip_override: null,
    default_visible: true,
    default_sort: null,
    default_filter: null,
    column_order: 1,
    format_string: null,
    null_display: "—",
    allow_sort: true,
    allow_sort_mode: "both",
    allow_filter: false,
    read_only: false,
    width: null,
    min_width: 60,
    max_width: null,
    pinned: null,
    text_align: "left",
    wrap_text: false,
    resizable: true,
    cell_type: "text",
    aggregate_function: null,
    conditional_format: null,
    link_target: null,
    group_by: false,
    sort_asc_color: null,
    sort_desc_color: null,
    ...overrides,
  };
}
