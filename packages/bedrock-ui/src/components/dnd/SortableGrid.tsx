/**
 * @file SortableGrid.tsx
 * @module frontend/src/components/dnd
 * @description Accessible drag-and-drop reorder primitive for lists and grids.
 *
 * Pointer reordering uses native HTML5 drag and drop; keyboard reordering
 * follows the WAI-ARIA reorder pattern:
 *
 * - Arrow keys move focus between items (roving tabindex).
 * - Space / Enter picks up the focused item.
 * - Arrow keys then move the picked-up item through the grid.
 * - Space / Enter drops it and fires `onReorder(sourceIndex, targetIndex)`.
 * - Escape cancels and restores the original position.
 *
 * While an item is in flight the preview is drawn with the CSS `order`
 * property rather than by reordering the DOM, so the focused element never
 * unmounts and a cancel is a pure state reset. The caller owns the data:
 * `onReorder` reports the move, and the caller applies it (e.g. with
 * `arrayMove` from `@dnd-kit/sortable`). `targetIndex` is the item's final
 * index after the move.
 *
 * Every step is announced through an assertive live region.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cn } from "../../lib/utils";

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface UseSortableGridOptions {
  /** Number of items being sorted. */
  itemCount: number;
  /** Fired once per committed move; never fired for a cancel or a no-op drop. */
  onReorder: (sourceIndex: number, targetIndex: number) => void;
  /** Items per row. `1` (the default) is a vertical list. */
  columns?: number;
  /** Accessible name for the item at `index`, used in announcements. */
  getItemLabel?: (index: number) => string;
  /** Disables pointer and keyboard reordering; focus navigation still works. */
  disabled?: boolean;
}

type DragMode = "keyboard" | "pointer";

interface DragState {
  mode: DragMode;
  sourceIndex: number;
  targetIndex: number;
}

/** DOM props `getItemProps` spreads onto each sortable item. */
export interface SortableItemDomProps {
  ref: (el: HTMLElement | null) => void;
  role: "button";
  tabIndex: 0 | -1;
  draggable: boolean;
  "aria-roledescription": "sortable item";
  "aria-grabbed": boolean;
  "aria-describedby": string;
  "aria-disabled": boolean | undefined;
  "data-grabbed": boolean;
  "data-dragging": boolean;
  style: CSSProperties;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}

export interface UseSortableGridResult {
  /** Index of the item currently picked up, or `null`. */
  grabbedIndex: number | null;
  /** Position the picked-up item would land on if dropped now, or `null`. */
  targetIndex: number | null;
  /** Latest live-region message. */
  announcement: string;
  /** Id of the element holding the keyboard instructions. */
  instructionsId: string;
  /** Where item `index` is currently drawn (differs from `index` mid-drag). */
  getDisplayPosition: (index: number) => number;
  getItemProps: (index: number) => SortableItemDomProps;
}

/** Keyboard instructions referenced by every item's `aria-describedby`. */
export const SORTABLE_INSTRUCTIONS =
  "Press Space or Enter to pick up. While holding, use the arrow keys to move, Space or Enter to drop, or Escape to cancel.";

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}

/**
 * Position item `index` is drawn at when `drag` moves `sourceIndex` to
 * `targetIndex` — the same shift `arrayMove` applies.
 */
function displayPosition(index: number, drag: DragState | null): number {
  if (!drag) return index;
  const { sourceIndex: from, targetIndex: to } = drag;
  if (index === from) return to;
  if (from < to && index > from && index <= to) return index - 1;
  if (from > to && index >= to && index < from) return index + 1;
  return index;
}

/**
 * Reorder engine behind `<SortableGrid>`. Use directly to build a custom
 * container; otherwise prefer `<SortableGrid>` + `<SortableItem>`.
 */
