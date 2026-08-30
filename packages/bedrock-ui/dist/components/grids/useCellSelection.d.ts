/** One cell, identified the way the DOM is: by row key and column id. */
export interface CellRef {
    rowKey: string;
    columnId: string;
}
/** A rectangle of cells, in the grid's own visible order. */
export interface CellRange {
    /** Row keys top-to-bottom, contiguous in the current sort order. */
    rowKeys: string[];
    /** Column ids left-to-right, contiguous in the current column order. */
    columnIds: string[];
    /** Where the selection started. */
    anchor: CellRef;
    /** Where it currently ends — the cell the keyboard moves. */
    focus: CellRef;
}
/** A paste, reported to the consumer for it to apply. */
export interface CellRangePaste {
    /** Top-left of the target: the rectangle fills right and down from here. */
    anchor: CellRef;
    /** Rows of columns, as parsed from the clipboard. */
    matrix: string[][];
    /**
     * The rows the matrix lands on, top-to-bottom **in the grid's visible order**,
     * starting at `anchor`.
     *
     * Reporting only the anchor made the consumer answer "and which row is next?"
     * on its own, and the only order visible from out there is the DOM's — so
     * consumers walked `[data-row-key]` attributes to rebuild what this hook
     * already knew. That reads the rendered rows, not the model's, so it silently
     * pastes into the wrong records the moment rows virtualise, and it costs a
     * layout read on every paste. The order is authoritative here; it ships on the
     * payload.
     *
     * Clamped to the rows that exist: a matrix taller than the remaining rows
     * yields fewer keys than `matrix.length`, and pasting past the last row drops
     * the overflow rather than inventing rows.
     */
    rowKeys: string[];
    /**
     * The columns the matrix lands on, left-to-right in the current column order,
     * starting at `anchor`. Clamped to the columns that exist, and sized to the
     * widest row of a ragged matrix.
     */
    columnIds: string[];
}
/** A fill-handle drag, reported to the consumer for it to apply. */
export interface CellRangeFill {
    /** The rectangle dragged *from* — the values to repeat. */
    source: CellRange;
    /** The rectangle dragged *over* — the cells to write. Excludes `source`. */
    target: CellRange;
}
export interface UseCellSelectionOptions {
    /** False turns the whole hook into a no-op with no listeners bound. */
    enabled: boolean;
    /** Row keys in visible order. */
    rowKeys: string[];
    /** Selectable column ids in visible order — checkboxes and the like excluded. */
    columnIds: string[];
    /** The text a cell would copy as. */
    getCellText: (rowKey: string, columnId: string) => string;
    onCopy?: (tsv: string, range: CellRange) => void;
    onPaste?: (paste: CellRangePaste) => void;
    onFill?: (fill: CellRangeFill) => void;
    /**
     * Typing on the focus cell, when the consumer can turn that into an edit.
     *
     * The cursor is not DOM focus, so `isEditingActiveElement()` cannot tell an
     * idle editable cell from a read-only one — every keystroke aimed at a cell
     * arrives here first. Without this hook the window listener eats them:
     * `Enter` moves down, and a printable character does nothing at all.
     *
     * @param cell - The focus cell.
     * @param seed - The text to open with: a printable character, `""` for
     *   Backspace/Delete, or `null` to open preserving the current value
     *   (Enter, Space, F2).
     * @returns True when an edit actually began. False (or nothing) declines,
     *   and the keystroke falls through to navigation — so `Enter` on a cell
     *   that cannot be edited still moves down, exactly as before.
     */
    onBeginEdit?: (cell: CellRef, seed: string | null) => boolean | void;
}
/** What `useCellSelection` hands back for the cell renderer to consume. */
export interface CellSelection {
    enabled: boolean;
    anchor: CellRef | null;
    focus: CellRef | null;
    range: CellRange | null;
    /** True for the one cell the keyboard moves — draw the cursor ring. */
    isFocused: (rowKey: string, columnId: string) => boolean;
    /** True for every cell in the rectangle — draw the wash. */
    isSelected: (rowKey: string, columnId: string) => boolean;
    /** True for cells a fill drag is currently over but has not written. */
    isFillPreview: (rowKey: string, columnId: string) => boolean;
    /** True for the range's bottom-right cell — where the fill handle lives. */
    isFillOrigin: (rowKey: string, columnId: string) => boolean;
    /** Mouse down on a cell: sets the cursor, or extends it when shift is held. */
    onCellMouseDown: (rowKey: string, columnId: string, event: {
        shiftKey: boolean;
        button: number;
    }) => void;
    /** Mouse over a cell: extends the range or the fill preview mid-drag. */
    onCellMouseEnter: (rowKey: string, columnId: string) => void;
    /**
     * Double-click on a cell: sets the cursor and asks the consumer to open an
     * editor, preserving the current value.
     *
     * `onBeginEdit` was previously reachable only by typing, so a grid whose
     * editable columns render through custom cells had no double-click path at
     * all — the gesture every operator tries first did nothing. `<EditableCell>`
     * binds its own `onDoubleClick`, which is why the gap was invisible on the
     * default render path and showed up only in bulk edit.
     */
    onCellDoubleClick: (rowKey: string, columnId: string) => void;
    /** Mouse down on the fill handle. */
    onFillHandleMouseDown: (event: {
        stopPropagation: () => void;
        preventDefault: () => void;
    }) => void;
    clear: () => void;
}
/**
 * @param matrix - Rows of column values.
 * @returns One clipboard payload: tabs between columns, `\n` between rows.
 */
export declare function toTsv(matrix: string[][]): string;
/**
 * Parse a clipboard payload into a rectangle.
 *
 * @param text - Whatever was on the clipboard.
 * @returns Rows of column values. Ragged input stays ragged — the consumer
 *   decides whether a short row clears the remaining cells or leaves them, and
 *   padding here would take that decision away.
 *
 * Handles the quoting Excel emits for a cell containing a tab or a newline, so
 * a multi-line description survives the round trip. A trailing newline is
 * dropped (every spreadsheet adds one); interior blank lines are kept, because
 * a blank row in the middle of a paste is a value someone meant to clear.
 */
export declare function parseTsv(text: string): string[][];
/**
 * The one keyboard table for "does this key open an editor, and with what?".
 *
 * Lives here rather than in `EditableCell` because both ends need it and this
 * module has no component dependencies: the cell answers the question for a
 * span that holds DOM focus, the hook answers it for the grid cursor, and a
 * single table is what stops the two from disagreeing about which keystrokes
 * are typing and which are navigation.
 *
 * @param key - `KeyboardEvent.key`.
 * @param modified - True when Ctrl/Meta/Alt is held; those are shortcuts,
 *   never text.
 * @returns The seed text to open with, `null` to open preserving the current
 *   value, or `undefined` when the key is not an open gesture at all.
 */
export declare function seedForKey(key: string, modified: boolean): string | null | undefined;
/**
 * @param options - See {@link UseCellSelectionOptions}.
 * @returns See {@link CellSelection}.
 */
export declare function useCellSelection({ enabled, rowKeys, columnIds, getCellText, onCopy, onPaste, onFill, onBeginEdit, }: UseCellSelectionOptions): CellSelection;
export default useCellSelection;
