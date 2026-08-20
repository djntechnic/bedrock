/**
 * @file DataGrid.tsx
 * @module frontend/src/components/grids
 * @description Centralized, config-driven grid engine. Given a `gridId` and
 * `rows`, resolves the admin `GridConfig` and renders the full stack —
 * `<GridWrapper>` pagination shell, `<GridHeader>` toolbar, `<Table>` with
 * sticky/striping/dense/wrap/hover/sort/medal wiring, aggregate footer, empty
 * and loading states — with zero per-page boilerplate.
 *
 * Extension slots let the caller specialize a grid without dropping back into
 * ad-hoc `useReactTable` markup:
 *   - `customCells` / `customHeaders`   → per-column render overrides
 *   - `headerTooltips`                  → static tooltip map by label or column_id
 *   - `filtersSlot`                     → inline filter chips in the header
 *   - `onRowClick` / `onExport`         → domain callbacks
 *
 * The engine owns state (sorting, columnVisibility, globalFilter, density,
 * selection), column building, the cell pipeline (`customCells →
 * renderMediaCell → renderCell` with gradient handling), rank + selection column prepend,
 * medal row gating, and every GridConfig property from CLAUDE.md §S2. Pages
 * become dumb shells that fetch data and hand it off.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { useNavigate } from "react-router-dom";
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
  type ColumnPinningState,
  type ColumnFiltersState,
  type GroupingState,
  type ExpandedState,
  type Row,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableFooter,
} from "../ui/table";
import { ChevronDown, ChevronRight, Save, Undo2 } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { toast } from "sonner";

import GridHeader from "./GridHeader";
import GridWrapper from "../GridWrapper";
import { SortableTableHead } from "../SortableTableHead";
import { EmptyTableRow } from "../EmptyTableRow";
import { GridStatusContent } from "../GridStatus";

import { useTableState } from "../../hooks/useTableState";
import { useAuth } from "../../hooks/useAuth";
import { useDensity, DENSITY_ROW_HEIGHT } from "../../hooks/useDensity";
import { useSelectionStore } from "../../store/selectionStore";
import { useAdmin, type GridColumnSetting } from "../../hooks/useAdminPlatform";
import { DndColumnWrapper } from "../../hooks/useDraggableColumns";
import { useRowAccentResolver } from "./rowAccentRegistry";

import { renderCell, renderMediaCell, unwrapCellPayload } from "./cellRenderers";
import EditableCell from "./EditableCell";
import { useCellSelection } from "./useCellSelection";
import { cellPositionClasses } from "./cellPosition";
import type {
  CellRange,
  CellRangeFill,
  CellRangePaste,
} from "./useCellSelection";
import {
  prependRankColumn,
  prependSelectionColumn,
  applyColumnSizing,
  getGradientCellStyle,
  computeColumnMinMax,
  computeAggValue,
  formatAggValue,
  hasAggregates,
} from "../../utils/gridUtils";
import { getRankRowClass } from "../../utils/rankStyle";

/**
 * Columns the engine prepends itself — chevron, rank, compare checkbox. Not
 * data, so the cell cursor skips them.
 */
const ENGINE_COLUMN_IDS = new Set(["__expander__", "ranking", "_compare"]);

/** Contract passed to a `customCells` override. */
export interface CustomCellCtx<T> {
  value: unknown;
  row: T;
  rowIndex: number;
  column_id: string;
  /** Full column config — expose format_string, cell_type, colors, etc. */
  colConfig: GridColumnSetting;
  gradientStyle?: CSSProperties;
}

/** Contract passed to a `customHeaders` override. */
export interface CustomHeaderCtx {
  column_id: string;
  label: string;
  tooltip: string | null;
  delayDuration: number;
}

export interface DataGridProps<T extends Record<string, any>> {
  /** grid_id from `app_grid_settings`; drives the config lookup. */
  gridId: string;
  /** Row data (page owns filtering — pass the already-filtered set). */
  rows: T[];
  /** Blocks rendering with a loading skeleton when true. */
  isLoading?: boolean;