export function useSortableGrid({
  itemCount,
  onReorder,
  columns = 1,
  getItemLabel,
  disabled = false,
}: UseSortableGridOptions): UseSortableGridResult {
  const [drag, setDragState] = useState<DragState | null>(null);
  // Mirrors `drag` for handlers that can fire before a re-render lands
  // (`dragend` straight after `drop`).
  const dragRef = useRef<DragState | null>(null);
  const setDrag = useCallback((next: DragState | null) => {
    dragRef.current = next;
    setDragState(next);
  }, []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const instructionsId = useId();

  const lastIndex = Math.max(itemCount - 1, 0);
  const cols = Math.max(1, Math.floor(columns));
  const label = useCallback(
    (index: number) => getItemLabel?.(index) ?? `Item ${index + 1}`,
    [getItemLabel],
  );

  // Items removed out from under the roving tab stop, or a disabled toggle
  // mid-drag, must not leave the grid unreachable or stuck in a grab.
  useEffect(() => {
    setActiveIndex((i) => clamp(i, lastIndex));
  }, [lastIndex]);
  useEffect(() => {
    if (disabled) setDrag(null);
  }, [disabled, setDrag]);

  const commit = useCallback(
    (state: DragState) => {
      const { sourceIndex, targetIndex } = state;
      setDrag(null);
      setActiveIndex(targetIndex);
      if (sourceIndex === targetIndex) {
        setAnnouncement(`${label(sourceIndex)} dropped. Position unchanged.`);
        return;
      }
      setAnnouncement(
        `${label(sourceIndex)} dropped at position ${targetIndex + 1} of ${itemCount}.`,
      );
      onReorder(sourceIndex, targetIndex);
    },
    [itemCount, label, onReorder, setDrag],
  );

  const cancel = useCallback(
    (state: DragState) => {
      setDrag(null);
      setActiveIndex(state.sourceIndex);
      setAnnouncement(
        `Reorder cancelled. ${label(state.sourceIndex)} returned to position ${state.sourceIndex + 1} of ${itemCount}.`,
      );
    },
    [itemCount, label, setDrag],
  );

  /** Offset an arrow key applies, in index space. */
  const arrowOffset = (key: string): number | null => {
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

  const getItemProps = (index: number): SortableItemDomProps => {
    const isGrabbed = drag?.sourceIndex === index;

    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      // Keys typed into an interactive child (a button, an input) are its own.
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
          const next = clamp(drag.targetIndex + offset, lastIndex);
          if (next === drag.targetIndex) return;
          setDrag({ ...drag, targetIndex: next });
          setAnnouncement(
            `${label(drag.sourceIndex)} moved to position ${next + 1} of ${itemCount}.`,
          );
        }
        return;
      }

      if ((key === " " || key === "Enter") && !disabled) {
        event.preventDefault();
        setDrag({ mode: "keyboard", sourceIndex: index, targetIndex: index });
        setAnnouncement(
          `Picked up ${label(index)}. Current position ${index + 1} of ${itemCount}. ${SORTABLE_INSTRUCTIONS}`,
        );
        return;
      }

      let next: number | null = null;
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
      "aria-disabled": disabled || undefined,
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
          // Firefox will not start a drag without a payload.
          event.dataTransfer.setData("text/plain", String(index));
        }
        setDrag({ mode: "pointer", sourceIndex: index, targetIndex: index });
        setAnnouncement(`Picked up ${label(index)}.`);
      },
      onDragOver: (event) => {
        if (drag?.mode !== "pointer") return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        // Hovering an item claims the slot it is *drawn* in, so the preview
        // stays stable when the dragged item slides under the cursor.
        const next = displayPosition(index, drag);
        if (next !== drag.targetIndex) setDrag({ ...drag, targetIndex: next });
      },
      onDrop: (event) => {
        if (drag?.mode !== "pointer") return;
        event.preventDefault();
        commit(drag);
      },
      onDragEnd: () => {
        // Fires after `drop` on success; if the drag is still live here it
        // ended outside any item, which is a cancel.
        const current = dragRef.current;
        if (current?.mode === "pointer") cancel(current);
      },
    };
  };

  return {
    grabbedIndex: drag?.sourceIndex ?? null,
    targetIndex: drag?.targetIndex ?? null,
    announcement,
    instructionsId,
    getDisplayPosition: (index) => displayPosition(index, drag),
    getItemProps,
  };
}

// ── Components ───────────────────────────────────────────────────────────────

const SortableGridContext = createContext<UseSortableGridResult | null>(null);

export interface SortableGridProps
  extends UseSortableGridOptions,
    Omit<HTMLAttributes<HTMLDivElement>, "role" | "children"> {
  children: ReactNode;
}

/**
 * Container for `<SortableItem>`s. Lays items out in `columns` equal tracks and
 * owns the live region and keyboard instructions.
 */
export function SortableGrid({
  itemCount,
  onReorder,
  columns = 1,
  getItemLabel,
  disabled,
  className,
  style,
  children,
  ...rest
}: SortableGridProps) {
  const sortable = useSortableGrid({ itemCount, onReorder, columns, getItemLabel, disabled });
  return (
    <SortableGridContext.Provider value={sortable}>
      <div
        role="group"
        className={cn("grid gap-2", className)}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.floor(columns))}, minmax(0, 1fr))`, ...style }}
        {...rest}
      >
        {children}
      </div>
      <div id={sortable.instructionsId} className="sr-only">
        {SORTABLE_INSTRUCTIONS}
      </div>
      <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
        {sortable.announcement}
      </div>
    </SortableGridContext.Provider>
  );
}

/** Props `SortableItem` owns and therefore does not accept from the caller. */
type OwnedItemProp = keyof SortableItemDomProps;

export interface SortableItemProps
  extends Omit<HTMLAttributes<HTMLDivElement>, OwnedItemProp> {
  /** The item's current index in the caller's array. */
  index: number;
  children: ReactNode;
}

/** One reorderable cell. Must render inside `<SortableGrid>`. */
export function SortableItem({ index, className, children, ...rest }: SortableItemProps) {
  const sortable = useContext(SortableGridContext);
  if (!sortable) throw new Error("<SortableItem> must be rendered inside <SortableGrid>.");
  const { ref, ...itemProps } = sortable.getItemProps(index);
  const grabbed = itemProps["data-grabbed"];
  return (
    <div
      {...rest}
      {...itemProps}
      ref={ref}
      className={cn(
        "rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        itemProps.draggable && "cursor-grab",
        grabbed && "ring-2 ring-primary",
        itemProps["data-dragging"] && "opacity-50",
        className,
      )}
    >
      {children}
    </div>
  );
}
