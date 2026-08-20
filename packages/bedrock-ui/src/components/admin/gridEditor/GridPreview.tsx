/**
 * @file GridPreview.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Live, config-driven preview for the admin Grid Editor. Renders a
 *              real TanStack Table over 1–10 staged rows using the SAME shared
 *              primitives as production grids (applyColumnSizing, prependRankColumn,
 *              prependSelectionColumn, resolveCell, gradients, GridHeader,
 *              SortableTableHead) so what the admin sees equals what saving yields.
 *
 *              Preview-only authoring aids (dataset variant, viewport, row-count,
 *              detailed roster editor) live in a bottom-anchored collapsible
 *              drawer + a dedicated "Manage preview data" modal. Their state is
 *              never persisted.
 */

import { useMemo, useState, useEffect, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
  type ColumnPinningState,
  type ColumnFiltersState,
  type GroupingState,
  type ExpandedState,
} from "@tanstack/react-table";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableCell,
} from "../../ui/table";
import { SegmentedControl } from "../../ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { ChevronDown, ChevronRight, RotateCw, AlertCircle } from "lucide-react";
import { cn } from "../../../lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../ui/collapsible";
import { usePersistedDisclosure } from "../../../hooks/usePersistedDisclosure";
import GridHeader from "../../grids/GridHeader";
import { useDensity } from "../../../hooks/useDensity";
import { SortableTableHead } from "../../SortableTableHead";
import { DndColumnWrapper } from "../../../hooks/useDraggableColumns";
import {
  getApiBindingsForGrid,
  getDefaultParamsForBinding,
} from "./apiPreviewRegistry";
import { usePreviewLiveData } from "./usePreviewLiveData";
import { resolveCell, unwrapCellPayload } from "../../grids/cellRenderers";
import {
  applyColumnSizing,
  prependRankColumn,
  prependSelectionColumn,
  getGradientCellStyle,
  computeColumnMinMax,
  hasAggregates,
  computeAggValue,
  formatAggValue,
} from "../../../utils/gridUtils";
import { getRankRowClass } from "../../../utils/rankStyle";
import type { GridConfig } from "../../../hooks/useGridConfig";
import { type GridColumnSetting } from "../../../hooks/useAdminPlatform";
import { useRowAccentResolver } from "../../grids/rowAccentRegistry";
import { log } from "../../../utils/logger";
import { unknownColumnsFor } from "./datasetSchemas";
import { stageValue, type PreviewRow } from "./previewStaging";

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_MAX: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

interface GridPreviewProps {
  config: GridConfig;
  /**
   * Optional handler that opens the full-viewport focus mode. When provided, a
   * `⛶` button appears in the preview toolbar. Rendered inside focus mode the
   * outer parent passes `undefined` to hide the button (already in focus).
   */
  onEnterFocus?: () => void;
  /**
   * Phase 5: fired when the admin drags a header to a new position. The
   * Grid Editor wires this to `useGridDraft.reorderColumns` so `column_order`
   * on the draft columns is renumbered live and the change is persisted on
   * Save. When omitted, reorder is session-local (state lives on the preview).
   */
  onColumnReorder?: (nextOrder: string[]) => void;
}

const colHelper = createColumnHelper<PreviewRow>();