  /** Inline filter chips / date pickers rendered in the header's left cluster. */
  filtersSlot?: ReactNode;
  /** Click handler for a data row. Ignored when omitted. */
  onRowClick?: (row: T, index: number) => void;
  /**
   * Override the default CSV export. Receives the currently-paginated rows so
   * page-scoped export is trivial; grids with a server export URL can wire it
   * up here and disable the default download.
   */
  onExport?: (paginatedRows: T[]) => void;
  /** Per-column cell renderer overrides keyed by `column_id`. */
  customCells?: Record<string, (ctx: CustomCellCtx<T>) => ReactNode>;
  /** Per-column header renderer overrides keyed by `column_id`. */
  customHeaders?: Record<string, (ctx: CustomHeaderCtx) => ReactNode>;
  /**
   * Static header-tooltip map. Looked up by label first (e.g. `"OPS"`), then
   * by `column_id`. Overridden by a column's `tooltip_override` if set.
   */
  headerTooltips?: Record<string, string>;
  /** Text shown when the filtered result set is empty. */
  emptyMessage?: string;
  /** Placeholder for the header search input (gated on `config.showSearch`). */
  searchPlaceholder?: string;
  /** Skeleton message while `isLoading` or config is still resolving. */
  loadingMessage?: string;
  /**
   * Overrides the accessor key for a given `column_id`. Use when the admin
   * column_id and the runtime row-object key intentionally differ (e.g.
   * legacy `d_ba_col` config bound to `d_ba` payload). Return `undefined` to
   * fall back to `column_id` as the accessor.
   */
  accessorFor?: (column_id: string) => string | undefined;
  /**
   * Bypass `useSelectionStore` and drive the selection column from
   * caller-owned state. Useful when two grids need distinct selection
   * scopes on the same page, or when selection lives in a parent's
   * component state rather than the global store. `config.allowSelection`
   * still gates the column's visibility.
   */
  selectionOverride?: {
    selectedIds: (number | string)[];
    onChange: (ids: (number | string)[]) => void;
  };
  /**
   * Phase 5: notify the caller when the user drags to reorder columns.
   * When set, the admin Grid Editor persists the new order by renumbering
   * each column's `column_order`. When unset, the reorder is session-local
   * (state lives on the runtime table). Gated by `config.allowColumnReorder`.
   */
  onReorderColumns?: (nextOrder: string[]) => void;
  /**
   * Phase 7 B2: render the grid as a widget-shaped embed — suppresses the
   * full `<GridHeader>` toolbar and the `<GridWrapper>` pagination shell.
   * The engine still renders the `<Table>` body with striping/sticky/dense/
   * sort/aggregate wiring intact. Use for dashboard tiles and flyout panes
   * where the standard toolbar overwhelms the surface. Pair with
   * `customToolbar` when the embed needs its own controls
   * (e.g. a `<ColumnToggle>`).
   */
  isEmbedded?: boolean;
  /**
   * Phase 7 B2: caller-owned toolbar rendered directly above the table body.
   * Only surfaces when `isEmbedded` is true — non-embedded consumers should
   * use `<GridHeader>` via the standard config path. Ignored otherwise.
   */
  customToolbar?: ReactNode;
  /**
   * Phase 7 B2: runtime-only visibility overlay applied over
   * `default_visible`. Explicit `false` forces a column hidden regardless
   * of config; explicit `true` forces it visible. Use for view-mode
   * splits (e.g. batting vs pitching column subsets) that aren't
   * expressible as admin defaults. Not a substitute for `default_visible`
   * — persistent visibility still belongs to admin config.
   */
  columnVisibilityOverride?: Record<string, boolean>;
  /**
   * Phase 8 H1: render mode.
   *   - `"default"` — the paginated `<GridWrapper>` shell (today's behavior).
   *   - `"virtualized"` — swaps the wrapper for a `@tanstack/react-virtual`
   *     row virtualizer. Pagination is disabled; the full sorted/filtered
   *     row model scrolls inside a bounded container and only the visible
   *     window (plus overscan) is mounted. Row-count in the header still
   *     reflects `table.getFilteredRowModel().rows.length`.
   *
   * `variant="virtualized"` is mutually exclusive with `isEmbedded` — the
   * embed path already suppresses the wrapper and renders the full sorted
   * set without windowing.
   */
  variant?: "default" | "virtualized";
  /**
   * Phase 8 H1: virtualizer overscan (rows kept mounted above/below the
   * visible window). Only consulted when `variant === "virtualized"`.
   * Default 10 — matches the value the legacy bespoke `PlayerGrid` used.
   */
  overscan?: number;
  /**
   * Phase 8 H1: max-height class applied to the virtualized scroll
   * container. Only consulted when `variant === "virtualized"`. Default
   * `max-h-[70vh]` — the value the legacy bespoke `PlayerGrid` used so
   * migration is a visual no-op.
   */
  virtualizedMaxHeightClass?: string;
  /**
   * Phase 8 H2: display columns injected before the ranking / selection /
   * data columns. Used by embedded consumers that need domain-specific
   * controls the seed config can't express — e.g. `CareerStatsGrid`'s
   * multi-stint expander column, which reads runtime `expanded` state the
   * shell owns. Each entry is a plain TanStack `ColumnDef`; the engine
   * appends them after `prependRankColumn` + `prependSelectionColumn` so
   * rank/selection still win the leftmost slots when enabled.
   */
  prependColumns?: ColumnDef<T, any>[];
  /**
   * Phase 8 H2: per-row className hook — receives the row's original data
   * and its index, returns extra classes to merge onto the `<TableRow>`.
   * Used by embedded consumers that style rows based on data (e.g.
   * career-total / stint-child / season-header variants in
   * `CareerStatsGrid`). Merged after the engine's default row classes so
   * the caller can override hover/border affordances when needed.
   */
  rowClassNameFor?: (row: T, index: number) => string | undefined;
  /**
   * Phase 8 H3: inline-edit commit hook. Activates the `<EditableCell>`
   * primitive on every column whose admin config sets `col.editable=1`
   * (grid-level `config.readOnly` still disables editing app-wide).
   * Receives the resolved row identity (the value at
   * `config.rowKeyColumn`), the column id, and the raw next value. Throw
   * or reject to trigger the primitive's revert + toast path.
   */
  onCellCommit?: (
    rowId: string,
    columnId: string,
    nextValue: unknown,
  ) => void | Promise<void>;
  /**
   * Phase 10 B3: bulk-save / draft-mode primitive. When set, every editable
   * cell (H3 `<EditableCell>`) writes to an engine-owned draft store keyed
   * by (rowKey, columnId) instead of firing `onCellCommit` per edit. The
   * `<GridHeader>` renders Save + Discard buttons gated on dirty state,
   * and clicking Save calls this handler with the accumulated drafts.
   * Resolving clears the draft store; rejecting keeps drafts intact and
   * surfaces a toast so the user can retry without losing edits.
   *
   * The two modes are mutually exclusive per commit — when `onBulkCommit`
   * is set the engine ignores `onCellCommit` for the same cells.
   */
  onBulkCommit?: (
    drafts: Record<string, Record<string, unknown>>,
  ) => void | Promise<void>;
  /**
   * Phase 10 B3: force the Save/Discard bar visible even when the engine
   * draft store is empty. Use when the consumer maintains its own row-
   * level overlay (add/delete rows, cascading dropdowns) that the engine
   * doesn't track — the header Save button then reflects the union of
   * consumer and engine dirty state, so users always see one Save button.
   */
  bulkDirtyOverride?: boolean;
  /**
   * Phase 10 B2: row-expansion primitive. When provided AND the grid's
   * admin config sets `allow_expansion=1`, the engine prepends a chevron
   * expander column and renders the return value beneath the expanded
   * row inside a `<tr>` whose `<td colSpan>` covers the visible column
   * count. Return `null` to render nothing for a given row (e.g. rows
   * that carry no detail payload) — the chevron will hide itself.
   *
   * The engine owns expansion state; consumers do not manage a
   * `Set<rowKey>` of their own. Grouping and expansion share TanStack's
   * `expanded` model — grids that use `col.group_by` and this slot
   * should verify the two interactions co-exist for their data shape.
   */
  renderSubRow?: (row: T, rowIndex: number) => ReactNode;
  /**
   * Spreadsheet cell cursor: a focused cell, a shift-extendable rectangle,
   * arrow-key navigation, `Ctrl/Cmd+C` to the clipboard as TSV, `Ctrl/Cmd+V`
   * reported to `onRangePaste`, and a fill handle reported to `onRangeFill`.
   *
   * Off by default, and off is exactly what every existing grid gets — no
   * listeners are bound and the cell render is unchanged but for two data
   * attributes. Coexists with `selectionOverride`: row selection stays on the
   * checkbox column, which is excluded from the cell grid.
   *
   * The engine reads and reports; it never writes. Paste and fill hand a
   * rectangle to the consumer because only the consumer knows which rows are
   * locked, which values are legal, and where its draft buffer is.
   */
  cellSelection?: boolean;
  /** Fired after a range copy, with the payload that reached the clipboard. */
  onRangeCopy?: (tsv: string, range: CellRange) => void;
  /**
   * A paste at the cursor. `anchor` is the top-left of the selection and the
   * matrix fills right and down from it; rows or columns past the end of the
   * grid are the consumer's to create, clamp or refuse.
   */
  onRangePaste?: (paste: CellRangePaste) => void;
  /** A fill-handle drag: repeat `source`'s values over `target`'s rows. */
  onRangeFill?: (fill: CellRangeFill) => void;
}

