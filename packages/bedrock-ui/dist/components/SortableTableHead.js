import { jsx, jsxs } from "react/jsx-runtime";
import { ChevronUp, ChevronDown, ChevronsUpDown, GripVertical } from "lucide-react";
import { flexRender } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip.js";
import { TableHead } from "./ui/table.js";
import { cn } from "../lib/utils.js";
import { log } from "../utils/logger.js";
import { DEFAULT_TOOLTIP_DELAY } from "../types/grid.js";
function DraggableSortableTableHead(props) {
  const sortable = useSortable({ id: props.dndId });
  const dndStyle = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.6 : void 0
  };
  return /* @__PURE__ */ jsx(
    SortableTableHeadInner,
    {
      ...props,
      dndRef: sortable.setNodeRef,
      dndStyle,
      dndAttributes: sortable.attributes,
      dndListeners: sortable.listeners ?? {}
    }
  );
}
function SortableTableHead(props) {
  if (props.dndId) {
    return /* @__PURE__ */ jsx(DraggableSortableTableHead, { ...props, dndId: props.dndId });
  }
  return /* @__PURE__ */ jsx(SortableTableHeadInner, { ...props });
}
function SortableTableHeadInner({
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
  dndListeners
}) {
  const sortDir = header.column.getIsSorted();
  const canSort = header.column.getCanSort();
  const align = header.column.columnDef.meta?.align || "left";
  const tipDelay = tooltipDelayDuration ?? DEFAULT_TOOLTIP_DELAY;
  const ariaSort = !canSort ? void 0 : sortDir === "asc" ? "ascending" : sortDir === "desc" ? "descending" : "none";
  const sortBg = sortDir === "asc" ? colConfig?.sort_asc_color ?? gridSortAscColor ?? null : sortDir === "desc" ? colConfig?.sort_desc_color ?? gridSortDescColor ?? null : null;
  const tooltipText = colConfig?.tooltip_override ?? null;
  const sortMode = colConfig?.allow_sort_mode;
  const toggleHandler = header.column.getToggleSortingHandler();
  const handleSortClick = (event) => {
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
          mode: sortMode
        },
        "SortableTableHead: sort interaction (locked direction)"
      );
      if (willClear) {
        header.column.clearSorting();
      } else {
        header.column.toggleSorting(targetDesc, false);
      }
      return;
    }
    const next = sortDir === "asc" ? "descending" : sortDir === "desc" ? "none" : "ascending";
    log.info(
      { gridId, action: "sort", columnId: header.column.id, direction: next },
      "SortableTableHead: sort interaction"
    );
    toggleHandler?.(event);
  };
  const handleSortKeyDown = (event) => {
    if (!canSort) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleSortClick(event);
  };
  const labelContent = /* @__PURE__ */ jsxs(
    "span",
    {
      className: cn("flex w-full items-center gap-1 cursor-pointer hover:text-foreground", {
        "justify-end": align === "right",
        "justify-center": align === "center",
        "justify-start": align !== "right" && align !== "center"
      }),
      children: [
        tooltipText ? /* @__PURE__ */ jsx(TooltipProvider, { delayDuration: tipDelay, children: /* @__PURE__ */ jsxs(Tooltip, { children: [
          /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx("span", { className: "underline decoration-dotted cursor-help", children: flexRender(header.column.columnDef.header, header.getContext()) }) }),
          /* @__PURE__ */ jsx(TooltipContent, { side: "top", className: "text-xs", children: tooltipText })
        ] }) }) : flexRender(header.column.columnDef.header, header.getContext()),
        canSort && (sortDir === "asc" ? /* @__PURE__ */ jsx(ChevronUp, { className: "h-3 w-3 shrink-0 text-primary", strokeWidth: 3 }) : sortDir === "desc" ? /* @__PURE__ */ jsx(ChevronDown, { className: "h-3 w-3 shrink-0 text-primary", strokeWidth: 3 }) : /* @__PURE__ */ jsx(ChevronsUpDown, { className: "h-3 w-3 shrink-0 opacity-40" }))
      ]
    }
  );
  const canResize = header.column.getCanResize?.() ?? false;
  const isResizing = header.column.getIsResizing?.() ?? false;
  return /* @__PURE__ */ jsxs(
    TableHead,
    {
      ref: dndRef,
      "aria-sort": ariaSort,
      ...dndAttributes ?? {},
      className: cn(
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
        sticky && (pinnedOffsetLeft !== void 0 || pinnedOffsetRight !== void 0 ? "sticky z-20 bg-muted/90" : "sticky left-0 z-20 bg-muted/90"),
        className
      ),
      style: {
        width: header.getSize?.() ?? header.column.columnDef.size,
        backgroundColor: sortBg ?? void 0,
        ...pinnedOffsetLeft !== void 0 ? { left: pinnedOffsetLeft } : {},
        ...pinnedOffsetRight !== void 0 ? { right: pinnedOffsetRight } : {},
        ...dndStyle ?? {}
      },
      onClick: handleSortClick,
      onKeyDown: handleSortKeyDown,
      children: [
        dndId && dndListeners && /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            "aria-label": `Reorder ${header.column.id} column`,
            onClick: (e) => e.stopPropagation(),
            ...dndListeners,
            className: "absolute left-0 top-0 h-full w-3 cursor-grab touch-none text-muted-foreground/60 hover:text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex items-center justify-center",
            children: /* @__PURE__ */ jsx(GripVertical, { className: "h-3 w-3" })
          }
        ),
        labelContent,
        canResize && /* @__PURE__ */ jsx(
          "span",
          {
            role: "separator",
            "aria-orientation": "vertical",
            "aria-label": `Resize ${header.column.id} column`,
            onMouseDown: (e) => {
              e.stopPropagation();
              header.getResizeHandler()?.(e);
            },
            onTouchStart: (e) => {
              e.stopPropagation();
              header.getResizeHandler()?.(e);
            },
            onClick: (e) => e.stopPropagation(),
            className: cn(
              "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 hover:opacity-100 transition-opacity",
              isResizing ? "bg-primary opacity-100" : "bg-border"
            )
          }
        )
      ]
    },
    header.id
  );
}
export {
  SortableTableHead
};
//# sourceMappingURL=SortableTableHead.js.map
