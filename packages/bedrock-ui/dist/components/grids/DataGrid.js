import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useMemo, useState, useRef, useCallback, useEffect, useImperativeHandle, Fragment as Fragment$1 } from "react";
import { useNavigate } from "react-router-dom";
import { createColumnHelper, useReactTable, getExpandedRowModel, getGroupedRowModel, getFilteredRowModel, getSortedRowModel, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip.js";
import { Table, TableHeader, TableRow, TableBody, TableFooter, TableCell } from "../ui/table.js";
import { ChevronDown, ChevronRight, Undo2, Save } from "lucide-react";
import { Button } from "../ui/button.js";
import { cn } from "../../lib/utils.js";
import { toast } from "sonner";
import GridHeader from "./GridHeader.js";
import GridWrapper from "../GridWrapper.js";
import { SortableTableHead } from "../SortableTableHead.js";
import { EmptyTableRow } from "../EmptyTableRow.js";
import { GridStatusContent } from "../GridStatus.js";
import { log } from "../../utils/logger.js";
import { useTableState } from "../../hooks/useTableState.js";
import { useAuth } from "../../hooks/useAuth.js";
import { useDensity, DENSITY_ROW_HEIGHT } from "../../hooks/useDensity.js";
import { useSelectionStore } from "../../store/selectionStore.js";
import { useAdmin } from "../../hooks/useAdminPlatform.js";
import { DndColumnWrapper } from "../../hooks/useDraggableColumns.js";
import { useRowAccentResolver } from "./rowAccentRegistry.js";
import { hasDashboardPinHost } from "./dashboardPinRegistry.js";
import { unwrapCellPayload, renderMediaCell, renderCell } from "./cellRenderers.js";
import EditableCell from "./EditableCell.js";
import useCellSelection from "./useCellSelection.js";
import { cellPositionClasses } from "./cellPosition.js";
import { applyColumnSizing, computeColumnMinMax, getGradientCellStyle, prependRankColumn, prependSelectionColumn, hasAggregates, computeAggValue, formatAggValue } from "../../utils/gridUtils.js";
import { getRankRowClass } from "../../utils/rankStyle.js";
import { applyDraft, isDirty } from "./bulkDraftStore.js";
import { useRowClickHandler } from "../../hooks/useRowClickHandler.js";
const ENGINE_COLUMN_IDS = /* @__PURE__ */ new Set(["__expander__", "ranking", "_compare"]);
function DefaultColHeader({
  label,
  tooltip,
  delayDuration
}) {
  if (!tooltip) return /* @__PURE__ */ jsx("span", { children: label });
  return /* @__PURE__ */ jsx(TooltipProvider, { delayDuration, children: /* @__PURE__ */ jsxs(Tooltip, { children: [
    /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx("span", { className: "underline decoration-dotted cursor-help", children: label }) }),
    /* @__PURE__ */ jsx(TooltipContent, { side: "top", className: "text-xs", children: tooltip })
  ] }) });
}
function DataGrid({
  gridId,
  gridRef,
  rows,
  isLoading = false,
  filtersSlot,
  onRowClick,
  onExport,
  customCells,
  customHeaders,
  headerTooltips,
  emptyMessage = "No rows match the current filters.",
  searchPlaceholder = "Search…",
  loadingMessage,
  accessorFor,
  selectionOverride,
  selectionOptions,
  onReorderColumns,
  isEmbedded = false,
  customToolbar,
  columnVisibilityOverride,
  variant = "default",
  overscan = 10,
  virtualizedMaxHeightClass = "max-h-[70vh]",
  prependColumns,
  rowClassNameFor,
  onCellCommit,
  onBulkCommit,
  bulkDirtyOverride = false,
  draftsOverride,
  renderSubRow,
  cellSelection = false,
  onRangeCopy,
  onRangePaste,
  onRangeFill
}) {
  const isVirtualized = variant === "virtualized";
  const navigate = useNavigate();
  const { logExport } = useAdmin();
  const { isAuthenticated } = useAuth();
  const showDashboardPinButton = isAuthenticated && hasDashboardPinHost() && gridId !== "dashboard" && gridId !== "player_pins";
  const {
    config,
    sorting,
    setSorting,
    columnVisibility: baseColumnVisibility,
    setColumnVisibility,
    headerClassName,
    bodyClassName,
    rowClassName,
    isLoaded,
    pinnedFilters,
    persistFilters,
    columnOrder: mergedColumnOrder,
    persistColumnOrder,
    dashboardPin,
    setDashboardPin
  } = useTableState(gridId);
  const columnVisibility = useMemo(() => {
    if (!columnVisibilityOverride) return baseColumnVisibility;
    return { ...baseColumnVisibility, ...columnVisibilityOverride };
  }, [baseColumnVisibility, columnVisibilityOverride]);
  const { density, cellPad, cycleDensity } = useDensity(config.denseMode);
  const [globalFilter, setGlobalFilter] = useState("");
  const bulkMode = !!onBulkCommit || !!draftsOverride;
  const [internalDrafts, setInternalDrafts] = useState({});
  const bulkDrafts = draftsOverride ? draftsOverride.drafts : internalDrafts;
  const draftsRef = useRef(bulkDrafts);
  draftsRef.current = bulkDrafts;
  const draftsOverrideRef = useRef(draftsOverride);
  draftsOverrideRef.current = draftsOverride;
  const setBulkDrafts = useCallback(
    (updater) => {
      const next = typeof updater === "function" ? updater(draftsRef.current) : updater;
      const override = draftsOverrideRef.current;
      if (override) override.onChange(next);
      else setInternalDrafts(next);
    },
    []
  );
  const [bulkSaving, setBulkSaving] = useState(false);
  const setBulkDraft = useCallback(
    (rowKey, columnId, nextValue, originalValue) => {
      setBulkDrafts(
        (prev) => applyDraft(prev, { rowKey, columnId, nextValue, originalValue })
      );
    },
    [setBulkDrafts]
  );
  const discardBulkDrafts = useCallback(() => setBulkDrafts({}), [setBulkDrafts]);
  const bulkDirtyEngine = isDirty(bulkDrafts);
  const bulkDirty = bulkDirtyEngine || bulkDirtyOverride;
  const saveBulkDrafts = useCallback(async () => {
    if (!onBulkCommit) return;
    setBulkSaving(true);
    try {
      await onBulkCommit(bulkDrafts);
      setBulkDrafts({});
    } catch (err) {
      toast.error("Could not save changes", {
        description: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setBulkSaving(false);
    }
  }, [onBulkCommit, bulkDrafts, setBulkDrafts]);
  const resolveRowAccent = useRowAccentResolver(config.rowAccentReactive);
  const prevRowsRef = useRef(null);
  const [flashKeys, setFlashKeys] = useState(/* @__PURE__ */ new Set());
  useEffect(() => {
    const rowKeyCol = config.rowKeyColumn;
    if (!config.liveUpdateHighlight || !rowKeyCol) {
      prevRowsRef.current = null;
      return;
    }
    const nextMap = {};
    for (const row of rows) {
      const key = row[rowKeyCol];
      if (key == null) continue;
      nextMap[String(key)] = row;
    }
    const prev = prevRowsRef.current;
    prevRowsRef.current = nextMap;
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
  }, [rows, config.liveUpdateHighlight, config.rowKeyColumn, config.columns]);
  const columnPinning = useMemo(() => {
    if (!isLoaded) return { left: [], right: [] };
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
  }, [isLoaded, config.columns, config.stickyFirstColumn]);
  const initialColumnFilters = useMemo(() => {
    if (!isLoaded) return [];
    if (pinnedFilters !== null) return pinnedFilters;
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
  }, [isLoaded, config.columns, pinnedFilters]);
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const columnFiltersMountedRef = useRef(false);
  useEffect(() => {
    if (!columnFiltersMountedRef.current) {
      columnFiltersMountedRef.current = true;
      return;
    }
    persistFilters(columnFilters);
  }, [columnFilters, persistFilters]);
  const { selectedIdsByGrid, setSelected } = useSelectionStore();
  const selectedIds = selectionOverride ? selectionOverride.selectedIds : selectedIdsByGrid[gridId] ?? [];
  const onSelectionChange = selectionOverride ? selectionOverride.onChange : (ids) => setSelected(gridId, ids);
  const colHelper = useMemo(() => createColumnHelper(), []);
  const [editRequest, setEditRequest] = useState(null);
  const editableColumnIds = useMemo(() => {
    const ids = /* @__PURE__ */ new Set();
    if (config.readOnly || !onCellCommit && !bulkMode) return ids;
    for (const col of Object.values(config.columns)) {
      if (col.editable && !customCells?.[col.column_id]) ids.add(col.column_id);
    }
    return ids;
  }, [config.columns, config.readOnly, onCellCommit, bulkMode, customCells]);
  const columns = useMemo(() => {
    if (!isLoaded) return [];
    const baseCols = Object.values(config.columns).sort((a, b) => a.column_order - b.column_order).map((col) => {
      const sizing = applyColumnSizing(col, config.minColumnWidth);
      const columnId = col.column_id;
      const label = col.label_override || columnId.toUpperCase();
      const tooltip = col.tooltip_override ?? headerTooltips?.[label] ?? headerTooltips?.[columnId] ?? null;
      const accessorKey = accessorFor?.(columnId) ?? columnId;
      return colHelper.accessor(accessorKey, {
        id: columnId,
        header: () => {
          const custom = customHeaders?.[columnId];
          if (custom) {
            return custom({
              column_id: columnId,
              label,
              tooltip,
              delayDuration: config.tooltipDelayDuration
            });
          }
          return /* @__PURE__ */ jsx(
            DefaultColHeader,
            {
              label,
              tooltip,
              delayDuration: config.tooltipDelayDuration
            }
          );
        },
        size: sizing.size,
        minSize: sizing.minSize,
        maxSize: sizing.maxSize,
        enableHiding: !col.read_only,
        // Phase 2: sort mode enum. `"none"` disables sorting entirely;
        // `"asc"`/`"desc"` keep enableSorting=true and rely on
        // SortableTableHead's toggle interceptor to clamp direction.
        // Falls back to the legacy allow_sort boolean when the enum
        // hasn't been backfilled yet.
        enableSorting: col.allow_sort_mode !== void 0 ? col.allow_sort_mode !== "none" : !!col.allow_sort,
        // Phase 3 column-stub wiring
        enableColumnFilter: !!col.allow_filter,
        enableResizing: !!col.resizable,
        enableGrouping: !!col.group_by,
        cell: (info) => {
          const rawValue = info.getValue();
          const row = info.row.original;
          const rowIndex = info.row.index;
          const { value: rawUnwrapped, meta } = unwrapCellPayload(rawValue);
          const rowRecord = row;
          const cellRowKey = config.rowKeyColumn ? rowRecord[config.rowKeyColumn] : void 0;
          const draftForCell = bulkMode && cellRowKey != null ? bulkDrafts[String(cellRowKey)]?.[columnId] : void 0;
          const value = draftForCell !== void 0 ? draftForCell : rawUnwrapped;
          let gradientStyle;
          if (col.gradient_from_color && col.gradient_to_color) {
            const minMax = computeColumnMinMax(
              rows,
              columnId
            );
            if (minMax && typeof value === "number") {
              gradientStyle = getGradientCellStyle(
                value,
                minMax.min,
                minMax.max,
                col.gradient_from_color,
                col.gradient_to_color
              );
            }
          }
          let content;
          const override = customCells?.[columnId];
          if (override) {
            content = override({
              value,
              row,
              rowIndex,
              column_id: columnId,
              colConfig: col,
              gradientStyle,
              rowKey: cellRowKey != null ? String(cellRowKey) : null,
              draftValue: draftForCell,
              setDraft: (nextValue) => {
                if (cellRowKey == null) return;
                setBulkDraft(String(cellRowKey), columnId, nextValue, rawUnwrapped);
              }
            });
          } else {
            const rowWithMeta = { ...rowRecord, ...meta };
            const media = renderMediaCell(col.cell_type, value, rowWithMeta);
            if (media !== void 0) {
              content = media;
            } else {
              content = renderCell(
                value,
                col,
                columnId,
                gradientStyle,
                navigate,
                rowRecord.player_id,
                { meta, row: rowRecord },
                config.numeralStyle
              );
            }
          }
          const rowKeyValue = cellRowKey;
          const canEdit = !!col.editable && !override && (!!onCellCommit || bulkMode) && !config.readOnly && rowKeyValue != null;
          if (canEdit) {
            return /* @__PURE__ */ jsx(
              EditableCell,
              {
                rawValue: value,
                cellType: col.cell_type,
                openWith: editRequest && editRequest.rowKey === String(rowKeyValue) && editRequest.columnId === columnId ? { seed: editRequest.seed, nonce: editRequest.nonce } : null,
                onCommit: (next) => {
                  if (bulkMode) {
                    setBulkDraft(
                      String(rowKeyValue),
                      columnId,
                      next,
                      rawUnwrapped
                    );
                    return;
                  }
                  return onCellCommit(String(rowKeyValue), columnId, next);
                },
                children: content
              }
            );
          }
          return content;
        },
        meta: { align: col.text_align, label }
      });
    });
    const baseWithPrepend = prependColumns ? [...prependColumns, ...baseCols] : baseCols;
    const withRank = prependRankColumn(
      baseWithPrepend,
      config.showRanking,
      colHelper,
      config.showRankHighlight,
      "end"
    );
    const withExpander = config.allowExpansion && renderSubRow ? [
      colHelper.display({
        id: "__expander__",
        size: 32,
        minSize: 24,
        enableHiding: false,
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const detail = renderSubRow(row.original, row.index);
          if (detail == null) return null;
          const isExpanded = row.getIsExpanded();
          return /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: (e) => {
                e.stopPropagation();
                row.toggleExpanded();
              },
              className: "text-muted-foreground hover:text-foreground transition-colors p-1",
              "aria-expanded": isExpanded,
              "aria-label": isExpanded ? "Collapse row" : "Expand row",
              children: isExpanded ? /* @__PURE__ */ jsx(ChevronDown, { className: "h-3.5 w-3.5" }) : /* @__PURE__ */ jsx(ChevronRight, { className: "h-3.5 w-3.5" })
            }
          );
        }
      }),
      ...withRank
    ] : withRank;
    if (!config.rowKeyColumn) {
      throw new Error(
        `DataGrid[${gridId}]: config.rowKeyColumn is required but is null/undefined. Seed row_key_column in app_grid_settings for this grid — the engine no longer accepts a rowKey prop fallback.`
      );
    }
    const resolvedRowKey = config.rowKeyColumn;
    return prependSelectionColumn(
      withExpander,
      !!config.allowSelection,
      selectedIds,
      onSelectionChange,
      resolvedRowKey,
      config.selectionPosition,
      selectionOptions
    );
  }, [
    isLoaded,
    config.columns,
    config.showRanking,
    config.allowSelection,
    config.selectionPosition,
    selectionOptions,
    config.rowKeyColumn,
    config.minColumnWidth,
    config.tooltipDelayDuration,
    config.numeralStyle,
    rows,
    navigate,
    selectedIds,
    onSelectionChange,
    gridId,
    customCells,
    customHeaders,
    headerTooltips,
    colHelper,
    accessorFor,
    prependColumns,
    onCellCommit,
    editRequest,
    config.readOnly,
    config.allowExpansion,
    renderSubRow,
    bulkMode,
    bulkDrafts,
    setBulkDraft
  ]);
  const rowIdKey = config.rowKeyColumn || void 0;
  const getRowId = useMemo(
    () => rowIdKey ? (row, index) => {
      const v = row[rowIdKey];
      return v == null ? String(index) : String(v);
    } : void 0,
    [rowIdKey]
  );
  const configOrder = mergedColumnOrder;
  const [columnOrder, setColumnOrder] = useState(configOrder);
  const configOrderJson = JSON.stringify(configOrder);
  useEffect(() => {
    setColumnOrder(configOrder);
  }, [configOrderJson]);
  const handleColumnOrderChange = (next) => {
    setColumnOrder(next);
    persistColumnOrder(next);
    onReorderColumns?.(next);
  };
  const initialGrouping = useMemo(
    () => isLoaded ? Object.values(config.columns).filter((c) => !!c.group_by).sort((a, b) => a.column_order - b.column_order).map((c) => c.column_id) : [],
    [isLoaded, config.columns]
  );
  const [grouping, setGrouping] = useState(initialGrouping);
  const initialGroupingKey = initialGrouping.join(",");
  useEffect(() => {
    setGrouping(initialGrouping);
  }, [initialGroupingKey]);
  const [expanded, setExpanded] = useState({});
  const isGrouped = grouping.length > 0;
  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      columnPinning,
      columnFilters,
      columnOrder,
      grouping,
      expanded
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
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
    // Phase 3: column resizing. Individual columns opt in via `resizable`
    // in admin config; the top-level flag just tells TanStack to track
    // resize state. onEnd → single re-layout at drag release keeps the
    // draw cost low even on wide grids.
    enableColumnResizing: true,
    columnResizeMode: "onEnd",
    autoResetPageIndex: false,
    getRowId
  });
  const sortedRows = table.getSortedRowModel().rows.map((r) => r.original);
  const selectionRowModel = table.getSortedRowModel().rows;
  const sortedRowKeys = useMemo(
    () => selectionRowModel.map((r) => r.id),
    [selectionRowModel]
  );
  const cellRowKeys = useMemo(
    () => cellSelection ? sortedRowKeys : [],
    [cellSelection, sortedRowKeys]
  );
  useImperativeHandle(
    gridRef,
    () => ({ getSortedRowKeys: () => sortedRowKeys }),
    [sortedRowKeys]
  );
  const visibleLeafColumns = table.getVisibleLeafColumns();
  const cellColumnIds = useMemo(
    () => cellSelection ? visibleLeafColumns.map((c) => c.id).filter((id) => !ENGINE_COLUMN_IDS.has(id)) : [],
    [cellSelection, visibleLeafColumns]
  );
  const rowsByKey = useMemo(() => {
    if (!cellSelection) return /* @__PURE__ */ new Map();
    return new Map(selectionRowModel.map((r) => [r.id, r]));
  }, [cellSelection, selectionRowModel]);
  const getCellText = useCallback(
    (rowKey, columnId) => {
      const row = rowsByKey.get(rowKey);
      if (!row) return "";
      const cell = row.getVisibleCells().find((c) => c.column.id === columnId);
      if (!cell) return "";
      const { value } = unwrapCellPayload(cell.getValue());
      return value == null ? "" : String(value);
    },
    [rowsByKey]
  );
  const cells = useCellSelection({
    enabled: cellSelection,
    rowKeys: cellRowKeys,
    columnIds: cellColumnIds,
    getCellText,
    onCopy: onRangeCopy,
    onPaste: onRangePaste,
    onFill: onRangeFill,
    // Decline for a column nothing can edit, so Enter still moves the cursor
    // down and a printable character still does nothing — exactly as before.
    onBeginEdit: (cell, seed) => {
      if (!editableColumnIds.has(cell.columnId)) return false;
      setEditRequest((prev) => ({
        rowKey: cell.rowKey,
        columnId: cell.columnId,
        seed,
        nonce: (prev?.nonce ?? 0) + 1
      }));
      return true;
    }
  });
  const scrollRef = useRef(null);
  const estimateSize = useCallback(
    () => DENSITY_ROW_HEIGHT[density],
    [density]
  );
  const virtualizedRowCount = isVirtualized ? table.getRowModel().rows.length : 0;
  const rowVirtualizer = useVirtualizer({
    count: virtualizedRowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan
  });
  useEffect(() => {
    if (isVirtualized) rowVirtualizer.measure();
  }, [density, isVirtualized, rowVirtualizer]);
  const virtualResetKey = `${globalFilter}::${JSON.stringify(sorting)}::${JSON.stringify(columnFilters)}`;
  useEffect(() => {
    if (isVirtualized) rowVirtualizer.scrollToOffset(0);
  }, [virtualResetKey, isVirtualized]);
  function defaultExport(paginatedRows) {
    logExport({ export_type: "csv", page: gridId, row_count: paginatedRows.length });
    const headers = table.getVisibleLeafColumns().map((c) => (c.id || "").toUpperCase());
    const csvRows = [
      headers.join(","),
      ...paginatedRows.map(
        (r) => table.getVisibleLeafColumns().map((c) => {
          const v = r[c.id];
          return v == null ? "" : String(v);
        }).join(",")
      )
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${gridId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${paginatedRows.length} rows`, { description: `${gridId}.csv` });
  }
  if (isLoading || !isLoaded) {
    return /* @__PURE__ */ jsx(GridStatusContent, { type: "loading", message: loadingMessage });
  }
  if (config.isUnseeded) {
    log.error(
      { gridId, action: "grid_unseeded" },
      "DataGrid: no app_grid_settings row exists for this grid id"
    );
    return /* @__PURE__ */ jsx(
      GridStatusContent,
      {
        type: "error",
        message: `Grid "${gridId}" is not configured — no row exists for it in app_grid_settings.`
      }
    );
  }
  const renderTableSurface = (paginatedRows) => /* @__PURE__ */ jsx(
    DndColumnWrapper,
    {
      columnOrder,
      onOrderChange: handleColumnOrderChange,
      enabled: !!config.allowColumnReorder,
      children: /* @__PURE__ */ jsxs(Table, { className: config.denseMode ? "table-fixed" : "", children: [
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
              sticky: pinnedSide === "left" || config.columns[h.column.id]?.link_target === "player_page",
              pinnedOffsetLeft: pinLeft,
              pinnedOffsetRight: pinRight,
              tooltipDelayDuration: config.tooltipDelayDuration,
              gridId,
              dndId: config.allowColumnReorder && isDataCol ? h.column.id : void 0
            },
            h.id
          );
        }) }, hg.id)) }),
        /* @__PURE__ */ jsx(TableBody, { className: bodyClassName, children: (() => {
          const rowsToRender = isVirtualized ? table.getRowModel().rows : isGrouped ? table.getRowModel().rows : paginatedRows.map(
            (data) => table.getRowModel().rows.find((r) => r.original === data)
          ).filter((r) => !!r);
          if (rowsToRender.length === 0) {
            return /* @__PURE__ */ jsx(EmptyTableRow, { colSpan: columns.length, message: emptyMessage });
          }
          const renderDataRow = (row, renderIndex) => {
            const rank = table.getRowModel().rows.indexOf(row) + 1;
            const wrapClass = config.wrapText ? "" : "whitespace-nowrap";
            const isGroupedRow = row.getIsGrouped();
            const data = row.original;
            const dataRecord = data;
            const rowKeyForRow = config.rowKeyColumn ? dataRecord[config.rowKeyColumn] : void 0;
            const rowAccentStyle = !isGroupedRow ? resolveRowAccent(dataRecord) : void 0;
            const subRowContent = config.allowExpansion && renderSubRow && !isGroupedRow ? renderSubRow(data, renderIndex) : null;
            const isExpanded = subRowContent != null && row.getIsExpanded();
            const visibleColSpan = row.getVisibleCells().length;
            const mainRow = /* @__PURE__ */ jsx(
              TableRow,
              {
                "data-grouped": isGroupedRow || void 0,
                className: cn(
                  "border-b border-border/50 transition-colors",
                  onRowClick && !isGroupedRow && "cursor-pointer",
                  !config.hoverColor && !isGroupedRow && "hover:bg-muted/30",
                  !isGroupedRow && rowClassName,
                  config.showRankHighlight && !isGroupedRow && getRankRowClass(rank),
                  wrapClass,
                  isGroupedRow && "bg-muted/40 font-medium",
                  // Phase 8 H2: per-row data-driven class overlay for
                  // embedded consumers (e.g. career-total vs stint-child
                  // vs season-header row styling).
                  !isGroupedRow && rowClassNameFor?.(data, renderIndex),
                  // Phase 3 §S9: row-accent left-border tint.
                  rowAccentStyle && "border-l-2 border-l-[color:var(--team-accent)]"
                ),
                style: rowAccentStyle,
                onMouseEnter: config.hoverColor && !isGroupedRow ? (e) => {
                  e.currentTarget.style.backgroundColor = config.hoverColor;
                } : void 0,
                onMouseLeave: config.hoverColor && !isGroupedRow ? (e) => {
                  e.currentTarget.style.backgroundColor = "";
                } : void 0,
                onClick: onRowClick && !isGroupedRow ? () => onRowClick(data, renderIndex) : void 0,
                children: row.getVisibleCells().map((cell) => {
                  const align = cell.column.columnDef.meta?.align || "left";
                  const colConfig = config.columns[cell.column.id];
                  const pinnedSide = cell.column.getIsPinned();
                  const isNameCol = colConfig?.link_target === "player_page";
                  const pinLeft = pinnedSide === "left" ? cell.column.getStart("left") : void 0;
                  const pinRight = pinnedSide === "right" ? cell.column.getAfter("right") : void 0;
                  const sortDir = cell.column.getIsSorted();
                  const cellSortBg = !isGroupedRow && sortDir === "asc" ? colConfig?.sort_asc_color ?? config.sortAscColor ?? null : !isGroupedRow && sortDir === "desc" ? colConfig?.sort_desc_color ?? config.sortDescColor ?? null : null;
                  const isFlashing = config.liveUpdateHighlight && rowKeyForRow != null && flashKeys.has(`${rowKeyForRow}:${cell.column.id}`);
                  let content;
                  if (cell.getIsGrouped()) {
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
                  } else if (cell.getIsAggregated()) {
                    content = flexRender(
                      cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                      cell.getContext()
                    );
                  } else if (cell.getIsPlaceholder()) {
                    content = null;
                  } else {
                    content = flexRender(cell.column.columnDef.cell, cell.getContext());
                  }
                  const cellMaxWidth = cell.column.getSize?.() ?? cell.column.columnDef.size;
                  const { value: cellPlainValue } = unwrapCellPayload(cell.getValue());
                  const titleText = typeof cellPlainValue === "string" || typeof cellPlainValue === "number" ? String(cellPlainValue) : void 0;
                  const isCellSelectable = cells.enabled && !ENGINE_COLUMN_IDS.has(cell.column.id);
                  const isCellFocused = isCellSelectable && cells.isFocused(row.id, cell.column.id);
                  const isCellSelected = isCellSelectable && cells.isSelected(row.id, cell.column.id);
                  const isCellFillPreview = isCellSelectable && cells.isFillPreview(row.id, cell.column.id);
                  const showFillHandle = isCellSelectable && !!onRangeFill && cells.isFillOrigin(row.id, cell.column.id);
                  return /* @__PURE__ */ jsxs(
                    TableCell,
                    {
                      title: titleText,
                      "data-row-key": row.id,
                      "data-column-id": cell.column.id,
                      "data-cell-focused": isCellFocused || void 0,
                      "data-cell-selected": isCellSelected || void 0,
                      onMouseDown: isCellSelectable ? (event) => cells.onCellMouseDown(row.id, cell.column.id, event) : void 0,
                      onMouseEnter: isCellSelectable ? () => cells.onCellMouseEnter(row.id, cell.column.id) : void 0,
                      onDoubleClick: isCellSelectable ? () => cells.onCellDoubleClick(row.id, cell.column.id) : void 0,
                      className: cn(
                        `${cellPad} text-${align}`,
                        "overflow-hidden text-ellipsis",
                        // One decision, one class — see cellPosition.ts for
                        // why `sticky` and `relative` cannot both be listed.
                        cellPositionClasses(
                          pinnedSide,
                          isNameCol,
                          isCellSelectable
                        ),
                        isFlashing && "animate-live-pulse",
                        // `primary` rather than a token of its own: the ring
                        // and the wash are the same affordance the rest of the
                        // shell uses for "this is what you are acting on".
                        isCellSelected && "bg-primary/10",
                        isCellFillPreview && "bg-primary/5",
                        isCellFocused && "outline outline-1 -outline-offset-1 outline-primary"
                      ),
                      style: {
                        ...cellMaxWidth !== void 0 ? { maxWidth: cellMaxWidth } : {},
                        ...cellSortBg ? { backgroundColor: cellSortBg, opacity: 0.85 } : {},
                        ...pinLeft !== void 0 ? { left: pinLeft } : {},
                        ...pinRight !== void 0 ? { right: pinRight } : {}
                      },
                      children: [
                        content,
                        showFillHandle && /* @__PURE__ */ jsx(
                          "span",
                          {
                            role: "presentation",
                            "aria-hidden": true,
                            "data-fill-handle": "",
                            title: "Drag down to fill",
                            onMouseDown: cells.onFillHandleMouseDown,
                            className: "absolute right-0 bottom-0 h-1.5 w-1.5 cursor-crosshair bg-primary"
                          }
                        )
                      ]
                    },
                    cell.id
                  );
                })
              },
              row.id
            );
            if (!isExpanded) return mainRow;
            return /* @__PURE__ */ jsxs(Fragment$1, { children: [
              mainRow,
              /* @__PURE__ */ jsx(
                TableRow,
                {
                  "data-detail-row": "true",
                  className: "border-b border-border/50 bg-muted/10",
                  children: /* @__PURE__ */ jsx(TableCell, { colSpan: visibleColSpan, className: "px-4 py-3", children: subRowContent })
                },
                `${row.id}-detail`
              )
            ] }, row.id);
          };
          if (!isVirtualized) {
            return rowsToRender.map(renderDataRow);
          }
          const virtualItems = rowVirtualizer.getVirtualItems();
          const totalSize = rowVirtualizer.getTotalSize();
          const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
          const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;
          return /* @__PURE__ */ jsxs(Fragment, { children: [
            paddingTop > 0 && /* @__PURE__ */ jsx("tr", { "aria-hidden": "true", children: /* @__PURE__ */ jsx("td", { colSpan: columns.length, style: { height: paddingTop } }) }),
            virtualItems.map((vi) => {
              const row = rowsToRender[vi.index];
              if (!row) return null;
              return renderDataRow(row, vi.index);
            }),
            paddingBottom > 0 && /* @__PURE__ */ jsx("tr", { "aria-hidden": "true", children: /* @__PURE__ */ jsx("td", { colSpan: columns.length, style: { height: paddingBottom } }) })
          ] });
        })() }),
        hasAggregates(config.columns) && /* @__PURE__ */ jsx(TableFooter, { children: /* @__PURE__ */ jsx(TableRow, { className: "border-t-2 border-border bg-muted/40 font-medium text-xs", children: table.getVisibleLeafColumns().map((col) => {
          const colConfig = config.columns[col.id];
          const aggFn = colConfig?.aggregate_function;
          if (!aggFn) return /* @__PURE__ */ jsx(TableCell, { className: cellPad }, col.id);
          const result = computeAggValue(
            rows,
            col.id,
            aggFn
          );
          const display = formatAggValue(result, colConfig?.format_string);
          return /* @__PURE__ */ jsx(
            TableCell,
            {
              className: `${cellPad} text-${colConfig?.text_align || "right"} tabular-nums`,
              children: display
            },
            col.id
          );
        }) }) })
      ] })
    }
  );
  if (isVirtualized) {
    return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
      /* @__PURE__ */ jsx(
        GridHeader,
        {
          table,
          config,
          density,
          onDensityChange: cycleDensity,
          search: globalFilter,
          onSearchChange: setGlobalFilter,
          searchPlaceholder,
          filtersSlot,
          onExport: config.allowExport ? () => (onExport ?? defaultExport)(sortedRows) : void 0,
          bulkDirty,
          bulkSaving,
          onBulkSave: bulkMode ? saveBulkDrafts : void 0,
          onBulkDiscard: bulkMode ? discardBulkDrafts : void 0,
          dashboardPin: showDashboardPinButton ? dashboardPin : void 0,
          onDashboardPinToggle: showDashboardPinButton ? () => setDashboardPin(!dashboardPin) : void 0
        }
      ),
      /* @__PURE__ */ jsx(
        "div",
        {
          ref: scrollRef,
          className: cn(
            "rounded border overflow-auto",
            virtualizedMaxHeightClass
          ),
          children: renderTableSurface(sortedRows)
        }
      ),
      config.footer && /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground pt-1", children: config.footer })
    ] });
  }
  if (isEmbedded) {
    return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
      customToolbar,
      bulkMode && bulkDirty && /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-1.5", children: [
        /* @__PURE__ */ jsxs(
          Button,
          {
            variant: "ghost",
            size: "sm",
            className: "gap-1.5",
            "aria-label": "Discard unsaved edits",
            disabled: bulkSaving,
            onClick: discardBulkDrafts,
            children: [
              /* @__PURE__ */ jsx(Undo2, { className: "h-3.5 w-3.5" }),
              "Discard"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          Button,
          {
            size: "sm",
            className: "gap-1.5",
            "aria-label": "Save unsaved edits",
            disabled: bulkSaving,
            onClick: () => void saveBulkDrafts(),
            children: [
              /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
              bulkSaving ? "Saving…" : "Save"
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsx("div", { className: "rounded border overflow-auto", children: renderTableSurface(sortedRows) })
    ] });
  }
  return /* @__PURE__ */ jsx(
    GridWrapper,
    {
      rows: sortedRows,
      defaultPageSize: config.defaultPageSize,
      pageSizeOptions: config.pageSizeOptions,
      paginationEnabled: config.paginationEnabled && !isGrouped,
      showRowCount: false,
      children: (paginatedRows) => /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsx(
          GridHeader,
          {
            table,
            config,
            density,
            onDensityChange: cycleDensity,
            search: globalFilter,
            onSearchChange: setGlobalFilter,
            searchPlaceholder,
            filtersSlot,
            onExport: config.allowExport ? () => (onExport ?? defaultExport)(paginatedRows) : void 0,
            bulkDirty,
            bulkSaving,
            onBulkSave: bulkMode ? saveBulkDrafts : void 0,
            onBulkDiscard: bulkMode ? discardBulkDrafts : void 0,
            dashboardPin: showDashboardPinButton ? dashboardPin : void 0,
            onDashboardPinToggle: showDashboardPinButton ? () => setDashboardPin(!dashboardPin) : void 0
          }
        ),
        /* @__PURE__ */ jsx("div", { className: "rounded border overflow-auto", children: renderTableSurface(paginatedRows) }),
        config.footer && /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground pt-1", children: config.footer })
      ] })
    }
  );
}
export {
  DataGrid as default,
  useRowClickHandler
};
//# sourceMappingURL=DataGrid.js.map