/** Router-free cell renderer mirroring the production rankings cell path. */
function renderPreviewCell(
  rawValue: unknown,
  col: GridColumnSetting,
  row: PreviewRow,
  numeralStyle: "default" | "tabular",
): React.ReactNode {
  // Phase 4 composite payload — unwrap once so the preview matches the
  // production cell pipeline. Meta is merged into the row surface so
  // resolveCell can pick up identity ids (mlb_id, team_id) transparently.
  const { value, meta } = unwrapCellPayload(rawValue);
  const rowWithMeta = { ...(row as Record<string, unknown>), ...meta };
  const resolved = resolveCell(
    col.column_id,
    value,
    rowWithMeta,
    { linkTarget: col.link_target },
  );
  if (resolved !== undefined) return resolved;
  if (value == null)
    return <span className="text-muted-foreground">{col.null_display ?? "—"}</span>;

  if (col.cell_type === "number") {
    const n = Number(value);
    if (isNaN(n)) return <span>{String(value)}</span>;
    const fmt = col.format_string;
    let display: string;
    if (fmt === ".1f" || fmt === "0.0") display = n.toFixed(1);
    else if (fmt === ".2f" || fmt === "0.00") display = n.toFixed(2);
    else if (fmt === ".3f" || fmt === "0.000") display = n.toFixed(3);
    else display = Math.round(n).toString();
    // Phase 3 §S9: mirrors cellRenderers.renderCell() — tabular-nums only
    // when the grid opts into numeral_style="tabular".
    return (
      <span className={numeralStyle === "tabular" ? "tabular-nums" : undefined}>
        {display}
      </span>
    );
  }
  return <span>{String(value)}</span>;
}

