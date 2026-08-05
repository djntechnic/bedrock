/**
 * @file SortableTableHead.tsx
 * @module frontend/src/components
 * @description Shared sortable column header component. Applies column-level sort colors
 * with grid-level fallback, dotted-underline tooltip, and alignment helpers.
 *
 * Sort color resolution: col.sort_asc_color ?? grid.sort_asc_color ?? null
 * (column overrides grid; grid is fallback; null = no inline style).
 */

import type { MouseEvent, KeyboardEvent, CSSProperties } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, GripVertical } from "lucide-react";
import { flexRender } from "@tanstack/react-table";
import type { Header } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { TableHead } from "./ui/table";
import type { GridColumnSetting } from "../hooks/useAdminPlatform";
import { cn } from "../lib/utils";
import { log } from "../utils/logger";
import { DEFAULT_TOOLTIP_DELAY } from "../types/grid";

/**
 * Column `meta` fields consumed by the shared header/cell renderers. Populated
 * when each grid builds its column defs (`meta: { align, label }`).
 */
interface GridColumnMeta {
  /** Horizontal alignment: `"left" | "center" | "right"`. Defaults to `"left"`. */
  align?: string;
  /** Human-readable label surfaced in the column-toggle menu. */
  label?: string;
}

interface SortableTableHeadProps<T> {
  header: Header<T, unknown>;
  /** Column-level config — provides per-column sort colors and tooltip. */
  colConfig?: GridColumnSetting;
  /** Grid-level ascending sort color (fallback when column has none). */
  gridSortAscColor?: string | null;
  /** Grid-level descending sort color (fallback when column has none). */
  gridSortDescColor?: string | null;
  /** Additional CSS classes applied to the TableHead element. */
  className?: string;
  /** When true, pins this header cell at left:0 for horizontal scroll freeze. */
  sticky?: boolean;
  /** Tooltip open latency (ms). Config-driven; falls back to the centralized default. */
  tooltipDelayDuration?: number;
  /** Grid identifier surfaced on structured sort-interaction logs. */
  gridId?: string;
  /** Sticky offset (px) applied via inline style when the column is pinned left. */
  pinnedOffsetLeft?: number;
  /** Sticky offset (px) applied via inline style when the column is pinned right. */
  pinnedOffsetRight?: number;
  /**
   * When set, this header participates in `@dnd-kit` column reordering under
   * the surrounding `SortableContext` (mounted by `useDraggableColumns`). A
   * grip icon appears next to the label and owns the drag listeners so
   * clicking the cell body still triggers the sort toggle unchanged.
   * Omit to opt this header out of DnD (e.g. static rank/selection cells).
   */
  dndId?: string;
}

/**
 * Renders a single sortable <th> cell with:
 * - Sort icon (chevron-up / chevron-down / unsorted)
 * - Resolved background color when the column is sorted
 * - Optional tooltip via colConfig.tooltip_override (dotted-underline trigger)
 * - Text alignment from column meta
 */
/**
 * Subcomponent that calls `useSortable` under a `SortableContext`. Kept in its
 * own component so the hook is only invoked when a `dndId` is provided —
 * safely under React's rules-of-hooks.
 */
function DraggableSortableTableHead<T>(
  props: SortableTableHeadProps<T> & { dndId: string },
) {
  const sortable = useSortable({ id: props.dndId });
  const dndStyle: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.6 : undefined,
  };
  return (
    <SortableTableHeadInner
      {...props}
      dndRef={sortable.setNodeRef}
      dndStyle={dndStyle}
      dndAttributes={sortable.attributes as unknown as Record<string, unknown>}
      dndListeners={
        (sortable.listeners ?? {}) as React.HTMLAttributes<HTMLElement>
      }
    />
  );
}

export function SortableTableHead<T>(props: SortableTableHeadProps<T>) {
  if (props.dndId) {
    return <DraggableSortableTableHead {...props} dndId={props.dndId} />;
  }
  return <SortableTableHeadInner {...props} />;
}

interface InnerProps<T> extends SortableTableHeadProps<T> {
  dndRef?: (node: HTMLElement | null) => void;
  dndStyle?: CSSProperties;
  dndAttributes?: Record<string, unknown>;
  dndListeners?: React.HTMLAttributes<HTMLElement>;
}

