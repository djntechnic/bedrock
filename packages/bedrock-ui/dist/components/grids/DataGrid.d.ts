/**
 * @file DataGrid.tsx
 * @module frontend/src/components/grids
 * @description Centralized, config-driven grid engine. Given a `gridId` and
 * `rows`, resolves the admin `GridConfig` and renders the full stack —
 * `<GridWrapper>` pagination shell, `<GridHeader>` toolbar, `<Table>` with
 * sticky/striping/dense/wrap/hover/sort/rank-highlight wiring, aggregate footer, empty
 * and loading states — with zero per-page boilerplate.
 *
 * Extension slots let the caller specialize a grid without dropping back into
 * ad-hoc `useReactTable` markup:
 *   - `customCells` / `customHeaders`   → per-column render overrides
 *   - `headerTooltips`                  → static tooltip map by label or column_id
 *   - `filtersSlot`                     → inline filter chips in the header
 *   - `onRowClick` / `onExport`         → domain callbacks
 *   - `gridRef`                         → the sorted row order, pulled on demand
 *
 * The engine owns state (sorting, columnVisibility, globalFilter, density,
 * selection), column building, the cell pipeline (`customCells →
 * renderMediaCell → renderCell` with gradient handling), rank + selection column prepend,
 * rank-highlight row gating, and every GridConfig property from CLAUDE.md §S2. Pages
 * become dumb shells that fetch data and hand it off.
 */
import { type ReactNode, type CSSProperties, type Ref } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { type GridColumnSetting } from "../../hooks/useAdminPlatform";
import type { CellRange, CellRangeFill, CellRangePaste } from "./useCellSelection";
import type { SelectionColumnOptions } from "../../utils/gridUtils";
import { type BulkDrafts } from "./bulkDraftStore";
/** Contract passed to a `customCells` override. */
export interface CustomCellCtx<T> {
    value: unknown;
    row: T;
    rowIndex: number;
    column_id: string;
    /** Full column config — expose format_string, cell_type, colors, etc. */
    colConfig: GridColumnSetting;
    gradientStyle?: CSSProperties;
    /**
     * This row's key, or `null` when the grid config names no `rowKeyColumn`.
     * A custom cell that writes a draft needs it; one that only renders does not.
     */
    rowKey: string | null;
    /**
     * The pending draft for this cell, or `undefined` when there is none.
     *
     * `value` above already reflects it, so a renderer that just displays the
     * cell can ignore this. It is here for the cell that has to tell edited from
     * unedited — a dirty marker, a revert affordance, a diff.
     */
    draftValue: unknown;
    /**
     * Write this cell's draft.
     *
     * A consumer that supplies its own editor for a column previously had no way
     * into the store the platform already keeps, so it had to reimplement the
     * buffer and the Save/Discard bar alongside it. Writing the same value back
     * clears the entry, exactly as an inline edit does.
     */
    setDraft: (nextValue: unknown) => void;
}
/** Contract passed to a `customHeaders` override. */
export interface CustomHeaderCtx {
    column_id: string;
    label: string;
    tooltip: string | null;
    delayDuration: number;
}
/**
 * The imperative surface a host can pull from, via the `gridRef` prop.
 *
 * Deliberately a pull rather than a push: the questions it answers are
 * "what is on screen *right now*?", asked at the moment a dialog opens, and a
 * callback prop would re-render every consumer on every sort to answer a
 * question almost nobody is asking.
 */
export interface DataGridHandle {
    /**
     * The row keys of the sorted, filtered row model, top to bottom —
     * `getRowId` applied, so these are the same keys `CellRangePaste.rowKeys`
     * reports and the same ones the row `data-row-key` attributes carry.
     *
     * Sorted and filtered, but *not* paginated: this is the same model
     * `<GridWrapper>` slices a page out of, so on a paginated grid it spans
     * every page. A caller that wants the page needs the page's own bounds.
     *
     * This is the model's order, not the DOM's, so it stays complete and correct
     * under virtualisation — where reading `[data-row-key]` out of the document
     * sees only the rendered window.
     */
    getSortedRowKeys(): string[];
}
export interface DataGridProps<T extends Record<string, any>> {
    /** grid_id from `app_grid_settings`; drives the config lookup. */
    gridId: string;
    /**
     * Receives the grid's {@link DataGridHandle}. A plain prop rather than a
     * real `ref`, because `DataGrid` is generic in `T` and `forwardRef` erases
     * that type parameter — a host would have to cast to get it back. Works with
     * `useRef` and with a callback ref exactly as a `ref` would.
     */
    gridRef?: Ref<DataGridHandle>;
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
     * Header label, tooltips and selection cap for the checkbox column.
     *
     * `prependSelectionColumn` has taken these since it was written, but the
     * engine called it with defaults only, so a grid whose selection means
     * something specific — MLBTracker's Trends page compares at most three
     * players under a "Cmp" header — could not say so. Defaults are unchanged:
     * "Sel", no cap.
     */
    selectionOptions?: SelectionColumnOptions;
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
    onCellCommit?: (rowId: string, columnId: string, nextValue: unknown) => void | Promise<void>;
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
    onBulkCommit?: (drafts: Record<string, Record<string, unknown>>) => void | Promise<void>;
    /**
     * Phase 10 B3: force the Save/Discard bar visible even when the engine
     * draft store is empty. Use when the consumer maintains its own row-
     * level overlay (add/delete rows, cascading dropdowns) that the engine
     * doesn't track — the header Save button then reflects the union of
     * consumer and engine dirty state, so users always see one Save button.
     */
    bulkDirtyOverride?: boolean;
    /**
     * Bypass the engine-owned draft store and drive it from caller-owned state,
     * mirroring `selectionOverride`.
     *
     * The store was module-private, so the three gestures that make a bulk grid
     * worth having — fill-down, spreadsheet paste, apply-to-selected — write
     * many cells at once from outside any cell and had nowhere to write. A
     * consumer that needed them reimplemented the buffer, the dirty flag and the
     * Save/Discard bar the engine already ships.
     *
     * `drafts` is the same `rowKey → columnId → nextValue` shape the engine
     * keeps and `onChange` receives the whole next map, so the caller can merge,
     * validate or refuse a write. Supplying it turns bulk mode on by itself: a
     * caller that owns the buffer usually owns the save too, and `onBulkCommit`
     * stays optional.
     */
    draftsOverride?: {
        drafts: BulkDrafts;
        onChange: (next: BulkDrafts) => void;
    };
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
export default function DataGrid<T extends Record<string, any>>({ gridId, gridRef, rows, isLoading, filtersSlot, onRowClick, onExport, customCells, customHeaders, headerTooltips, emptyMessage, searchPlaceholder, loadingMessage, accessorFor, selectionOverride, selectionOptions, onReorderColumns, isEmbedded, customToolbar, columnVisibilityOverride, variant, overscan, virtualizedMaxHeightClass, prependColumns, rowClassNameFor, onCellCommit, onBulkCommit, bulkDirtyOverride, draftsOverride, renderSubRow, cellSelection, onRangeCopy, onRangePaste, onRangeFill, }: DataGridProps<T>): import("react").JSX.Element;
export { useRowClickHandler } from "../../hooks/useRowClickHandler";