export default function GridPreview({ config, onEnterFocus: _onEnterFocus, onColumnReorder }: GridPreviewProps) {
  const [viewport, setViewport] = useState<Viewport>("desktop");

  const apiBindings = useMemo(
    () => getApiBindingsForGrid(config.gridId),
    [config.gridId],
  );

  const [selectedBindingId, setSelectedBindingId] = useState<string>(
    apiBindings[0]?.id ?? "",
  );
  const [apiRowLimit, setApiRowLimit] = useState<number>(5);
  const [liveApiRequested, setLiveApiRequested] = useState<boolean>(false);

  useEffect(() => {
    setLiveApiRequested(false);
  }, [selectedBindingId]);

  const activeBinding = useMemo(
    () => apiBindings.find((b) => b.id === selectedBindingId) ?? apiBindings[0] ?? null,
    [apiBindings, selectedBindingId],
  );

  const [paramValues, setParamValues] = useState<Record<string, any>>(() =>
    activeBinding ? getDefaultParamsForBinding(activeBinding) : {},
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
    () => (liveApiState.rows as PreviewRow[]).slice(0, apiRowLimit),
    [liveApiState.rows, apiRowLimit],
  );

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { density, cycleDensity } = useDensity(!!config.denseMode);
  const [datasetDrawerOpen, setDatasetDrawerOpen] = usePersistedDisclosure(
    "datasetDrawerOpen",
    false,
  );

  // Phase 6B tripwire: log at mount whenever the config references columns
  // absent from the dataset schema. Runs once per render but the log
  // pipeline dedupes cheaply — this is a diagnostic, not a hot-path signal.
  useEffect(() => {
    const stray = unknownColumnsFor(
      config.gridId,
      Object.values(config.columns).map((c) => c.column_id),
    );
    for (const columnId of stray) {
      log.warn(
        {
          gridId: config.gridId,
          columnId,
          action: "dataset.unknownColumn",
        },
        "GridPreview: column id not present in dataset schema — cells will render empty unless the endpoint emits this field",
      );
    }
  }, [config.gridId, config.columns]);

  // Expand staged rows so every configured numeric column has a demonstrable value.
  const stagedData = useMemo(() => {
    const cols = Object.values(config.columns);
    return effectiveRows.map((row) => {
      const filled: PreviewRow = { ...row };
      for (const col of cols) {
        if (!(col.column_id in filled)) {
          filled[col.column_id] = stageValue(row, col.column_id, col.cell_type);
        }
      }
      return filled;
    });
  }, [effectiveRows, config.columns]);

  // Phase 3 §S9: row accent tinting — resolved through the same registry
  // <DataGrid> uses, so the preview stays honest about what saving yields
  // (I-GP parity, scripts/maintenance/audit_grids.py).
  const resolveRowAccent = useRowAccentResolver(config.teamAccentReactive);

  // Phase 3 §S9: changed-cell "live pulse" — mirrors <DataGrid>'s detection,
  // diffed against stagedData so editing preview rows via "Manage data" (or
  // switching dataset/row-count) gives admins a live demo of the effect.
  const prevStagedRef = useRef<Record<string, Record<string, unknown>> | null>(null);
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    const rowKeyCol = config.rowKeyColumn;
    if (!config.liveUpdateHighlight || !rowKeyCol) {
      prevStagedRef.current = null;
      return;
    }
    const nextMap: Record<string, Record<string, unknown>> = {};
    for (const row of stagedData as unknown as Record<string, unknown>[]) {
      const key = row[rowKeyCol];
      if (key == null) continue;
      nextMap[String(key)] = row;
    }
    const prev = prevStagedRef.current;
    prevStagedRef.current = nextMap;
    if (!prev) return;

    const changed = new Set<string>();
    for (const [key, row] of Object.entries(nextMap)) {
      const prevRow = prev[key];
      if (!prevRow) continue;
      for (const columnId of Object.keys(config.columns)) {
        if (row[columnId] !== prevRow[columnId]) changed.add(`${key}:${columnId}`);
      }
    }
    if (changed.size === 0) return;
    setFlashKeys(changed);
    const t = setTimeout(() => setFlashKeys(new Set()), 1100);
    return () => clearTimeout(t);
  }, [stagedData, config.liveUpdateHighlight, config.rowKeyColumn, config.columns]);

  const columns: ColumnDef<PreviewRow, any>[] = useMemo(() => {
    const baseCols = Object.values(config.columns)
      .sort((a, b) => a.column_order - b.column_order)
      .map((col) => {
        const sizing = applyColumnSizing(col, config.minColumnWidth);
        return colHelper.accessor((r) => r[col.column_id], {
          id: col.column_id,
          header: () => <span>{col.label_override || col.column_id}</span>,
          size: sizing.size,
          minSize: sizing.minSize,
          maxSize: sizing.maxSize,
          // Phase 2 sort mode enum + Phase 3 column-stub wiring — mirror
          // DataGrid so the admin's preview and the runtime grid share
          // exactly the same TanStack surface.
          enableSorting:
            col.allow_sort_mode !== undefined
              ? col.allow_sort_mode !== "none"
              : !!col.allow_sort,
          enableColumnFilter: !!col.allow_filter,
          enableResizing: !!col.resizable,
          enableGrouping: !!col.group_by,
          enableHiding: !col.read_only,
          cell: (info) => {
            const val = info.getValue();
            let gradStyle: React.CSSProperties | undefined;
            if (col.gradient_from_color && col.gradient_to_color) {
              const minMax = computeColumnMinMax(
                stagedData as unknown as Record<string, unknown>[],
                col.column_id,
              );
              if (minMax && typeof val === "number") {
                gradStyle = getGradientCellStyle(
                  val,
                  minMax.min,
                  minMax.max,
                  col.gradient_from_color,
                  col.gradient_to_color,
                );
              }
            }
            const content = renderPreviewCell(val, col, info.row.original, config.numeralStyle);
            return gradStyle ? (
              <span className="block w-full" style={gradStyle}>
                {content}
              </span>
            ) : (
              content
            );
          },
          meta: { align: col.text_align ?? "left" },
        }) as ColumnDef<PreviewRow, any>;
      });

    const withRank = prependRankColumn(
      baseCols,
      config.showRanking,
      colHelper,
      config.showMedalToggles,
      "end",
    );
    return prependSelectionColumn(
      withRank,
      config.allowSelection,
      selectedIds,
      setSelectedIds,
      "mlb_id",
      config.selectionPosition,
    );
  }, [config.columns, config.showRanking, config.allowSelection, config.selectionPosition, config.minColumnWidth, config.numeralStyle, selectedIds, stagedData]);

  const initialVisibility = useMemo(() => {
    const vis: Record<string, boolean> = {};
    for (const col of Object.values(config.columns)) {
      vis[col.column_id] = !!col.default_visible;
    }
    return vis;
  }, [config.columns]);

  // Phase 3 column pinning: explicit column.pinned always wins; falls back
  // to sticky_first_column pinning the first visible column left.
  const columnPinning = useMemo<ColumnPinningState>(() => {
    const left: string[] = [];
    const right: string[] = [];
    const orderedCols = Object.values(config.columns).sort(
      (a, b) => a.column_order - b.column_order,
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

  // Phase 3 default_filter seeding — parses JSON payloads or falls through
  // to a raw string equality filter.
  const initialColumnFilters = useMemo<ColumnFiltersState>(() => {
    const out: ColumnFiltersState = [];
    for (const col of Object.values(config.columns)) {
      if (!col.default_filter) continue;
      let parsed: unknown = col.default_filter;
      try {
        parsed = JSON.parse(col.default_filter);
      } catch {
        parsed = col.default_filter;
      }
      out.push({ id: col.column_id, value: parsed });
    }
    return out;
  }, [config.columns]);
  const [columnFilters, setColumnFilters] =
    useState<ColumnFiltersState>(initialColumnFilters);

  // Phase 2 config-driven getRowId — keeps selection/expand state stable
  // across sort + filter changes.
  const rowIdKey = config.rowKeyColumn || undefined;
  const getRowId = useMemo(
    () =>
      rowIdKey
        ? (row: PreviewRow, index: number) => {
            const v = (row as Record<string, unknown>)[rowIdKey];
            return v == null ? String(index) : String(v);
          }
        : undefined,
    [rowIdKey],
  );

  // Phase 5: runtime column order + DnD. Seeded from column_order and
  // resynced whenever the underlying config columns change.
  const configOrder = useMemo(
    () =>
      Object.values(config.columns)
        .sort((a, b) => a.column_order - b.column_order)
        .map((c) => c.column_id),
    [config.columns],
  );
  const [columnOrder, setColumnOrder] = useState<string[]>(configOrder);
  const configOrderJson = JSON.stringify(configOrder);
  useEffect(() => {
    setColumnOrder(configOrder);
  }, [configOrderJson]);
  const handleColumnOrderChange = (next: string[]) => {
    setColumnOrder(next);
    onColumnReorder?.(next);
  };


  // Phase 3 group_by wiring: seed `grouping` from every column configured
  // with group_by=1 so `enableGrouping` actually produces grouped rows.
  // Without this, TanStack accepts the per-column flag but never activates
  // grouping — the render loop then shows raw leaf rows and admins see no
  // effect from the toggle.
  const initialGrouping = useMemo<GroupingState>(
    () =>
      Object.values(config.columns)
        .filter((c) => !!c.group_by)
        .sort((a, b) => a.column_order - b.column_order)
        .map((c) => c.column_id),
    [config.columns],
  );
  const [grouping, setGrouping] = useState<GroupingState>(initialGrouping);
  useEffect(() => {
    setGrouping(initialGrouping);
  }, [initialGrouping]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

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
      expanded,
    },
    initialState: { columnVisibility: initialVisibility },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onColumnOrderChange: (updater) =>
      handleColumnOrderChange(
        typeof updater === "function" ? updater(columnOrder) : updater,
      ),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onEnd",
    autoResetPageIndex: false,
    getRowId,
  });

  const DENSITY_PAD: Record<typeof density, string> = {
    compact: "px-2 py-0.5",
    standard: "px-3 py-1.5",
    comfortable: "px-3 py-2.5",
  };
  const cellPad = DENSITY_PAD[density];
  const headerClassName = config.stickyHeader ? "sticky top-0 z-10" : "";
  const bodyClassName = config.rowStriping
    ? "[&>tr:nth-child(even)]:bg-muted/20"
    : "";
  const rowWrapClass = config.wrapText ? "whitespace-normal" : "whitespace-nowrap";

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 overflow-hidden" data-testid="grid-preview">
      {/* ── Live grid (top) ──────────────────────────────────────────────── */}
      <div className="mx-auto w-full flex-1 flex flex-col min-h-0 transition-all overflow-hidden" style={{ maxWidth: VIEWPORT_MAX[viewport] }}>
        <div className="flex-1 flex flex-col min-h-0 space-y-2 overflow-hidden">
          <GridHeader
            table={table}
            config={config}
            density={density}
            onDensityChange={cycleDensity}
            search={globalFilter}
            onSearchChange={setGlobalFilter}
            onExport={() => log.info({ gridId: config.gridId, action: "export" }, "GridPreview: export (noop)")}
          />
          {!liveApiRequested ? (
            <div className="flex flex-col items-center justify-center gap-2.5 p-6 border rounded bg-muted/20 my-auto text-center">
              <p className="text-xs font-medium text-muted-foreground">
                Live API mode enabled for <code className="text-foreground">{activeBinding?.path ?? config.gridId}</code>.
              </p>
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={() => {
                  setLiveApiRequested(true);
                  liveApiState.refetch();
                }}
              >
                <RotateCw className="h-3.5 w-3.5" /> Fetch Live Data
              </Button>
            </div>
          ) : (
            <div className="rounded border flex-1 min-h-0 overflow-auto">
              <DndColumnWrapper
                columnOrder={columnOrder}
                onOrderChange={handleColumnOrderChange}
                enabled={!!config.allowColumnReorder}
              >
                <Table>
                {config.caption && (
                  <caption className="caption-bottom text-muted-foreground text-xs py-1 px-2 text-left">
                    {config.caption}
                  </caption>
                )}
                <TableHeader className={headerClassName}>
                  {table.getHeaderGroups().map((hg) => (
                    <TableRow key={hg.id} className="border-b bg-muted/90 backdrop-blur-sm">
                      {hg.headers.map((h) => {
                        const pinnedSide = h.column.getIsPinned();
                        const pinLeft =
                          pinnedSide === "left" ? h.column.getStart("left") : undefined;
                        const pinRight =
                          pinnedSide === "right" ? h.column.getAfter("right") : undefined;
                        const isDataCol = columnOrder.includes(h.column.id);
                        return (
                          <SortableTableHead
                            key={h.id}
                            header={h}
                            colConfig={config.columns[h.column.id]}
                            gridSortAscColor={config.sortAscColor}
                            gridSortDescColor={config.sortDescColor}
                            className={cellPad}
                            sticky={pinnedSide === "left"}
                            pinnedOffsetLeft={pinLeft}
                            pinnedOffsetRight={pinRight}
                            tooltipDelayDuration={config.tooltipDelayDuration}
                            gridId={config.gridId}
                            dndId={
                              config.allowColumnReorder && isDataCol
                                ? h.column.id
                                : undefined
                            }
                          />
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody className={bodyClassName}>
                  {table.getRowModel().rows.map((row, idx) => {
                    const rank = idx + 1;
                    const isGroupedRow = row.getIsGrouped();
                    const previewRow = row.original as unknown as Record<string, unknown>;
                    // Phase 3 §S9: same rowKeyForRow / teamForRow resolution DataGrid uses.
                    const rowKeyForRow = config.rowKeyColumn
                      ? previewRow[config.rowKeyColumn]
                      : undefined;
                    const teamAccentStyle = !isGroupedRow
                      ? resolveRowAccent(previewRow)
                      : undefined;
                    return (
                      <TableRow
                        key={row.id}
                        data-testid={isGroupedRow ? "grid-preview-group-row" : "grid-preview-leaf-row"}
                        className={cn(
                          "border-b border-border/50 transition-colors",
                          !config.hoverColor && "hover:bg-muted/30",
                          rowWrapClass,
                          config.showMedalToggles && !isGroupedRow && getRankRowClass(rank),
                          isGroupedRow && "bg-muted/40 font-medium",
                          teamAccentStyle && "border-l-2 border-l-[color:var(--team-accent)]",
                        )}
                        style={teamAccentStyle}
                        onMouseEnter={
                          config.hoverColor
                            ? (e) => { (e.currentTarget as HTMLElement).style.backgroundColor = config.hoverColor!; }
                            : undefined
                        }
                        onMouseLeave={
                          config.hoverColor
                            ? (e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ""; }
                            : undefined
                        }
                      >
                        {row.getVisibleCells().map((cell) => {
                          const isFlashing =
                            config.liveUpdateHighlight &&
                            rowKeyForRow != null &&
                            flashKeys.has(`${rowKeyForRow}:${cell.column.id}`);
                          const align = (cell.column.columnDef.meta as any)?.align || "left";
                          const pinnedSide = cell.column.getIsPinned();
                          const pinLeft =
                            pinnedSide === "left"
                              ? cell.column.getStart("left")
                              : undefined;
                          const pinRight =
                            pinnedSide === "right"
                              ? cell.column.getAfter("right")
                              : undefined;
                          const isGrouped = cell.getIsGrouped();
                          const isPlaceholder = cell.getIsPlaceholder();
                          const isAggregated = cell.getIsAggregated();

                          let content: React.ReactNode;
                          if (isGrouped) {
                            const childCount = row.subRows.length;
                            content = (
                              <button
                                type="button"
                                onClick={row.getToggleExpandedHandler()}
                                className="inline-flex items-center gap-1 text-left hover:text-foreground"
                                aria-expanded={row.getIsExpanded()}
                                aria-label={`Toggle ${cell.column.id} group`}
                              >
                                {row.getIsExpanded() ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                                <span>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
                                <span className="text-muted-foreground text-[11px]">({childCount})</span>
                              </button>
                            );
                          } else if (isAggregated) {
                            content = flexRender(
                              cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                              cell.getContext(),
                            );
                          } else if (isPlaceholder) {
                            content = null;
                          } else {
                            content = flexRender(cell.column.columnDef.cell, cell.getContext());
                          }

                          return (
                            <TableCell
                              key={cell.id}
                              className={cn(
                                `${cellPad} text-${align}`,
                                pinnedSide === "left" && "sticky z-10 bg-card",
                                pinnedSide === "right" && "sticky z-10 bg-card",
                                isFlashing && "animate-live-pulse",
                              )}
                              style={{
                                ...(pinLeft !== undefined ? { left: pinLeft } : {}),
                                ...(pinRight !== undefined ? { right: pinRight } : {}),
                              }}
                            >
                              {content}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
                {hasAggregates(config.columns) && (
                  <TableFooter>
                    <TableRow className="border-t-2 border-border bg-muted/40 font-medium text-xs">
                      {table.getVisibleLeafColumns().map((leaf) => {
                        const colConfig = config.columns[leaf.id];
                        const aggFn = colConfig?.aggregate_function as
                          | "sum" | "avg" | "min" | "max" | "count" | undefined | null;
                        if (!aggFn) return <TableCell key={leaf.id} className={cellPad} />;
                        const result = computeAggValue(
                          stagedData as unknown as Record<string, unknown>[],
                          leaf.id,
                          aggFn,
                        );
                        const display = formatAggValue(result, colConfig?.format_string);
                        return (
                          <TableCell
                            key={leaf.id}
                            className={`${cellPad} text-${colConfig?.text_align || "right"} tabular-nums`}
                          >
                            {display}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </DndColumnWrapper>
          </div>
          )}
          {config.footer && (
            <p className="text-xs text-muted-foreground pt-1">
              {config.footer}
            </p>
          )}
        </div>
      </div>

      {/* ── Preview-only authoring drawer (bottom, collapsible) ──────────── */}
      <Collapsible
        open={datasetDrawerOpen}
        onOpenChange={setDatasetDrawerOpen}
        className="shrink-0 mt-auto"
      >
        <div className="flex flex-wrap items-center gap-3 rounded-t-lg border border-dashed bg-background px-3 py-2">
          <CollapsibleTrigger
            className="flex items-center gap-2 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label="Toggle preview data drawer"
            data-testid="preview-dataset-trigger"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                !datasetDrawerOpen && "-rotate-90",
              )}
            />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Preview data
            </span>
            <Badge variant="outline" className="text-[10px]">not saved</Badge>
            <span className="text-[11px] text-muted-foreground">
              {`Live API (${effectiveRows.length} row${effectiveRows.length === 1 ? "" : "s"})`}
            </span>
          </CollapsibleTrigger>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] text-muted-foreground">Viewport</Label>
              <SegmentedControl<Viewport>
                size="sm"
                value={viewport}
                onChange={(v) => {
                  setViewport(v);
                  log.info(
                    { gridId: config.gridId, action: "preview-viewport", viewport: v },
                    "GridPreview: viewport changed",
                  );
                }}
                options={[
                  { value: "desktop", label: "Desktop" },
                  { value: "tablet", label: "Tablet" },
                  { value: "mobile", label: "Mobile" },
                ]}
              />
            </div>
          </div>
        </div>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
          <div className="flex flex-col gap-3 rounded-b-lg border border-t-0 border-dashed bg-background px-3 py-3">
            {/* Mode selection + API selection header */}
            <div className="flex flex-wrap items-end gap-3 border-b pb-2">
              {apiBindings.length > 1 && (
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground">Associated API</Label>
                  <Select value={selectedBindingId} onValueChange={setSelectedBindingId}>
                    <SelectTrigger size="sm" className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {apiBindings.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-col gap-1">
                  <Label htmlFor="live-api-limit" className="text-[11px] text-muted-foreground">
                    Limit rows
                  </Label>
                  <Select
                    value={String(apiRowLimit)}
                    onValueChange={(v) => setApiRowLimit(Number(v))}
                  >
                    <SelectTrigger id="live-api-limit" size="sm" aria-label="Limit rows" className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[5, 10, 25, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>

              {activeBinding && (
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => liveApiState.refetch()}
                    disabled={liveApiState.isLoading}
                  >
                    <RotateCw className={cn("h-3.5 w-3.5", liveApiState.isLoading && "animate-spin")} />
                    Refresh
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {activeBinding ? (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    API Parameters: <code className="text-foreground">{activeBinding.path}</code>
                  </div>
                  {activeBinding.params.length === 0 ? (
                    <span className="text-xs text-muted-foreground italic">No parameters required for this endpoint.</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      {activeBinding.params.map((p) => (
                        <div key={p.name} className="flex flex-col gap-1">
                          <Label className="text-[11px] text-muted-foreground">{p.label}</Label>
                          {p.type === "select" && p.options ? (
                            <Select
                              value={String(paramValues[p.name] ?? p.defaultValue)}
                              onValueChange={(v) =>
                                setParamValues((prev) => ({ ...prev, [p.name]: v }))
                              }
                            >
                              <SelectTrigger size="sm" className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {p.options.map((opt) => (
                                  <SelectItem key={String(opt.value)} value={String(opt.value)}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              type={p.type === "number" ? "number" : "text"}
                              value={paramValues[p.name] ?? ""}
                              onChange={(e) => {
                                const val = p.type === "number" ? Number(e.target.value) : e.target.value;
                                setParamValues((prev) => ({ ...prev, [p.name]: val }));
                              }}
                              className="h-8 w-28 text-xs"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {liveApiState.isError && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded p-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                      <span>{liveApiState.errorMessage || "Failed to load live data."}</span>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  No associated API endpoint registered for grid ID `{config.gridId}`. Register an endpoint binding to preview this grid.
                </span>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

    </div>
  );
}

