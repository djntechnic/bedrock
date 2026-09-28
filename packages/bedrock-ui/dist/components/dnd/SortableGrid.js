import { jsxs, jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useRef, useCallback, useId, useEffect } from "react";
import { cn } from "../../lib/utils.js";
const SORTABLE_INSTRUCTIONS = "Press Space or Enter to pick up. While holding, use the arrow keys to move, Space or Enter to drop, or Escape to cancel.";
function clamp(value, max) {
  return Math.min(Math.max(value, 0), max);
}
function displayPosition(index, drag) {
  if (!drag) return index;
  const { sourceIndex: from, targetIndex: to } = drag;
  if (index === from) return to;
  if (from < to && index > from && index <= to) return index - 1;
  if (from > to && index >= to && index < from) return index + 1;
  return index;
}
function useSortableGrid({
  itemCount,
  onReorder,
  columns = 1,
  getItemLabel,
  disabled = false
}) {
  const [drag, setDragState] = useState(null);
  const dragRef = useRef(null);
  const setDrag = useCallback((next) => {
    dragRef.current = next;
    setDragState(next);
  }, []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const itemRefs = useRef([]);
  const instructionsId = useId();
  const lastIndex = Math.max(itemCount - 1, 0);
  const cols = Math.max(1, Math.floor(columns));
  const label = useCallback(
    (index) => getItemLabel?.(index) ?? `Item ${index + 1}`,
    [getItemLabel]
  );
  useEffect(() => {
    setActiveIndex((i) => clamp(i, lastIndex));
  }, [lastIndex]);
  useEffect(() => {
    if (disabled) setDrag(null);
  }, [disabled, setDrag]);
  const commit = useCallback(
    (state) => {
      const { sourceIndex, targetIndex } = state;
      setDrag(null);
      setActiveIndex(targetIndex);
      if (sourceIndex === targetIndex) {
        setAnnouncement(`${label(sourceIndex)} dropped. Position unchanged.`);
        return;
      }
      setAnnouncement(
        `${label(sourceIndex)} dropped at position ${targetIndex + 1} of ${itemCount}.`
      );
      onReorder(sourceIndex, targetIndex);
    },
    [itemCount, label, onReorder, setDrag]
  );
  const cancel = useCallback(
    (state) => {
      setDrag(null);
      setActiveIndex(state.sourceIndex);
      setAnnouncement(
        `Reorder cancelled. ${label(state.sourceIndex)} returned to position ${state.sourceIndex + 1} of ${itemCount}.`
      );
    },
    [itemCount, label, setDrag]
  );
  const arrowOffset = (key) => {
    switch (key) {
      case "ArrowLeft":
        return -1;
      case "ArrowRight":
        return 1;
      case "ArrowUp":
        return -cols;
      case "ArrowDown":
        return cols;
      default:
        return null;
    }
  };
  const getItemProps = (index) => {
    const isGrabbed = drag?.sourceIndex === index;
    const onKeyDown = (event) => {
      if (event.target !== event.currentTarget) return;
      if (drag?.mode === "pointer") return;
      const key = event.key;
      const offset = arrowOffset(key);
      if (drag) {
        if (key === " " || key === "Enter") {
          event.preventDefault();
          commit(drag);
        } else if (key === "Escape") {
          event.preventDefault();
          cancel(drag);
        } else if (offset !== null) {
          event.preventDefault();
          const next2 = clamp(drag.targetIndex + offset, lastIndex);
          if (next2 === drag.targetIndex) return;
          setDrag({ ...drag, targetIndex: next2 });
          setAnnouncement(
            `${label(drag.sourceIndex)} moved to position ${next2 + 1} of ${itemCount}.`
          );
        }
        return;
      }
      if ((key === " " || key === "Enter") && !disabled) {
        event.preventDefault();
        setDrag({ mode: "keyboard", sourceIndex: index, targetIndex: index });
        setAnnouncement(
          `Picked up ${label(index)}. Current position ${index + 1} of ${itemCount}. ${SORTABLE_INSTRUCTIONS}`
        );
        return;
      }
      let next = null;
      if (offset !== null) next = clamp(index + offset, lastIndex);
      else if (key === "Home") next = 0;
      else if (key === "End") next = lastIndex;
      if (next === null) return;
      event.preventDefault();
      setActiveIndex(next);
      itemRefs.current[next]?.focus();
    };
    return {
      ref: (el) => {
        itemRefs.current[index] = el;
      },
      role: "button",
      tabIndex: index === activeIndex ? 0 : -1,
      draggable: !disabled,
      "aria-roledescription": "sortable item",
      "aria-grabbed": isGrabbed,
      "aria-describedby": instructionsId,
      "aria-disabled": disabled || void 0,
      "data-grabbed": isGrabbed,
      "data-dragging": isGrabbed && drag?.mode === "pointer",
      style: { order: displayPosition(index, drag) },
      onFocus: () => setActiveIndex(index),
      onKeyDown,
      onDragStart: (event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(index));
        }
        setDrag({ mode: "pointer", sourceIndex: index, targetIndex: index });
        setAnnouncement(`Picked up ${label(index)}.`);
      },
      onDragOver: (event) => {
        if (drag?.mode !== "pointer") return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        const next = displayPosition(index, drag);
        if (next !== drag.targetIndex) setDrag({ ...drag, targetIndex: next });
      },
      onDrop: (event) => {
        if (drag?.mode !== "pointer") return;
        event.preventDefault();
        commit(drag);
      },
      onDragEnd: () => {
        const current = dragRef.current;
        if (current?.mode === "pointer") cancel(current);
      }
    };
  };
  return {
    grabbedIndex: drag?.sourceIndex ?? null,
    targetIndex: drag?.targetIndex ?? null,
    announcement,
    instructionsId,
    getDisplayPosition: (index) => displayPosition(index, drag),
    getItemProps
  };
}
const SortableGridContext = createContext(null);
function SortableGrid({
  itemCount,
  onReorder,
  columns = 1,
  getItemLabel,
  disabled,
  className,
  style,
  children,
  ...rest
}) {
  const sortable = useSortableGrid({ itemCount, onReorder, columns, getItemLabel, disabled });
  return /* @__PURE__ */ jsxs(SortableGridContext.Provider, { value: sortable, children: [
    /* @__PURE__ */ jsx(
      "div",
      {
        role: "group",
        className: cn("grid gap-2", className),
        style: { gridTemplateColumns: `repeat(${Math.max(1, Math.floor(columns))}, minmax(0, 1fr))`, ...style },
        ...rest,
        children
      }
    ),
    /* @__PURE__ */ jsx("div", { id: sortable.instructionsId, className: "sr-only", children: SORTABLE_INSTRUCTIONS }),
    /* @__PURE__ */ jsx("div", { role: "status", "aria-live": "assertive", "aria-atomic": "true", className: "sr-only", children: sortable.announcement })
  ] });
}
function SortableItem({ index, className, children, ...rest }) {
  const sortable = useContext(SortableGridContext);
  if (!sortable) throw new Error("<SortableItem> must be rendered inside <SortableGrid>.");
  const { ref, ...itemProps } = sortable.getItemProps(index);
  const grabbed = itemProps["data-grabbed"];
  return /* @__PURE__ */ jsx(
    "div",
    {
      ...rest,
      ...itemProps,
      ref,
      className: cn(
        "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        itemProps.draggable && "cursor-grab",
        grabbed && "ring-2 ring-primary",
        itemProps["data-dragging"] && "opacity-50",
        className
      ),
      children
    }
  );
}
export {
  SORTABLE_INSTRUCTIONS,
  SortableGrid,
  SortableItem,
  useSortableGrid
};
//# sourceMappingURL=SortableGrid.js.map
