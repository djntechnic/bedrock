import { jsx, jsxs } from "react/jsx-runtime";
import { useState, useMemo, useEffect, useRef } from "react";
import { createColumnHelper, useReactTable, getExpandedRowModel, getGroupedRowModel, getFilteredRowModel, getSortedRowModel, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { Table, TableHeader, TableRow, TableBody, TableCell, TableFooter } from "../../ui/table.js";
import { SegmentedControl } from "../../ui/segmented-control.js";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../ui/select.js";
import { Label } from "../../ui/label.js";
import { Input } from "../../ui/input.js";
import { Badge } from "../../ui/badge.js";
import { Button } from "../../ui/button.js";
import { RotateCw, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "../../../lib/utils.js";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../../ui/collapsible.js";
import { usePersistedDisclosure } from "../../../hooks/usePersistedDisclosure.js";
import GridHeader from "../../grids/GridHeader.js";
import { useDensity } from "../../../hooks/useDensity.js";
import { SortableTableHead } from "../../SortableTableHead.js";
import { DndColumnWrapper } from "../../../hooks/useDraggableColumns.js";
import { getApiBindingsForGrid, getDefaultParamsForBinding } from "./apiPreviewRegistry.js";
import { usePreviewLiveData } from "./usePreviewLiveData.js";
import { unwrapCellPayload, resolveCell } from "../../grids/cellRenderers.js";
import { applyColumnSizing, computeColumnMinMax, getGradientCellStyle, prependRankColumn, prependSelectionColumn, hasAggregates, computeAggValue, formatAggValue } from "../../../utils/gridUtils.js";
import { getRankRowClass } from "../../../utils/rankStyle.js";
import "@tanstack/react-query";
import "../../../api/client.js";
import "../../../context/AppConfigContext.js";
import { useRowAccentResolver } from "../../grids/rowAccentRegistry.js";
import { log } from "../../../utils/logger.js";
import { unknownColumnsFor } from "./datasetSchemas.js";
import { stageValue } from "./previewStaging.js";
const VIEWPORT_MAX = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px"
};
const colHelper = createColumnHelper();
function renderPreviewCell(rawValue, col, row, numeralStyle) {
  const { value, meta } = unwrapCellPayload(rawValue);
  const rowWithMeta = { ...row, ...meta };
  const resolved = resolveCell(
    col.column_id,
    value,
    rowWithMeta,
    { linkTarget: col.link_target }
  );
  if (resolved !== void 0) return resolved;
  if (value == null)
    return /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: col.null_display ?? "—" });
  if (col.cell_type === "number") {
    const n = Number(value);
    if (isNaN(n)) return /* @__PURE__ */ jsx("span", { children: String(value) });
    const fmt = col.format_string;
    let display;
    if (fmt === ".1f" || fmt === "0.0") display = n.toFixed(1);
    else if (fmt === ".2f" || fmt === "0.00") display = n.toFixed(2);
    else if (fmt === ".3f" || fmt === "0.000") display = n.toFixed(3);
    else display = Math.round(n).toString();
    return /* @__PURE__ */ jsx("span", { className: numeralStyle === "tabular" ? "tabular-nums" : void 0, children: display });
  }
  return /* @__PURE__ */ jsx("span", { children: String(value) });
}
function GridPreview({ config, onEnterFocus: _onEnterFocus, onColumnReorder }) {
  const [viewport, setViewport] = useState("desktop");
  const apiBindings = useMemo(
    () => getApiBindingsForGrid(config.gridId),
    [config.gridId]
  );
  const [selectedBindingId, setSelectedBindingId] = useState(
    apiBindings[0]?.id ?? ""
  );
  const [apiRowLimit, setApiRowLimit] = useState(5);
  const [liveApiRequested, setLiveApiRequested] = useState(false);
  useEffect(() => {
    setLiveApiRequested(false);
  }, [selectedBindingId]);
  const activeBinding = useMemo(
    () => apiBindings.find((b) => b.id === selectedBindingId) ?? apiBindings[0] ?? null,
    [apiBindings, selectedBindingId]
  );
  const [paramValues, setParamValues] = useState(
    () => activeBinding ? getDefaultParamsForBinding(activeBinding) : {}
  );
  useEffect(() => {
    if (activeBinding) {
      setParamValues(getDefaultParamsForBinding(activeBinding));
    }
  }, [activeBinding?.id]);
  const effectiveParams = useMemo(() => {
    return { ...paramValues, limit: apiRowLimit };
  }, [paramValues, apiRowLimit]);
  const liveApiState = usePreviewLiveData(activeBinding, effectiveParams, liveApiRequested);
  const effectiveRows = useMemo(
    () => liveApiState.rows.slice(0, apiRowLimit),
    [liveApiState.rows, apiRowLimit]
  );
  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const { density, cycleDensity } = useDensity(!!config.denseMode);
  const [datasetDrawerOpen, setDatasetDrawerOpen] = usePersistedDisclosure(
    "datasetDrawerOpen",
    false
  );
  useEffect(() => {
    const stray = unknownColumnsFor(
      config.gridId,
      Object.values(config.columns).map((c) => c.column_id)
    );
    for (const columnId of stray) {
      log.warn(
        {
          gridId: config.gridId,
          columnId,
          action: "dataset.unknownColumn"
        },
        "GridPreview: column id not present in dataset schema — cells will render empty unless the endpoint emits this field"
      );
    }
  }, [config.gridId, config.columns]);
  const stagedData = useMemo(() => {
    const cols = Object.values(config.columns);
    return effectiveRows.map((row) => {
      const filled = { ...row };
      for (const col of cols) {
        if (!(col.column_id in filled)) {
          filled[col.column_id] = stageValue(row, col.column_id, col.cell_type);
        }
      }
      return filled;
    });
  }, [effectiveRows, config.columns]);
  const resolveRowAccent = useRowAccentResolver(config.rowAccentReactive);
  const prevStagedRef = useRef(null);
  const [flashKeys, setFlashKeys] = useState(/* @__PURE__ */ new Set());
  useEffect(() => {
    const rowKeyCol = config.rowKeyColumn;
    if (!config.liveUpdateHighlight || !rowKeyCol) {
      prevStagedRef.current = null;
      return;
    }
    const nextMap = {};
    for (const row of stagedData) {
      const key = row[rowKeyCol];
      if (key == null) continue;
      nextMap[String(key)] = row;
    }
    const prev = prevStagedRef.current;
    prevStagedRef.current = nextMap;
    if (!prev) return;
    const changed = /* @__PURE__ */ new Set();
    for (const [key, row] of Object.entries(nextMap)) {
      const prevRow = prev[key];
      if (!prevRow) continue;
      for (const columnId of Object.keys(config.columns)) {
        if (row[columnId] !== prevRow[columnId]) changed.add(`${key}:${columnId}`);
      }
    }
    if (changed.size === 0) return;
    setFlashKeys(changed);
    const t = setTimeout(() => setFlashKeys(/* @__PURE__ */ new Set()), 1100);
    return () => clearTimeout(t);
  }, [stagedData, config.liveUpdateHighlight, config.rowKeyColumn, config.columns]);
  const columns = useMemo(() => {
    const baseCols = Object.values(config.columns).sort((a, b) => a.column_order - b.column_order).map((col) => {
      const sizing = applyColumnSizing(col, config.minColumnWidth);
      return colHelper.accessor((r) => r[col.column_id], {
        id: col.column_id,
        header: () => /* @__PURE__ */ jsx("span", { children: col.label_override || col.column_id }),
        size: sizing.size,
        minSize: sizing.minSize,
        maxSize: sizing.maxSize,
        // Phase 2 sort mode enum + Phase 3 column-stub wiring — mirror
        // DataGrid so the admin's preview and the runtime grid share
        // exactly the same TanStack surface.
        enableSorting: col.allow_sort_mode !== void 0 ? col.allow_sort_mode !== "none" : !!col.allow_sort,
        enableColumnFilter: !!col.allow_filter,
        enableResizing: !!col.resizable,
        enableGrouping: !!col.group_by,
        enableHiding: !col.read_only,
        cell: (info) => {
          const val = info.getValue();
          let gradStyle;
          if (col.gradient_from_color && col.gradient_to_color) {
            const minMax = computeColumnMinMax(
              stagedData,
              col.column_id
            );
            if (minMax && typeof val === "number") {
              gradStyle = getGradientCellStyle(
                val,
                minMax.min,
                minMax.max,
                col.gradient_from_color,
                col.gradient_to_color
              );
            }
          }
          const content = renderPreviewCell(val, col, info.row.original, config.numeralStyle);
          return gradStyle ? /* @__PURE__ */ jsx("span", { className: "block w-full", style: gradStyle, children: content }) : content;
        },
        meta: { align: col.text_align ?? "left" }
      });
    });
    const withRank = prependRankColumn(
      baseCols,
      config.showRanking,
      colHelper,
      config.showRankHighlight,
      "end"
    );
    return prependSelectionColumn(
      withRank,
      config.allowSelection,
      selectedIds,
      setSelectedIds,
      "mlb_id",
      config.selectionPosition
    );
  }, [config.columns, config.showRanking, config.allowSelection, config.selectionPosition, config.minColumnWidth, config.numeralStyle, selectedIds, stagedData]);
  const initialVisibility = useMemo(() => {
    const vis = {};
    for (const col of Object.values(config.columns)) {
      vis[col.column_id] = !!col.default_visible;
    }
    return vis;
  }, [config.columns]);
  const columnPinning = useMemo(() => {
    const left = [];
    const right = [];
    const orderedCols = Object.values(config.columns).sort(
      (a, b) => a.column_order - b.column_order
    );
    for (const col of orderedCols) {
      if (col.pinned === "left") left.push(col.column_id);
      else if (col.pinned === "right") right.push(col.column_id);
    }
    if (config.stickyFirstColumn && left.length === 0) {
      const firstVisible = orderedCols.find((c) => c.default_visible !== false);
      if (firstVisible) left.push(firstVisible.column_id);
    }
    return { left, right };
  }, [config.columns, config.stickyFirstColumn]);
  const initialColumnFilters = useMemo(() => {
    const out = [];
    for (const col of Object.values(config.columns)) {
      if (!col.default_filter) continue;
      let parsed = col.default_filter;
      try {
        parsed = JSON.parse(col.default_filter);
      } catch {
        parsed = col.default_filter;
      }
      out.push({ id: col.column_id, value: parsed });
    }
    return out;
  }, [config.columns]);
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const rowIdKey = config.rowKeyColumn || void 0;
  const getRowId = useMemo(
    () => rowIdKey ? (row, index) => {
      const v = row[rowIdKey];
      return v == null ? String(index) : String(v);
    } : void 0,
    [rowIdKey]
  );
  const configOrder = useMemo(
    () => Object.values(config.columns).sort((a, b) => a.column_order - b.column_order).map((c) => c.column_id),
    [config.columns]
  );
  const [columnOrder, setColumnOrder] = useState(configOrder);
  const configOrderJson = JSON.stringify(configOrder);
  useEffect(() => {
    setColumnOrder(configOrder);
  }, [configOrderJson]);
  const handleColumnOrderChange = (next) => {
    setColumnOrder(next);
    onColumnReorder?.(next);
  };
  const initialGrouping = useMemo(
    () => Object.values(config.columns).filter((c) => !!c.group_by).sort((a, b) => a.column_order - b.column_order).map((c) => c.column_id),
    [config.columns]
  );
  const [grouping, setGrouping] = useState(initialGrouping);
  useEffect(() => {
    setGrouping(initialGrouping);
  }, [initialGrouping]);
  const [expanded, setExpanded] = useState({});
  const table = useReactTable({
    data: stagedData,
    columns,
    state: {
      sorting,
      globalFilter,
      columnPinning,
      columnFilters,
      columnOrder,
      grouping,
      expanded
    },
    initialState: { columnVisibility: initialVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onColumnOrderChange: (updater) => handleColumnOrderChange(
      typeof updater === "function" ? updater(columnOrder) : updater
    ),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onEnd",
    autoResetPageIndex: false,
    getRowId
  });
  const DENSITY_PAD = {
    compact: "px-2 py-0.5",
    standard: "px-3 py-1.5",
    comfortable: "px-3 py-2.5"
  };
  const cellPad = DENSITY_PAD[density];
  const headerClassName = config.stickyHeader ? "sticky top-0 z-10" : "";
  const bodyClassName = config.rowStriping ? "[&>tr:nth-child(even)]:bg-muted/20" : "";
  const rowWrapClass = config.wrapText ? "whitespace-normal" : "whitespace-nowrap";
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col h-full min-h-0 gap-3 overflow-hidden", "data-testid": "grid-preview", children: [
    /* @__PURE__ */ jsx("div", { className: "mx-auto w-full flex-1 flex flex-col min-h-0 transition-all overflow-hidden", style: { maxWidth: VIEWPORT_MAX[viewport] }, children: /* @__PURE__ */ jsxs("div", { className: "flex-1 flex flex-col min-h-0 space-y-2 overflow-hidden", children: [
      /* @__PURE__ */ jsx(
        GridHeader,
        {
          table,
          config,
          density,
          onDensityChange: cycleDensity,
          search: globalFilter,
          onSearchChange: setGlobalFilter,
          onExport: () => log.info({ gridId: config.gridId, action: "export" }, "GridPreview: export (noop)")
        }
      ),
      !liveApiRequested ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center justify-center gap-2.5 p-6 border rounded bg-muted/20 my-auto text-center", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-xs font-medium text-muted-foreground", children: [
          "Live API mode enabled for ",
          /* @__PURE__ */ jsx("code", { className: "text-foreground", children: activeBinding?.path ?? config.gridId }),
          "."
        ] }),
        /* @__PURE__ */ jsxs(
          Button,
          {
            type: "button",
            size: "sm",
            className: "gap-2",
            onClick: () => {
              setLiveApiRequested(true);
              liveApiState.refetch();
            },
            children: [
              /* @__PURE__ */ jsx(RotateCw, { className: "h-3.5 w-3.5" }),
              " Fetch Live Data"
            ]
          }
        )
      ] }) : /* @__PURE__ */ jsx("div", { className: "rounded border flex-1 min-h-0 overflow-auto", children: /* @__PURE__ */ jsx(
        DndColumnWrapper,
        {
          columnOrder,
          onOrderChange: handleColumnOrderChange,
          enabled: !!config.allowColumnReorder,
          children: /* @__PURE__ */ jsxs(Table, { children: [
            config.caption && /* @__PURE__ */ jsx("caption", { className: "caption-bottom text-muted-foreground text-xs py-1 px-2 text-left", children: config.caption }),
            /* @__PURE__ */ jsx(TableHeader, { className: headerClassName, children: table.getHeaderGroups().map((hg) => /* @__PURE__ */ jsx(TableRow, { className: "border-b bg-muted/90 backdrop-blur-sm", children: hg.headers.map((h) => {
              const pinnedSide = h.column.getIsPinned();
              const pinLeft = pinnedSide === "left" ? h.column.getStart("left") : void 0;
              const pinRight = pinnedSide === "right" ? h.column.getAfter("right") : void 0;
              const isDataCol = columnOrder.includes(h.column.id);
              return /* @__PURE__ */ jsx(
                SortableTableHead,
                {
                  header: h,
                  colConfig: config.columns[h.column.id],
                  gridSortAscColor: config.sortAscColor,
                  gridSortDescColor: config.sortDescColor,
                  className: cellPad,
                  sticky: pinnedSide === "left",
                  pinnedOffsetLeft: pinLeft,
                  pinnedOffsetRight: pinRight,
                  tooltipDelayDuration: config.tooltipDelayDuration,
                  gridId: config.gridId,
                  dndId: config.allowColumnReorder && isDataCol ? h.column.id : void 0
                },
                h.id
              );
            }) }, hg.id)) }),
            /* @__PURE__ */ jsx(TableBody, { className: bodyClassName, children: table.getRowModel().rows.map((row, idx) => {
              const rank = idx + 1;
              const isGroupedRow = row.getIsGrouped();
              const previewRow = row.original;
              const rowKeyForRow = config.rowKeyColumn ? previewRow[config.rowKeyColumn] : void 0;
              const rowAccentStyle = !isGroupedRow ? resolveRowAccent(previewRow) : void 0;
              return /* @__PURE__ */ jsx(
                TableRow,
                {
                  "data-testid": isGroupedRow ? "grid-preview-group-row" : "grid-preview-leaf-row",
                  className: cn(
                    "border-b border-border/50 transition-colors",
                    !config.hoverColor && "hover:bg-muted/30",
                    rowWrapClass,
                    config.showRankHighlight && !isGroupedRow && getRankRowClass(rank),
                    isGroupedRow && "bg-muted/40 font-medium",
                    rowAccentStyle && "border-l-2 border-l-[color:var(--team-accent)]"
                  ),
                  style: rowAccentStyle,
                  onMouseEnter: config.hoverColor ? (e) => {
                    e.currentTarget.style.backgroundColor = config.hoverColor;
                  } : void 0,
                  onMouseLeave: config.hoverColor ? (e) => {
                    e.currentTarget.style.backgroundColor = "";
                  } : void 0,
                  children: row.getVisibleCells().map((cell) => {
                    const isFlashing = config.liveUpdateHighlight && rowKeyForRow != null && flashKeys.has(`${rowKeyForRow}:${cell.column.id}`);
                    const align = cell.column.columnDef.meta?.align || "left";
                    const pinnedSide = cell.column.getIsPinned();
                    const pinLeft = pinnedSide === "left" ? cell.column.getStart("left") : void 0;
                    const pinRight = pinnedSide === "right" ? cell.column.getAfter("right") : void 0;
                    const isGrouped = cell.getIsGrouped();
                    const isPlaceholder = cell.getIsPlaceholder();
                    const isAggregated = cell.getIsAggregated();
                    let content;
                    if (isGrouped) {
                      const childCount = row.subRows.length;
                      content = /* @__PURE__ */ jsxs(
                        "button",
                        {
                          type: "button",
                          onClick: row.getToggleExpandedHandler(),
                          className: "inline-flex items-center gap-1 text-left hover:text-foreground",
                          "aria-expanded": row.getIsExpanded(),
                          "aria-label": `Toggle ${cell.column.id} group`,
                          children: [
                            row.getIsExpanded() ? /* @__PURE__ */ jsx(ChevronDown, { className: "h-3 w-3" }) : /* @__PURE__ */ jsx(ChevronRight, { className: "h-3 w-3" }),
                            /* @__PURE__ */ jsx("span", { children: flexRender(cell.column.columnDef.cell, cell.getContext()) }),
                            /* @__PURE__ */ jsxs("span", { className: "text-muted-foreground text-[11px]", children: [
                              "(",
                              childCount,
                              ")"
                            ] })
                          ]
                        }
                      );
                    } else if (isAggregated) {
                      content = flexRender(
                        cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                        cell.getContext()
                      );
                    } else if (isPlaceholder) {
                      content = null;
                    } else {
                      content = flexRender(cell.column.columnDef.cell, cell.getContext());
                    }
                    return /* @__PURE__ */ jsx(
                      TableCell,
                      {
                        className: cn(
                          `${cellPad} text-${align}`,
                          pinnedSide === "left" && "sticky z-10 bg-card",
                          pinnedSide === "right" && "sticky z-10 bg-card",
                          isFlashing && "animate-live-pulse"
                        ),
                        style: {
                          ...pinLeft !== void 0 ? { left: pinLeft } : {},
                          ...pinRight !== void 0 ? { right: pinRight } : {}
                        },
                        children: content
                      },
                      cell.id
                    );
                  })
                },
                row.id
              );
            }) }),
            hasAggregates(config.columns) && /* @__PURE__ */ jsx(TableFooter, { children: /* @__PURE__ */ jsx(TableRow, { className: "border-t-2 border-border bg-muted/40 font-medium text-xs", children: table.getVisibleLeafColumns().map((leaf) => {
              const colConfig = config.columns[leaf.id];
              const aggFn = colConfig?.aggregate_function;
              if (!aggFn) return /* @__PURE__ */ jsx(TableCell, { className: cellPad }, leaf.id);
              const result = computeAggValue(
                stagedData,
                leaf.id,
                aggFn
              );
              const display = formatAggValue(result, colConfig?.format_string);
              return /* @__PURE__ */ jsx(
                TableCell,
                {
                  className: `${cellPad} text-${colConfig?.text_align || "right"} tabular-nums`,
                  children: display
                },
                leaf.id
              );
            }) }) })
          ] })
        }
      ) }),
      config.footer && /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground pt-1", children: config.footer })
    ] }) }),
    /* @__PURE__ */ jsxs(
      Collapsible,
      {
        open: datasetDrawerOpen,
        onOpenChange: setDatasetDrawerOpen,
        className: "shrink-0 mt-auto",
        children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3 rounded-t-lg border border-dashed bg-background px-3 py-2", children: [
            /* @__PURE__ */ jsxs(
              CollapsibleTrigger,
              {
                className: "flex items-center gap-2 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded",
                "aria-label": "Toggle preview data drawer",
                "data-testid": "preview-dataset-trigger",
                children: [
                  /* @__PURE__ */ jsx(
                    ChevronDown,
                    {
                      className: cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                        !datasetDrawerOpen && "-rotate-90"
                      )
                    }
                  ),
                  /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wide", children: "Preview data" }),
                  /* @__PURE__ */ jsx(Badge, { variant: "outline", className: "text-[10px]", children: "not saved" }),
                  /* @__PURE__ */ jsx("span", { className: "text-[11px] text-muted-foreground", children: `Live API (${effectiveRows.length} row${effectiveRows.length === 1 ? "" : "s"})` })
                ]
              }
            ),
            /* @__PURE__ */ jsx("div", { className: "ml-auto flex items-center gap-2", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
              /* @__PURE__ */ jsx(Label, { className: "text-[11px] text-muted-foreground", children: "Viewport" }),
              /* @__PURE__ */ jsx(
                SegmentedControl,
                {
                  size: "sm",
                  value: viewport,
                  onChange: (v) => {
                    setViewport(v);
                    log.info(
                      { gridId: config.gridId, action: "preview-viewport", viewport: v },
                      "GridPreview: viewport changed"
                    );
                  },
                  options: [
                    { value: "desktop", label: "Desktop" },
                    { value: "tablet", label: "Tablet" },
                    { value: "mobile", label: "Mobile" }
                  ]
                }
              )
            ] }) })
          ] }),
          /* @__PURE__ */ jsx(CollapsibleContent, { className: "overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-3 rounded-b-lg border border-t-0 border-dashed bg-background px-3 py-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-end gap-3 border-b pb-2", children: [
              apiBindings.length > 1 && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                /* @__PURE__ */ jsx(Label, { className: "text-[11px] text-muted-foreground", children: "Associated API" }),
                /* @__PURE__ */ jsxs(Select, { value: selectedBindingId, onValueChange: setSelectedBindingId, children: [
                  /* @__PURE__ */ jsx(SelectTrigger, { size: "sm", className: "w-64", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
                  /* @__PURE__ */ jsx(SelectContent, { children: apiBindings.map((b) => /* @__PURE__ */ jsx(SelectItem, { value: b.id, children: b.label }, b.id)) })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                /* @__PURE__ */ jsx(Label, { htmlFor: "live-api-limit", className: "text-[11px] text-muted-foreground", children: "Limit rows" }),
                /* @__PURE__ */ jsxs(
                  Select,
                  {
                    value: String(apiRowLimit),
                    onValueChange: (v) => setApiRowLimit(Number(v)),
                    children: [
                      /* @__PURE__ */ jsx(SelectTrigger, { id: "live-api-limit", size: "sm", "aria-label": "Limit rows", className: "w-24", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
                      /* @__PURE__ */ jsx(SelectContent, { children: [5, 10, 25, 50, 100].map((n) => /* @__PURE__ */ jsx(SelectItem, { value: String(n), children: n }, n)) })
                    ]
                  }
                )
              ] }),
              activeBinding && /* @__PURE__ */ jsx("div", { className: "ml-auto flex items-center gap-2", children: /* @__PURE__ */ jsxs(
                Button,
                {
                  type: "button",
                  variant: "outline",
                  size: "sm",
                  className: "gap-1.5",
                  onClick: () => liveApiState.refetch(),
                  disabled: liveApiState.isLoading,
                  children: [
                    /* @__PURE__ */ jsx(RotateCw, { className: cn("h-3.5 w-3.5", liveApiState.isLoading && "animate-spin") }),
                    "Refresh"
                  ]
                }
              ) })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "space-y-2", children: activeBinding ? /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsxs("div", { className: "text-xs font-semibold text-muted-foreground mb-1", children: [
                "API Parameters: ",
                /* @__PURE__ */ jsx("code", { className: "text-foreground", children: activeBinding.path })
              ] }),
              activeBinding.params.length === 0 ? /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground italic", children: "No parameters required for this endpoint." }) : /* @__PURE__ */ jsx("div", { className: "flex flex-wrap items-center gap-3", children: activeBinding.params.map((p) => /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
                /* @__PURE__ */ jsx(Label, { className: "text-[11px] text-muted-foreground", children: p.label }),
                p.type === "select" && p.options ? /* @__PURE__ */ jsxs(
                  Select,
                  {
                    value: String(paramValues[p.name] ?? p.defaultValue),
                    onValueChange: (v) => setParamValues((prev) => ({ ...prev, [p.name]: v })),
                    children: [
                      /* @__PURE__ */ jsx(SelectTrigger, { size: "sm", className: "w-32", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
                      /* @__PURE__ */ jsx(SelectContent, { children: p.options.map((opt) => /* @__PURE__ */ jsx(SelectItem, { value: String(opt.value), children: opt.label }, String(opt.value))) })
                    ]
                  }
                ) : /* @__PURE__ */ jsx(
                  Input,
                  {
                    type: p.type === "number" ? "number" : "text",
                    value: paramValues[p.name] ?? "",
                    onChange: (e) => {
                      const val = p.type === "number" ? Number(e.target.value) : e.target.value;
                      setParamValues((prev) => ({ ...prev, [p.name]: val }));
                    },
                    className: "h-8 w-28 text-xs"
                  }
                )
              ] }, p.name)) }),
              liveApiState.isError && /* @__PURE__ */ jsxs("div", { className: "mt-2 flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded p-2", children: [
                /* @__PURE__ */ jsx(AlertCircle, { className: "h-4 w-4 shrink-0 text-destructive" }),
                /* @__PURE__ */ jsx("span", { children: liveApiState.errorMessage || "Failed to load live data." })
              ] })
            ] }) : /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground italic", children: [
              "No associated API endpoint registered for grid ID `",
              config.gridId,
              "`. Register an endpoint binding to preview this grid."
            ] }) })
          ] }) })
        ]
      }
    )
  ] });
}
export {
  GridPreview as default
};
//# sourceMappingURL=GridPreview.js.map