function SortableTableHeadInner<T>({
  header,
  colConfig,
  gridSortAscColor,
  gridSortDescColor,
  className,
  sticky = false,
  tooltipDelayDuration,
  gridId,
  pinnedOffsetLeft,
  pinnedOffsetRight,
  dndId,
  dndRef,
  dndStyle,
  dndAttributes,
  dndListeners,
}: InnerProps<T>) {
  const sortDir = header.column.getIsSorted();
  const canSort = header.column.getCanSort();
  const align = (header.column.columnDef.meta as GridColumnMeta | undefined)?.align || "left";
  const tipDelay = tooltipDelayDuration ?? DEFAULT_TOOLTIP_DELAY;

  // Native aria-sort announcement. Only sortable headers advertise a sort
  // state; static columns omit the attribute entirely.
  const ariaSort: "ascending" | "descending" | "none" | undefined = !canSort
    ? undefined
    : sortDir === "asc"
    ? "ascending"
    : sortDir === "desc"
    ? "descending"
    : "none";

  // Column-level sort color overrides grid-level; null means no inline style
  const sortBg =
    sortDir === "asc"
      ? (colConfig?.sort_asc_color ?? gridSortAscColor ?? null)
      : sortDir === "desc"
      ? (colConfig?.sort_desc_color ?? gridSortDescColor ?? null)
      : null;

  const tooltipText = colConfig?.tooltip_override ?? null;

  // Phase 2 sort-mode enum (`none|asc|desc|both`). When the column locks a
  // direction, override TanStack's default 3-state toggle so the header
  // only ever cycles between "cleared" and the locked direction.
  //   - "asc"  → click clamps to ascending; a second click clears sorting.
  //   - "desc" → click clamps to descending; a second click clears sorting.
  //   - "both" (default) / undefined → normal asc → desc → none cycle.
  //   - "none" → column.getCanSort() is false; handler is never invoked.
  const sortMode = colConfig?.allow_sort_mode;
  const toggleHandler = header.column.getToggleSortingHandler();
  const handleSortClick = (
    event: MouseEvent<HTMLTableCellElement> | KeyboardEvent<HTMLTableCellElement>,
  ) => {
    if (!canSort) return;

    if (sortMode === "asc" || sortMode === "desc") {
      const targetDesc = sortMode === "desc";
      const targetDir = sortMode === "desc" ? "descending" : "ascending";
      const willClear = sortDir === sortMode;
      log.info(
        {
          gridId,
          action: "sort",
          columnId: header.column.id,
          direction: willClear ? "none" : targetDir,
          mode: sortMode,
        },
        "SortableTableHead: sort interaction (locked direction)",
      );
      if (willClear) {
        header.column.clearSorting();
      } else {
        // toggleSorting(desc, multi) — force the locked direction rather
        // than cycling through TanStack's default asc/desc/none loop.
        header.column.toggleSorting(targetDesc, false);
      }
      return;
    }

    const next =
      sortDir === "asc" ? "descending" : sortDir === "desc" ? "none" : "ascending";
    log.info(
      { gridId, action: "sort", columnId: header.column.id, direction: next },
      "SortableTableHead: sort interaction",
    );
    toggleHandler?.(event);
  };

  // The header is only reachable via Tab when @dnd-kit's drag `attributes`
  // happen to be spread onto it (dndId set — see DraggableSortableTableHead);
  // when it is, Enter/Space must trigger the same sort toggle as a click, or
  // the header looks keyboard-operable without actually being so.
  const handleSortKeyDown = (event: KeyboardEvent<HTMLTableCellElement>) => {
    if (!canSort) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSortClick(event);
  };

  const labelContent = (
    <span
      className={cn("flex w-full items-center gap-1 cursor-pointer hover:text-foreground", {
        "justify-end": align === "right",
        "justify-center": align === "center",
        "justify-start": align !== "right" && align !== "center",
      })}
    >
      {tooltipText ? (
        <TooltipProvider delayDuration={tipDelay}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="underline decoration-dotted cursor-help">
                {flexRender(header.column.columnDef.header, header.getContext())}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {tooltipText}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        flexRender(header.column.columnDef.header, header.getContext())
      )}
      {canSort && (
        sortDir === "asc" ? (
          <ChevronUp className="h-3 w-3 shrink-0 text-primary" strokeWidth={3} />
        ) : sortDir === "desc" ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-primary" strokeWidth={3} />
        ) : (
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
        )
      )}
    </span>
  );

  // Defensive lookups — TanStack v8 exposes these methods but test mocks
  // often stub only the fields they exercise. Falling back to false keeps
  // legacy callers rendering without opting into resize.
  const canResize = header.column.getCanResize?.() ?? false;
  const isResizing = header.column.getIsResizing?.() ?? false;

  return (
    <TableHead
      key={header.id}
      ref={dndRef}
      aria-sort={ariaSort}
      {...(dndAttributes ?? {})}
      className={cn(
        `text-${align} font-medium text-muted-foreground select-none relative`,
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // `group` opts the descendant grip button into `group-hover` so the
        // handle becomes visible whenever the whole header cell is hovered,
        // not just its own 8px-wide surface (which was effectively
        // ungrabbable).
        dndId && "group",
        // When the caller supplies pinned offsets we let inline style position
        // the cell; otherwise fall back to the legacy left:0 utility so
        // callers that just pass `sticky` (e.g. link_target="player_page")
        // keep their existing look.
        sticky &&
          (pinnedOffsetLeft !== undefined || pinnedOffsetRight !== undefined
            ? "sticky z-20 bg-muted/90"
            : "sticky left-0 z-20 bg-muted/90"),
        className,
      )}
      style={{
        width: header.getSize?.() ?? header.column.columnDef.size,
        backgroundColor: sortBg ?? undefined,
        ...(pinnedOffsetLeft !== undefined ? { left: pinnedOffsetLeft } : {}),
        ...(pinnedOffsetRight !== undefined ? { right: pinnedOffsetRight } : {}),
        ...(dndStyle ?? {}),
      }}
      onClick={handleSortClick}
      onKeyDown={handleSortKeyDown}
    >
      {dndId && dndListeners && (
        <button
          type="button"
          aria-label={`Reorder ${header.column.id} column`}
          onClick={(e) => e.stopPropagation()}
          {...dndListeners}
          className="absolute left-0 top-0 h-full w-3 cursor-grab touch-none text-muted-foreground/60 hover:text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex items-center justify-center"
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      {labelContent}
      {canResize && (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${header.column.id} column`}
          onMouseDown={(e) => {
            // Stop the click from also triggering the sort toggle when the
            // user grabs the resize handle.
            e.stopPropagation();
            header.getResizeHandler()?.(e);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            header.getResizeHandler()?.(e);
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 hover:opacity-100 transition-opacity",
            isResizing ? "bg-primary opacity-100" : "bg-border",
          )}
        />
      )}
    </TableHead>
  );
}
