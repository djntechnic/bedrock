/**
 * @file cellPosition.ts
 * @module frontend/src/components/grids
 * @description The one place that decides a data cell's CSS `position`.
 *
 * Its own module because `cn()` is tailwind-merge, and tailwind-merge treats
 * `sticky` and `relative` as a single `position` group: passing both keeps the
 * last and silently discards the first. `<DataGrid>` wants `sticky` for a
 * pinned column and `relative` to anchor the fill handle of a selectable cell,
 * and a bulk-edit grid is the one place both apply to the same cell — which is
 * exactly where the pin was being dropped. Deciding once, here, makes that
 * conflict impossible to reintroduce by adding a class in the list.
 */
/** What TanStack's `column.getIsPinned()` returns. */
export type PinnedSide = false | "left" | "right";
/**
 * Resolve the position-related classes for one body cell.
 *
 * @param pinnedSide - The column's pin, from `column.getIsPinned()`.
 * @param isNameCol - Whether this is the implicit sticky "name" column (a
 *   column whose `link_target` marks it as the row's identity). It sticks to
 *   the left edge unless an explicit left pin already puts it there.
 * @param isCellSelectable - Whether cell selection is live for this cell, which
 *   is what makes it want `relative` — the fill handle is absolutely
 *   positioned inside it.
 * @returns A single class string; never more than one `position` utility.
 */
export declare function cellPositionClasses(pinnedSide: PinnedSide, isNameCol: boolean, isCellSelectable: boolean): string;
