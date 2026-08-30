import { useGridSettings, useGridColumns } from "./useAdminPlatform.js";
import { DEFAULT_GRID_HEADER_CONFIG } from "../types/grid.js";
function buildGridConfig(gridId, gridSetting, colSettings, isLoaded) {
  const columns = {};
  for (const col of colSettings) {
    columns[col.column_id] = col;
  }
  const asBool = (v, fallback) => {
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
      group_by: false
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
      group_by: false
    };
  }
  const columnOrder = [...colSettings].filter((c) => asBool(c.default_visible, true)).sort((a, b) => a.column_order - b.column_order).map((c) => c.column_id);
  const pageSizeOptions = (gridSetting?.page_size_options ?? "25,50,100,250").split(",").map(Number).filter(Boolean);
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
    defaultSortDirection: gridSetting?.default_sort_direction ?? null,
    showRowCount: asBool(gridSetting?.show_row_count, true),
    showRanking: asBool(gridSetting?.show_ranking, false),
    wrapText: asBool(gridSetting?.wrap_text, false),
    allowColumnToggle: asBool(gridSetting?.allow_column_toggle, true),
    allowExport: asBool(gridSetting?.allow_export, true),
    columns,
    columnOrder,
    isLoaded,
    // Only meaningful once the queries have resolved; before that the absent
    // row is simply an absent response.
    isUnseeded: isLoaded && gridSetting === void 0,
    readOnly: asBool(gridSetting?.read_only, false) ? 1 : 0,
    sortAscColor: gridSetting?.sort_asc_color ?? null,
    sortDescColor: gridSetting?.sort_desc_color ?? null,
    hoverColor: gridSetting?.hover_color ?? null,
    allowSelection: asBool(gridSetting?.allow_selection, false),
    selectionPosition: gridSetting?.selection_position === "start" ? "start" : "end",
    allowPrintView: asBool(gridSetting?.allow_print, false),
    title: gridSetting?.title ?? null,
    subHeader: gridSetting?.sub_header ?? null,
    footer: gridSetting?.footer ?? null,
    minColumnWidth: gridSetting?.min_column_width ?? 60,
    tooltipDelayDuration: gridSetting?.tooltip_delay_duration ?? DEFAULT_GRID_HEADER_CONFIG.tooltipDelayDuration,
    showSearch: gridSetting?.show_search !== void 0 ? asBool(gridSetting.show_search, true) : DEFAULT_GRID_HEADER_CONFIG.showSearch,
    showDensityToggle: gridSetting?.show_density_toggle !== void 0 ? asBool(gridSetting.show_density_toggle, true) : DEFAULT_GRID_HEADER_CONFIG.showDensityToggle,
    showRankHighlight: gridSetting?.show_rank_highlight !== void 0 ? asBool(gridSetting.show_rank_highlight, false) : DEFAULT_GRID_HEADER_CONFIG.showRankHighlight,
    rowKeyColumn: gridSetting?.row_key_column ?? null,
    caption: gridSetting?.caption ?? null,
    stickyFirstColumn: asBool(gridSetting?.sticky_first_column, false),
    allowColumnReorder: asBool(gridSetting?.allow_column_reorder, true),
    allowExpansion: asBool(gridSetting?.allow_expansion, false),
    numeralStyle: gridSetting?.numeral_style === "tabular" ? "tabular" : "default",
    liveUpdateHighlight: asBool(gridSetting?.live_update_highlight, false),
    rowAccentReactive: asBool(gridSetting?.row_accent_reactive, false)
  };
}
function useGridConfig(gridId) {
  const { data: gridsData } = useGridSettings();
  const { data: colsData } = useGridColumns(gridId);
  const gridSetting = gridsData?.data?.find(
    (g) => g.grid_id === gridId
  );
  const colSettings = colsData?.data ?? [];
  const isLoaded = gridsData !== void 0 && colsData !== void 0;
  return buildGridConfig(gridId, gridSetting, colSettings, isLoaded);
}
export {
  buildGridConfig,
  useGridConfig
};
//# sourceMappingURL=useGridConfig.js.map