/**
 * Wraps a header label in a tooltip when a static tooltip is registered for it.
 * Consumed by the default header renderer only — a `customHeaders[column_id]`
 * override bypasses this entirely.
 */
function DefaultColHeader({
  label,
  tooltip,
  delayDuration,
}: {
  label: string;
  tooltip: string | null;
  delayDuration: number;
}) {
  if (!tooltip) return <span>{label}</span>;
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="underline decoration-dotted cursor-help">{label}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function DataGrid<T extends Record<string, any>>({
  gridId,
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
  renderSubRow,
  cellSelection = false,
  onRangeCopy,
  onRangePaste,
  onRangeFill,
}: DataGridProps<T>) {
  const isVirtualized = variant === "virtualized";
  const navigate = useNavigate();
  const { logExport } = useAdmin();
  const { isAuthenticated } = useAuth();
  // The synthetic pin-registry grid_ids can't meaningfully pin themselves.
  const showDashboardPinButton =
    isAuthenticated && gridId !== "dashboard" && gridId !== "player_pins";

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
    setDashboardPin,
  } = useTableState(gridId);

  // Phase 7 B2: overlay caller-supplied visibility flags. `override[id] = false`
  // wins over any admin `default_visible=1`; `true` wins over `default_visible=0`.
  // Keys absent from the override map fall through to the config-driven default.
  const columnVisibility = useMemo(() => {
    if (!columnVisibilityOverride) return baseColumnVisibility;
    return { ...baseColumnVisibility, ...columnVisibilityOverride };
  }, [baseColumnVisibility, columnVisibilityOverride]);

  const { density, cellPad, cycleDensity } = useDensity(config.denseMode);
  const [globalFilter, setGlobalFilter] = useState("");

  // Phase 10 B3: engine-owned draft store for bulk-save mode. Keyed by
  // (rowKey → columnId → nextValue). Populated by <EditableCell> when the
  // caller supplies `onBulkCommit`; flushed on Save (via onBulkCommit) or
  // Discard. Empty state === not dirty. Cells consult this map at render
  // time so the visible value tracks the draft, not the underlying row.
  const bulkMode = !!onBulkCommit;
  const [bulkDrafts, setBulkDrafts] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const setBulkDraft = useCallback(
    (rowKey: string, columnId: string, nextValue: unknown, originalValue: unknown) => {
      setBulkDrafts((prev) => {
        // Same-value writes clear the entry (and the row if empty) so the
        // dirty indicator only fires on real diffs.
        const equal =
          nextValue === originalValue ||
          (nextValue == null && originalValue == null);
        const rowDrafts = { ...(prev[rowKey] ?? {}) };
        if (equal) {
          delete rowDrafts[columnId];
        } else {
          rowDrafts[columnId] = nextValue;
        }
        const next = { ...prev };
        if (Object.keys(rowDrafts).length === 0) {
          delete next[rowKey];
        } else {
          next[rowKey] = rowDrafts;
        }
        return next;
      });
    },
    [],
  );
  const discardBulkDrafts = useCallback(() => setBulkDrafts({}), []);
  const bulkDirtyEngine = Object.keys(bulkDrafts).length > 0;
  const bulkDirty = bulkDirtyEngine || bulkDirtyOverride;
  const saveBulkDrafts = useCallback(async () => {
    if (!onBulkCommit) return;
    setBulkSaving(true);
    try {
      await onBulkCommit(bulkDrafts);
      setBulkDrafts({});
    } catch (err) {
      toast.error("Could not save changes", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBulkSaving(false);
    }
  }, [onBulkCommit, bulkDrafts]);

  // Phase 3 §S9: row accent tinting. The engine owns the mechanism (an inline
  // style plus a left-border class); the host app supplies the row → color
  // policy via registerRowAccentResolver(). See ./rowAccentRegistry.
  const resolveRowAccent = useRowAccentResolver(config.teamAccentReactive);

  // Phase 3 §S9: changed-cell "live pulse" detection. Snapshots the
  // previous `rows` (keyed by config.rowKeyColumn) and diffs on every
  // `rows` change; changed (rowKey, columnId) pairs flash
  // `.animate-live-pulse` for one animation cycle (1.1s, matching the
  // `live-pulse-flash` keyframe in index.css). Skips the initial mount —
  // nothing flashes on first load.
  const prevRowsRef = useRef<Record<string, Record<string, unknown>> | null>(null);
  const [flashKeys, setFlashKeys] = useState<Set<string>>(new Set());
  useEffect(() => {
    const rowKeyCol = config.rowKeyColumn;
    if (!config.liveUpdateHighlight || !rowKeyCol) {
      prevRowsRef.current = null;
      return;
    }
    const nextMap: Record<string, Record<string, unknown>> = {};
    for (const row of rows as unknown as Record<string, unknown>[]) {
      const key = row[rowKeyCol];
      if (key == null) continue;
      nextMap[String(key)] = row;
    }
    const prev = prevRowsRef.current;
    prevRowsRef.current = nextMap;
    if (!prev) return; // first render — nothing to diff against yet

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
  }, [rows, config.liveUpdateHighlight, config.rowKeyColumn, config.columns]);

  // Phase 3: column pinning derived from admin config. Explicit column-level
  // `pinned` ("left" | "right") always wins; when the grid opts into
  // sticky_first_column and no column pins itself, we pin the first
  // ordered non-hidden data column to the left.
  const columnPinning = useMemo<ColumnPinningState>(() => {
    if (!isLoaded) return { left: [], right: [] };
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
  }, [isLoaded, config.columns, config.stickyFirstColumn]);

  // Phase 3: column filters. Seed initial state from the user's saved
  // "pinned filter set" when one exists (their last filter combination on
  // this grid, auto-restored — see useTableState's pinnedFilters), otherwise
  // fall back to each column's admin default_filter — parsed once at mount.
  const initialColumnFilters = useMemo<ColumnFiltersState>(() => {
    if (!isLoaded) return [];
    if (pinnedFilters !== null) return pinnedFilters as ColumnFiltersState;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, config.columns, pinnedFilters]);
  const [columnFilters, setColumnFilters] =
    useState<ColumnFiltersState>(initialColumnFilters);

  // Persists column-filter changes as the user's "pinned filter set" —
  // skips the very first render so loading the saved snapshot doesn't
  // immediately re-save itself.
  const columnFiltersMountedRef = useRef(false);
  useEffect(() => {
    if (!columnFiltersMountedRef.current) {
      columnFiltersMountedRef.current = true;
      return;
    }
    persistFilters(columnFilters as unknown[]);
  }, [columnFilters, persistFilters]);

  const { selectedIdsByGrid, setSelected } = useSelectionStore();
  // Prefer the caller-supplied selection when one is provided; otherwise fall
  // back to the global selection store keyed on gridId.
  const selectedIds = selectionOverride
    ? selectionOverride.selectedIds
    : (selectedIdsByGrid[gridId] ?? []);
  const onSelectionChange = selectionOverride
    ? selectionOverride.onChange
    : (ids: (number | string)[]) => setSelected(gridId, ids as number[]);

  const colHelper = useMemo(() => createColumnHelper<T>(), []);

  // Type-to-edit bridge. The cell cursor from `useCellSelection` is not DOM
  // focus, so a keystroke aimed at the focused cell lands on a window listener
  // rather than inside the cell. That listener turns it into an edit *request*
  // here, and the matching <EditableCell> opens itself via `openWith`. The
  // `nonce` makes it edge-triggered: re-requesting the same cell with the same
  // seed still opens the editor, and no editing state leaves the cell.
  const [editRequest, setEditRequest] = useState<{
    rowKey: string;
    columnId: string;
    seed: string | null;
    nonce: number;
  } | null>(null);

  // Which columns `onBeginEdit` may claim a keystroke for — the same predicate
  // as `canEdit` below, minus the per-row key check the hook cannot do.
  const editableColumnIds = useMemo(() => {
    const ids = new Set<string>();
    if (config.readOnly || (!onCellCommit && !bulkMode)) return ids;
    for (const col of Object.values(config.columns)) {
      if (col.editable) ids.add(col.column_id);
    }
    return ids;
  }, [config.columns, config.readOnly, onCellCommit, bulkMode]);

  const columns: ColumnDef<T, any>[] = useMemo(() => {
    if (!isLoaded) return [];

    const baseCols = Object.values(config.columns)
      .sort((a, b) => a.column_order - b.column_order)
      .map((col) => {
        const sizing = applyColumnSizing(col, config.minColumnWidth);
        const columnId = col.column_id;
        const label = col.label_override || columnId.toUpperCase();
        const tooltip =
          col.tooltip_override ??
          headerTooltips?.[label] ??
          headerTooltips?.[columnId] ??
          null;

        const accessorKey = (accessorFor?.(columnId) ?? columnId) as any;
        return colHelper.accessor(accessorKey, {
          id: columnId,
          header: () => {
            const custom = customHeaders?.[columnId];
            if (custom) {
              return custom({
                column_id: columnId,
                label,
                tooltip,
                delayDuration: config.tooltipDelayDuration,
              });
            }
            return (
              <DefaultColHeader
                label={label}
                tooltip={tooltip}
                delayDuration={config.tooltipDelayDuration}
              />
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
          enableSorting:
            col.allow_sort_mode !== undefined
              ? col.allow_sort_mode !== "none"
              : !!col.allow_sort,
          // Phase 3 column-stub wiring
          enableColumnFilter: !!col.allow_filter,
          enableResizing: !!col.resizable,
          enableGrouping: !!col.group_by,
          cell: (info) => {
            const rawValue = info.getValue();
            const row = info.row.original;
            const rowIndex = info.row.index;
            // Phase 4: unwrap the composite `{ value, meta }` envelope. Flat
            // scalars pass through with meta = {}; anything else gives
            // renderers and link_target routing a stable identity payload
            // without sibling-command lookups.
            const { value: rawUnwrapped, meta } = unwrapCellPayload(rawValue);
            const rowRecord = row as unknown as Record<string, unknown>;

            // Phase 10 B3: swap in the draft value when bulk mode has a
            // pending write for this cell so the visible payload tracks
            // the user's edit before Save fires.
            const cellRowKey = config.rowKeyColumn
              ? (rowRecord as Record<string, unknown>)[config.rowKeyColumn]
              : undefined;
            const draftForCell =
              bulkMode && cellRowKey != null
                ? bulkDrafts[String(cellRowKey)]?.[columnId]
                : undefined;
            const value = draftForCell !== undefined ? draftForCell : rawUnwrapped;

            // Gradient style (config-driven, priority over conditional_format)
            let gradientStyle: CSSProperties | undefined;
            if (col.gradient_from_color && col.gradient_to_color) {
              const minMax = computeColumnMinMax(
                rows as unknown as Record<string, unknown>[],
                columnId,
              );
              if (minMax && typeof value === "number") {
                gradientStyle = getGradientCellStyle(
                  value,
                  minMax.min,
                  minMax.max,
                  col.gradient_from_color,
                  col.gradient_to_color,
                );
              }
            }

            // 1. Per-column caller override
            let content: ReactNode;
            const override = customCells?.[columnId];
            if (override) {
              content = override({
                value,
                row,
                rowIndex,
                column_id: columnId,
                colConfig: col,
                gradientStyle,
              });
            } else {
              // 2. Config-driven media cell_types (Phase 4d Q2) — 100 %
              //    admin-selected in the editor, no convention on column_id.
              //    Meta is merged into the row surface so headshot/team_logo
              //    can pull identity ids from either source without knowing
              //    the difference.
              const rowWithMeta = { ...rowRecord, ...meta };
              const media = renderMediaCell(col.cell_type, value, rowWithMeta);
              if (media !== undefined) {
                content = media;
              } else {
                // 3. Config-driven cell renderer (cell_type + format_string +
                //    gradient + link_target routing via resolveLinkPath).
                //    Phase 7 A2: the legacy column-id `resolveCell` fallback
                //    was removed here — migration 019 seeded
                //    `player_headshot` / `team_logo` on every
                //    DataGrid-consumed grid so the fallback is unreachable
                //    for correctly-seeded rows.
                content = renderCell(
                  value,
                  col,
                  columnId,
                  gradientStyle,
                  navigate,
                  (rowRecord as any).player_id,
                  { meta, row: rowRecord },
                  config.numeralStyle,
                );
              }
            }

            // 4. Phase 8 H3: promote the rendered content to an inline
            //    editor when the column opts in AND the host grid wired
            //    `onCellCommit` (or `onBulkCommit` for Phase 10 B3 bulk
            //    mode) AND the grid isn't globally read-only.
            //    The wrap sits at the end so customCells / media / renderCell
            //    stay in charge of what the cell *looks like* — editability
            //    is a decoration on top.
            const rowKeyValue = cellRowKey;
            const canEdit =
              !!col.editable &&
              (!!onCellCommit || bulkMode) &&
              !config.readOnly &&
              rowKeyValue != null;
            if (canEdit) {
              return (
                <EditableCell
                  rawValue={value}
                  cellType={col.cell_type}
                  openWith={
                    editRequest &&
                    editRequest.rowKey === String(rowKeyValue) &&
                    editRequest.columnId === columnId
                      ? { seed: editRequest.seed, nonce: editRequest.nonce }
                      : null
                  }
                  onCommit={(next) => {
                    if (bulkMode) {
                      // Draft path: no server round-trip; the shared draft
                      // store re-renders the cell with the pending value.
                      setBulkDraft(
                        String(rowKeyValue),
                        columnId,
                        next,
                        rawUnwrapped,
                      );
                      return;
                    }
                    return onCellCommit!(String(rowKeyValue), columnId, next);
                  }}
                >
                  {content}
                </EditableCell>
              );
            }
            return content;
          },
          meta: { align: col.text_align, label },
        });
      });

    // Phase 8 H2: caller-supplied display columns (e.g. CareerStatsGrid's
    // stint-expansion chevron) inject between the config columns and the
    // rank/selection prepends, so rank stays leftmost while the display
    // column sits immediately before the data columns.
    const baseWithPrepend = prependColumns
      ? [...prependColumns, ...baseCols]
      : baseCols;
    const withRank = prependRankColumn(
      baseWithPrepend,
      config.showRanking,
      colHelper as any,
      config.showMedalToggles,
      "end",
    );
    // Phase 10 B2: expander column sits leftmost when active (before rank
    // and selection). Gated on both `config.allowExpansion` AND the caller
    // supplying a `renderSubRow`; either alone is a no-op so an admin flag
    // never forces an empty chevron column.
    const withExpander =
      config.allowExpansion && renderSubRow
        ? [
            (colHelper as any).display({
              id: "__expander__",
              size: 32,
              minSize: 24,
              enableHiding: false,
              enableSorting: false,
              header: () => null,
              cell: ({ row }: { row: Row<T> }) => {
                const detail = renderSubRow(row.original as T, row.index);
                if (detail == null) return null;
                const isExpanded = row.getIsExpanded();
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      row.toggleExpanded();
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse row" : "Expand row"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                );
              },
            }),
            ...withRank,
          ]
        : withRank;
    // Row-key resolution (Phase 7 D1): admin config is the sole source of
    // truth. Every seeded grid has `row_key_column` set (migration 019 +
    // the fixture back-fill). A NULL value at runtime means the grid is
    // mis-seeded and should fail loudly — see the runtime guard below.
    if (!config.rowKeyColumn) {
      throw new Error(
        `DataGrid[${gridId}]: config.rowKeyColumn is required but is ` +
          `null/undefined. Seed row_key_column in app_grid_settings for ` +
          `this grid — the engine no longer accepts a rowKey prop fallback.`,
      );
    }
    const resolvedRowKey = config.rowKeyColumn as any;
    return prependSelectionColumn(
      withExpander,
      !!config.allowSelection,
      selectedIds as number[],
      onSelectionChange as (ids: number[]) => void,
      resolvedRowKey,
      config.selectionPosition,
    );
  }, [
    isLoaded,
    config.columns,
    config.showRanking,
    config.allowSelection,
    config.selectionPosition,
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
    setBulkDraft,
  ]);

  // Phase 2: config-driven stable row IDs. `config.rowKeyColumn` (validated
  // above as non-null) drives TanStack's row keying so selection state and
  // flyouts survive re-sorts and filter changes with zero drift.
  const rowIdKey = config.rowKeyColumn || undefined;
  const getRowId = useMemo(
    () =>
      rowIdKey
        ? (row: T, index: number) => {
            const v = (row as Record<string, unknown>)[rowIdKey];
            return v == null ? String(index) : String(v);
          }
        : undefined,
    [rowIdKey],
  );

  // Phase 5: runtime column order. Seeded from the admin→user merged order
  // (useTableState's mergeUserGridPreference), then owned by the table so
  // DnD reorders apply immediately. Callers that persist admin-editor
  // reorders pass onReorderColumns; end-user reorders always persist via
  // persistColumnOrder regardless of whether that prop is set.
  const configOrder = mergedColumnOrder;
  const [columnOrder, setColumnOrder] = useState<string[]>(configOrder);
  const configOrderJson = JSON.stringify(configOrder);
  useEffect(() => {
    setColumnOrder(configOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configOrderJson]);
  const handleColumnOrderChange = (next: string[]) => {
    setColumnOrder(next);
    persistColumnOrder(next);
    onReorderColumns?.(next);
  };

  // Seed `grouping` from every column configured with group_by=1, matching
  // the Grid Editor preview. Without this, TanStack accepts enableGrouping
  // per column but never activates grouping — the render loop would then
  // fall through to leaf rows and admins see no effect on live screens.
  const initialGrouping = useMemo<GroupingState>(
    () =>
      isLoaded
        ? Object.values(config.columns)
            .filter((c) => !!c.group_by)
            .sort((a, b) => a.column_order - b.column_order)
            .map((c) => c.column_id)
        : [],
    [isLoaded, config.columns],
  );
  const [grouping, setGrouping] = useState<GroupingState>(initialGrouping);
  const initialGroupingKey = initialGrouping.join(",");
  useEffect(() => {
    setGrouping(initialGrouping);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialGroupingKey]);
  const [expanded, setExpanded] = useState<ExpandedState>({});
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
      expanded,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
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
    // Phase 3: column resizing. Individual columns opt in via `resizable`
    // in admin config; the top-level flag just tells TanStack to track
    // resize state. onEnd → single re-layout at drag release keeps the
    // draw cost low even on wide grids.
    enableColumnResizing: true,
    columnResizeMode: "onEnd",
    autoResetPageIndex: false,
    getRowId,
  });

  // Sorted+filtered originals for pagination — matches the visible ordering
  // and lets `<GridWrapper>` slice the already-sorted set.
  const sortedRows = table.getSortedRowModel().rows.map((r) => r.original);

  // ── Cell selection (opt-in) ───────────────────────────────────────────────
  // The cursor moves over the sorted+filtered model and the visible leaf
  // columns, so the rectangle is always the one on screen. The engine's own
  // prepended columns are not data and are excluded by id: a checkbox is not a
  // cell you can copy, and including it would put a blank column in the middle
  // of every paste.
  const selectionRowModel = table.getSortedRowModel().rows;
  const cellRowKeys = useMemo(
    () => (cellSelection ? selectionRowModel.map((r) => r.id) : []),
    [cellSelection, selectionRowModel],
  );
  const visibleLeafColumns = table.getVisibleLeafColumns();
  const cellColumnIds = useMemo(
    () =>
      cellSelection
        ? visibleLeafColumns
            .map((c) => c.id)
            .filter((id) => !ENGINE_COLUMN_IDS.has(id))
        : [],
    [cellSelection, visibleLeafColumns],
  );
  const rowsByKey = useMemo(() => {
    if (!cellSelection) return new Map<string, Row<T>>();
    return new Map(selectionRowModel.map((r) => [r.id, r]));
  }, [cellSelection, selectionRowModel]);
  const getCellText = useCallback(
    (rowKey: string, columnId: string) => {
      const row = rowsByKey.get(rowKey);
      if (!row) return "";
      const cell = row.getVisibleCells().find((c) => c.column.id === columnId);
      if (!cell) return "";
      // Through `unwrapCellPayload` so a cell that carries a render payload
      // copies its value rather than "[object Object]".
      const { value } = unwrapCellPayload(cell.getValue());
      return value == null ? "" : String(value);
    },
    [rowsByKey],
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
        nonce: (prev?.nonce ?? 0) + 1,
      }));
      return true;
    },
  });

  // Phase 8 H1: virtualization. The scroll container ref + `useVirtualizer`
  // are set up unconditionally so the hook order stays stable; `count` is
  // pinned to zero outside virtualized mode so the virtualizer is a no-op.
  const scrollRef = useRef<HTMLDivElement>(null);
  const estimateSize = useCallback(
    () => DENSITY_ROW_HEIGHT[density],
    [density],
  );
  const virtualizedRowCount = isVirtualized ? table.getRowModel().rows.length : 0;
  const rowVirtualizer = useVirtualizer({
    count: virtualizedRowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan,
  });
  // Density flips the estimated row height — force a re-measure so scroll
  // height and offsets track the new density immediately.
  useEffect(() => {
    if (isVirtualized) rowVirtualizer.measure();
  }, [density, isVirtualized, rowVirtualizer]);
  // Filter / sort / global-search changes replace the visible row set —
  // reset scroll so the user always starts at the first match.
  const virtualResetKey = `${globalFilter}::${JSON.stringify(sorting)}::${JSON.stringify(columnFilters)}`;
  useEffect(() => {
    if (isVirtualized) rowVirtualizer.scrollToOffset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualResetKey, isVirtualized]);

  function defaultExport(paginatedRows: T[]) {
    logExport({ export_type: "csv", page: gridId, row_count: paginatedRows.length });
    const headers = table.getVisibleLeafColumns().map((c) => (c.id || "").toUpperCase());
    const csvRows = [
      headers.join(","),
      ...paginatedRows.map((r) =>
        table.getVisibleLeafColumns().map((c) => {
          const v = (r as any)[c.id];
          return v == null ? "" : String(v);
        }).join(","),
      ),
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
    return <GridStatusContent type="loading" message={loadingMessage} />;
  }

  const renderTableSurface = (paginatedRows: T[]) => (
    <DndColumnWrapper
      columnOrder={columnOrder}
      onOrderChange={handleColumnOrderChange}
      enabled={!!config.allowColumnReorder}
    >
      <Table className={config.denseMode ? "table-fixed" : ""}>
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
                    sticky={
                      pinnedSide === "left" ||
                      config.columns[h.column.id]?.link_target === "player_page"
                    }
                    pinnedOffsetLeft={pinLeft}
                    pinnedOffsetRight={pinRight}
                    tooltipDelayDuration={config.tooltipDelayDuration}
                    gridId={gridId}
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
          {(() => {
            // Phase 8 H1: virtualized mode renders every sorted+filtered row
            // through the virtualizer's windowed slice. Non-virtualized mode
            // renders the paginated slice as before.
            const rowsToRender: Row<T>[] = isVirtualized
              ? table.getRowModel().rows
              : isGrouped
                ? table.getRowModel().rows
                : paginatedRows
                    .map((data) =>
                      table.getRowModel().rows.find((r) => r.original === data),
                    )
                    .filter((r): r is NonNullable<typeof r> => !!r);

            if (rowsToRender.length === 0) {
              return <EmptyTableRow colSpan={columns.length} message={emptyMessage} />;
            }

            const renderDataRow = (row: Row<T>, renderIndex: number) => {
              const rank = table.getRowModel().rows.indexOf(row) + 1;
              const wrapClass = config.wrapText ? "" : "whitespace-nowrap";
              const isGroupedRow = row.getIsGrouped();
              const data = row.original as T;
              const dataRecord = data as unknown as Record<string, unknown>;
              // Phase 3 §S9: live-pulse cell flashing keys off this row's
              // resolved row-key value (same field DataGrid's row-id / draft
              // store use elsewhere).
              const rowKeyForRow = config.rowKeyColumn
                ? dataRecord[config.rowKeyColumn]
                : undefined;
              // Phase 3 §S9: row accent tint. Grouped rows are never tinted.
              // `resolveRowAccent` is a pure mapper, so this is one call per
              // row with no hook involved (rules-of-hooks safe).
              const teamAccentStyle = !isGroupedRow
                ? resolveRowAccent(dataRecord)
                : undefined;
              // Phase 10 B2: resolve sub-row detail once per render pass so the
              // main row uses the same value the chevron rendered against.
              const subRowContent =
                config.allowExpansion && renderSubRow && !isGroupedRow
                  ? renderSubRow(data, renderIndex)
                  : null;
              const isExpanded = subRowContent != null && row.getIsExpanded();
              const visibleColSpan = row.getVisibleCells().length;
              const mainRow = (
                <TableRow
                  key={row.id}
                  data-grouped={isGroupedRow || undefined}
                  className={cn(
                    "border-b border-border/50 transition-colors",
                    onRowClick && !isGroupedRow && "cursor-pointer",
                    !config.hoverColor && !isGroupedRow && "hover:bg-muted/30",
                    !isGroupedRow && rowClassName,
                    config.showMedalToggles && !isGroupedRow && getRankRowClass(rank),
                    wrapClass,
                    isGroupedRow && "bg-muted/40 font-medium",
                    // Phase 8 H2: per-row data-driven class overlay for
                    // embedded consumers (e.g. career-total vs stint-child
                    // vs season-header row styling).
                    !isGroupedRow && rowClassNameFor?.(data, renderIndex),
                    // Phase 3 §S9: team-accent left-border tint.
                    teamAccentStyle && "border-l-2 border-l-[color:var(--team-accent)]",
                  )}
                  style={teamAccentStyle}
                  onMouseEnter={
                    config.hoverColor && !isGroupedRow
                      ? (e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor =
                            config.hoverColor!;
                        }
                      : undefined
                  }
                  onMouseLeave={
                    config.hoverColor && !isGroupedRow
                      ? (e) => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = "";
                        }
                      : undefined
                  }
                  onClick={
                    onRowClick && !isGroupedRow
                      ? () => onRowClick(data, renderIndex)
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const align =
                      (cell.column.columnDef.meta as any)?.align || "left";
                    const colConfig = config.columns[cell.column.id];
                    const pinnedSide = cell.column.getIsPinned();
                    const isNameCol =
                      colConfig?.link_target === "player_page";
                    const pinLeft =
                      pinnedSide === "left"
                        ? cell.column.getStart("left")
                        : undefined;
                    const pinRight =
                      pinnedSide === "right"
                        ? cell.column.getAfter("right")
                        : undefined;
                    const sortDir = cell.column.getIsSorted();
                    const cellSortBg =
                      !isGroupedRow && sortDir === "asc"
                        ? (colConfig?.sort_asc_color ?? config.sortAscColor ?? null)
                        : !isGroupedRow && sortDir === "desc"
                        ? (colConfig?.sort_desc_color ?? config.sortDescColor ?? null)
                        : null;
                    // Phase 3 §S9: live-pulse flash for a cell whose value
                    // just changed (see the changed-cell effect above).
                    const isFlashing =
                      config.liveUpdateHighlight &&
                      rowKeyForRow != null &&
                      flashKeys.has(`${rowKeyForRow}:${cell.column.id}`);

                    let content: ReactNode;
                    if (cell.getIsGrouped()) {
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
                    } else if (cell.getIsAggregated()) {
                      content = flexRender(
                        cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell,
                        cell.getContext(),
                      );
                    } else if (cell.getIsPlaceholder()) {
                      content = null;
                    } else {
                      content = flexRender(cell.column.columnDef.cell, cell.getContext());
                    }

                    // Guards against the column-overlap failure mode: the header
                    // (SortableTableHead) is width-constrained via getSize(), but
                    // an unconstrained + nowrap body cell lets long plain-text
                    // values (e.g. a full team name) visually bleed into the next
                    // column instead of wrapping or being clipped. Cap the cell to
                    // the same width the header already commits to, truncate with
                    // an ellipsis, and surface the untruncated value via `title`.
                    const cellMaxWidth = cell.column.getSize?.() ?? cell.column.columnDef.size;
                    const { value: cellPlainValue } = unwrapCellPayload(cell.getValue());
                    const titleText =
                      typeof cellPlainValue === "string" || typeof cellPlainValue === "number"
                        ? String(cellPlainValue)
                        : undefined;

                    // Cell-cursor state. All false when `cellSelection` is off,
                    // in which case the only difference from before is two data
                    // attributes — which is also what makes the cursor testable
                    // and stylable from outside.
                    const isCellSelectable =
                      cells.enabled && !ENGINE_COLUMN_IDS.has(cell.column.id);
                    const isCellFocused =
                      isCellSelectable && cells.isFocused(row.id, cell.column.id);
                    const isCellSelected =
                      isCellSelectable && cells.isSelected(row.id, cell.column.id);
                    const isCellFillPreview =
                      isCellSelectable &&
                      cells.isFillPreview(row.id, cell.column.id);
                    const showFillHandle =
                      isCellSelectable &&
                      !!onRangeFill &&
                      cells.isFillOrigin(row.id, cell.column.id);

                    return (
                      <TableCell
                        key={cell.id}
                        title={titleText}
                        data-row-key={row.id}
                        data-column-id={cell.column.id}
                        data-cell-focused={isCellFocused || undefined}
                        data-cell-selected={isCellSelected || undefined}
                        onMouseDown={
                          isCellSelectable
                            ? (event) =>
                                cells.onCellMouseDown(row.id, cell.column.id, event)
                            : undefined
                        }
                        onMouseEnter={
                          isCellSelectable
                            ? () => cells.onCellMouseEnter(row.id, cell.column.id)
                            : undefined
                        }
                        // Bound on the cell rather than left to the renderer:
                        // `<EditableCell>` binds its own double-click, but a
                        // custom cell does not, so bulk-edit columns had no
                        // double-click path at all. The hook declines for a
                        // column nothing can edit, so this is inert elsewhere.
                        onDoubleClick={
                          isCellSelectable
                            ? () => cells.onCellDoubleClick(row.id, cell.column.id)
                            : undefined
                        }
                        className={cn(
                          `${cellPad} text-${align}`,
                          "overflow-hidden text-ellipsis",
                          // One decision, one class — see cellPosition.ts for
                          // why `sticky` and `relative` cannot both be listed.
                          cellPositionClasses(
                            pinnedSide,
                            isNameCol,
                            isCellSelectable,
                          ),
                          isFlashing && "animate-live-pulse",
                          // `primary` rather than a token of its own: the ring
                          // and the wash are the same affordance the rest of the
                          // shell uses for "this is what you are acting on".
                          isCellSelected && "bg-primary/10",
                          isCellFillPreview && "bg-primary/5",
                          isCellFocused &&
                            "outline outline-1 -outline-offset-1 outline-primary",
                        )}
                        style={{
                          ...(cellMaxWidth !== undefined ? { maxWidth: cellMaxWidth } : {}),
                          ...(cellSortBg
                            ? { backgroundColor: cellSortBg, opacity: 0.85 }
                            : {}),
                          ...(pinLeft !== undefined ? { left: pinLeft } : {}),
                          ...(pinRight !== undefined ? { right: pinRight } : {}),
                        }}
                      >
                        {content}
                        {showFillHandle && (
                          <span
                            role="presentation"
                            aria-hidden
                            data-fill-handle=""
                            title="Drag down to fill"
                            onMouseDown={cells.onFillHandleMouseDown}
                            className="absolute right-0 bottom-0 h-1.5 w-1.5 cursor-crosshair bg-primary"
                          />
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
              if (!isExpanded) return mainRow;
              return (
                <Fragment key={row.id}>
                  {mainRow}
                  <TableRow
                    key={`${row.id}-detail`}
                    data-detail-row="true"
                    className="border-b border-border/50 bg-muted/10"
                  >
                    <TableCell colSpan={visibleColSpan} className="px-4 py-3">
                      {subRowContent}
                    </TableCell>
                  </TableRow>
                </Fragment>
              );
            };

            if (!isVirtualized) {
              return rowsToRender.map(renderDataRow);
            }

            // Phase 8 H1: windowed render. Only virtual items land in the DOM;
            // spacer <tr>s reserve the remaining scroll height so column widths
            // and the sticky header stay aligned.
            const virtualItems = rowVirtualizer.getVirtualItems();
            const totalSize = rowVirtualizer.getTotalSize();
            const paddingTop =
              virtualItems.length > 0 ? virtualItems[0].start : 0;
            const paddingBottom =
              virtualItems.length > 0
                ? totalSize - virtualItems[virtualItems.length - 1].end
                : 0;

            return (
              <>
                {paddingTop > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={columns.length} style={{ height: paddingTop }} />
                  </tr>
                )}
                {virtualItems.map((vi) => {
                  const row = rowsToRender[vi.index];
                  if (!row) return null;
                  return renderDataRow(row, vi.index);
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={columns.length} style={{ height: paddingBottom }} />
                  </tr>
                )}
              </>
            );
          })()}
        </TableBody>
        {hasAggregates(config.columns) && (
          <TableFooter>
            <TableRow className="border-t-2 border-border bg-muted/40 font-medium text-xs">
              {table.getVisibleLeafColumns().map((col) => {
                const colConfig = config.columns[col.id];
                const aggFn = colConfig?.aggregate_function as any;
                if (!aggFn) return <TableCell key={col.id} className={cellPad} />;
                const result = computeAggValue(
                  rows as unknown as Record<string, unknown>[],
                  col.id,
                  aggFn,
                );
                const display = formatAggValue(result, colConfig?.format_string);
                return (
                  <TableCell
                    key={col.id}
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
  );

  // Phase 8 H1: virtualized mode swaps `<GridWrapper>` for a bounded scroll
  // container and windows the row set through `@tanstack/react-virtual`.
  // Pagination is disabled (the virtualizer handles the row window instead)
  // but every other GridConfig property still applies — GridHeader renders
  // as normal, sort/filter/pinning flow through the same TanStack surface,
  // and row-count comes from the filtered row model.
  if (isVirtualized) {
    return (
      <div className="space-y-2">
        <GridHeader
          table={table}
          config={config}
          density={density}
          onDensityChange={cycleDensity}
          search={globalFilter}
          onSearchChange={setGlobalFilter}
          searchPlaceholder={searchPlaceholder}
          filtersSlot={filtersSlot}
          onExport={
            config.allowExport
              ? () => (onExport ?? defaultExport)(sortedRows)
              : undefined
          }
          bulkDirty={bulkDirty}
          bulkSaving={bulkSaving}
          onBulkSave={bulkMode ? saveBulkDrafts : undefined}
          onBulkDiscard={bulkMode ? discardBulkDrafts : undefined}
          dashboardPin={showDashboardPinButton ? dashboardPin : undefined}
          onDashboardPinToggle={
            showDashboardPinButton ? () => setDashboardPin(!dashboardPin) : undefined
          }
        />
        <div
          ref={scrollRef}
          className={cn(
            "rounded border overflow-auto",
            virtualizedMaxHeightClass,
          )}
        >
          {renderTableSurface(sortedRows)}
        </div>
        {config.footer && (
          <p className="text-xs text-muted-foreground pt-1">{config.footer}</p>
        )}
      </div>
    );
  }

  // Phase 7 B2: embedded mode short-circuits GridWrapper + GridHeader. Renders
  // the table body against the fully sorted set (no pagination slicing) so
  // dashboard tiles show the full data. The caller supplies its own toolbar
  // via `customToolbar` — typically a single `<ColumnToggle>` alongside a
  // widget label. Callers that need pagination inside an embed should not
  // opt into this mode.
  if (isEmbedded) {
    return (
      <div className="space-y-2">
        {customToolbar}
        {/* Phase 10 B3: embedded consumers still get Save/Discard when in
            bulk mode — the standard <GridHeader> is suppressed but the
            edit affordance must not be. Rendered as a minimal strip so
            it doesn't fight for space with the caller's own toolbar. */}
        {bulkMode && bulkDirty && (
          <div className="flex items-center justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              aria-label="Discard unsaved edits"
              disabled={bulkSaving}
              onClick={discardBulkDrafts}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Discard
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              aria-label="Save unsaved edits"
              disabled={bulkSaving}
              onClick={() => void saveBulkDrafts()}
            >
              <Save className="h-3.5 w-3.5" />
              {bulkSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
        <div className="rounded border overflow-auto">
          {renderTableSurface(sortedRows)}
        </div>
      </div>
    );
  }

  return (
    <GridWrapper
      rows={sortedRows}
      defaultPageSize={config.defaultPageSize}
      pageSizeOptions={config.pageSizeOptions}
      // Pagination and group_by are mutually exclusive at render time:
      // slicing the leaf list would break the group headers' subRow
      // accounting. When admins enable group_by, the grouped view shows
      // the full aggregate tree instead of a paged leaf list.
      paginationEnabled={config.paginationEnabled && !isGrouped}
      // `<GridHeader>` renders the row count from the live table model —
      // delegating here avoids a duplicate count between wrapper and header.
      showRowCount={false}
    >
      {(paginatedRows) => (
        <div className="space-y-2">
          <GridHeader
            table={table}
            config={config}
            density={density}
            onDensityChange={cycleDensity}
            search={globalFilter}
            onSearchChange={setGlobalFilter}
            searchPlaceholder={searchPlaceholder}
            filtersSlot={filtersSlot}
            onExport={
              config.allowExport
                ? () => (onExport ?? defaultExport)(paginatedRows)
                : undefined
            }
            bulkDirty={bulkDirty}
            bulkSaving={bulkSaving}
            onBulkSave={bulkMode ? saveBulkDrafts : undefined}
            onBulkDiscard={bulkMode ? discardBulkDrafts : undefined}
            dashboardPin={showDashboardPinButton ? dashboardPin : undefined}
            onDashboardPinToggle={
              showDashboardPinButton ? () => setDashboardPin(!dashboardPin) : undefined
            }
          />

          <div className="rounded border overflow-auto">
            {renderTableSurface(paginatedRows)}
          </div>
          {config.footer && (
            <p className="text-xs text-muted-foreground pt-1">
              {config.footer}
            </p>
          )}
        </div>
      )}
    </GridWrapper>
  );
}

// Re-export the row-click hook so grids that open the player flyout on click
// keep a single import surface (`import { useRowClickHandler } from "…/DataGrid"`).
export { useRowClickHandler } from "../../hooks/useRowClickHandler";
