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
import { type CSSProperties, type DragEvent, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
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
export declare const SORTABLE_INSTRUCTIONS = "Press Space or Enter to pick up. While holding, use the arrow keys to move, Space or Enter to drop, or Escape to cancel.";
/**
 * Reorder engine behind `<SortableGrid>`. Use directly to build a custom
 * container; otherwise prefer `<SortableGrid>` + `<SortableItem>`.
 */
export declare function useSortableGrid({ itemCount, onReorder, columns, getItemLabel, disabled, }: UseSortableGridOptions): UseSortableGridResult;
export interface SortableGridProps extends UseSortableGridOptions, Omit<HTMLAttributes<HTMLDivElement>, "role" | "children"> {
    children: ReactNode;
}
/**
 * Container for `<SortableItem>`s. Lays items out in `columns` equal tracks and
 * owns the live region and keyboard instructions.
 */
export declare function SortableGrid({ itemCount, onReorder, columns, getItemLabel, disabled, className, style, children, ...rest }: SortableGridProps): import("react").JSX.Element;
/** Props `SortableItem` owns and therefore does not accept from the caller. */
type OwnedItemProp = keyof SortableItemDomProps;
export interface SortableItemProps extends Omit<HTMLAttributes<HTMLDivElement>, OwnedItemProp> {
    /** The item's current index in the caller's array. */
    index: number;
    children: ReactNode;
}
/** One reorderable cell. Must render inside `<SortableGrid>`. */
export declare function SortableItem({ index, className, children, ...rest }: SortableItemProps): import("react").JSX.Element;
export {};
