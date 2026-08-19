/**
 * @file useCellSelection.ts
 * @module @djntechnic/bedrock-ui/components/grids
 * @description The spreadsheet cursor for `<DataGrid>`: a focused cell, a
 *              rectangular range, keyboard navigation, TSV copy/paste and a
 *              fill handle.
 *
 * Opt-in and additive. A grid that does not pass `cellSelection` calls this
 * hook with `enabled: false` and nothing here binds a listener, so every grid
 * already shipped behaves exactly as before.
 *
 * **The engine never writes.** Copy serialises what the grid already renders,
 * but paste and fill only *report* — `onPaste` and `onFill` hand the consumer a
 * rectangle and it decides what that means for its own buffer. Consumers own
 * their drafts (validation, locked rows, staged rows, undo), and none of that is
 * knowable from in here.
 *
 * **Clipboard access goes through the native `copy`/`paste` events**, not
 * `navigator.clipboard`. The async API needs a permission for reads that
 * Firefox does not grant at all, while the event's `clipboardData` is available
 * in every browser during a genuine Ctrl+C/Ctrl+V gesture — which is the only
 * time this feature is wanted. `navigator.clipboard.writeText` is used solely as
 * a fallback when a `copy` event arrives with no `clipboardData` (jsdom, and
 * some embedded webviews).
 *
 * **Row order is the row order handed in**, which `DataGrid` takes from the
 * current sorted and filtered model — so the rectangle always matches what the
 * operator sees, and a re-sort mid-edit moves the selection with the rows rather
 * than to different data.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  onCellMouseDown: (
    rowKey: string,
    columnId: string,
    event: { shiftKey: boolean; button: number },
  ) => void;
  /** Mouse over a cell: extends the range or the fill preview mid-drag. */
  onCellMouseEnter: (rowKey: string, columnId: string) => void;
  /** Mouse down on the fill handle. */
  onFillHandleMouseDown: (event: {
    stopPropagation: () => void;
    preventDefault: () => void;
  }) => void;
  clear: () => void;
}

/** Values needing quotes to survive a round trip through a spreadsheet. */
function escapeTsvValue(value: string): string {
  if (!/[\t\n\r"]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * @param matrix - Rows of column values.
 * @returns One clipboard payload: tabs between columns, `\n` between rows.
 */
export function toTsv(matrix: string[][]): string {
  return matrix.map((row) => row.map(escapeTsvValue).join("\t")).join("\n");
}

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
export function parseTsv(text: string): string[][] {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\n$/, "");
  if (normalized === "") return [[""]];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (quoted) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field === "") {
      quoted = true;
    } else if (char === "\t") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

/**
 * @returns True when the keystroke belongs to something the operator is typing
 *   into, so grid navigation must keep its hands off. An open `<EditableCell>`
 *   is exactly this case: its input is focused, and Ctrl+C there means "copy the
 *   text I selected", not "copy the range".
 */
function isEditingActiveElement(): boolean {
  const el = typeof document === "undefined" ? null : document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (el as HTMLElement).isContentEditable === true;
}

function rectangle(
  rowKeys: string[],
  columnIds: string[],
  anchor: CellRef,
  focus: CellRef,
): CellRange | null {
  const r1 = rowKeys.indexOf(anchor.rowKey);
  const r2 = rowKeys.indexOf(focus.rowKey);
  const c1 = columnIds.indexOf(anchor.columnId);
  const c2 = columnIds.indexOf(focus.columnId);
  // A row filtered away or a column hidden mid-selection takes the rectangle
  // with it. Silently clamping would highlight cells nobody chose.
  if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return null;
  return {
    rowKeys: rowKeys.slice(Math.min(r1, r2), Math.max(r1, r2) + 1),
    columnIds: columnIds.slice(Math.min(c1, c2), Math.max(c1, c2) + 1),
    anchor,
    focus,
  };
}

/**
 * @param options - See {@link UseCellSelectionOptions}.
 * @returns See {@link CellSelection}.
 */
export function useCellSelection({
  enabled,
  rowKeys,
  columnIds,
  getCellText,
  onCopy,
  onPaste,
  onFill,
}: UseCellSelectionOptions): CellSelection {
  const [anchor, setAnchor] = useState<CellRef | null>(null);
  const [focus, setFocus] = useState<CellRef | null>(null);
  const [fillTo, setFillTo] = useState<string | null>(null);

  /** "range" while dragging a selection, "fill" while dragging the handle. */
  const dragRef = useRef<null | "range" | "fill">(null);

  // Listeners are bound once and read through refs, because rebinding a window
  // listener on every cursor move is how a drag ends up dropping a mouseup.
  const stateRef = useRef({ anchor, focus, rowKeys, columnIds, getCellText });
  stateRef.current = { anchor, focus, rowKeys, columnIds, getCellText };
  const handlersRef = useRef({ onCopy, onPaste, onFill });
  handlersRef.current = { onCopy, onPaste, onFill };

  const range = useMemo(
    () => (anchor && focus ? rectangle(rowKeys, columnIds, anchor, focus) : null),
    [anchor, focus, rowKeys, columnIds],
  );
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const clear = useCallback(() => {
    setAnchor(null);
    setFocus(null);
    setFillTo(null);
  }, []);

  // A selection that no longer exists — its row filtered out, its column
  // hidden — is dropped rather than left pointing at nothing.
  useEffect(() => {
    if (!enabled) {
      if (anchor || focus) clear();
      return;
    }
    if (!focus) return;
    if (!rowKeys.includes(focus.rowKey) || !columnIds.includes(focus.columnId)) {
      clear();
    }
  }, [enabled, focus, anchor, rowKeys, columnIds, clear]);

  const onCellMouseDown = useCallback<CellSelection["onCellMouseDown"]>(
    (rowKey, columnId, event) => {
      if (!enabled || event.button !== 0) return;
      setFillTo(null);
      if (event.shiftKey && stateRef.current.anchor) {
        // Shift keeps the anchor and moves the far corner, same as a
        // spreadsheet — which is why anchor and focus are separate state.
        setFocus({ rowKey, columnId });
      } else {
        setAnchor({ rowKey, columnId });
        setFocus({ rowKey, columnId });
      }
      dragRef.current = "range";
    },
    [enabled],
  );

  const onCellMouseEnter = useCallback<CellSelection["onCellMouseEnter"]>(
    (rowKey, columnId) => {
      if (!enabled) return;
      if (dragRef.current === "range") setFocus({ rowKey, columnId });
      else if (dragRef.current === "fill") setFillTo(rowKey);
    },
    [enabled],
  );

  const onFillHandleMouseDown = useCallback<
    CellSelection["onFillHandleMouseDown"]
  >(
    (event) => {
      if (!enabled) return;
      // Without this the mousedown lands on the cell underneath and collapses
      // the very range being dragged from.
      event.stopPropagation();
      event.preventDefault();
      dragRef.current = "fill";
    },
    [enabled],
  );

  // One window-level mouseup ends either drag. Bound on the window rather than
  // the grid because a drag that leaves the table still has to finish.
  useEffect(() => {
    if (!enabled) return;
    const onMouseUp = () => {
      const mode = dragRef.current;
      dragRef.current = null;
      if (mode !== "fill") return;

      const source = rangeRef.current;
      const to = fillTo;
      setFillTo(null);
      if (!source || !to) return;

      const { rowKeys: keys } = stateRef.current;
      const last = source.rowKeys[source.rowKeys.length - 1];
      const from = keys.indexOf(last);
      const target = keys.indexOf(to);
      // Upward fills are not offered: the handle sits on the bottom-right
      // corner, so dragging up means the operator has changed their mind.
      if (from < 0 || target <= from) return;

      handlersRef.current.onFill?.({
        source,
        target: {
          rowKeys: keys.slice(from + 1, target + 1),
          columnIds: source.columnIds,
          anchor: { rowKey: keys[from + 1], columnId: source.columnIds[0] },
          focus: {
            rowKey: keys[target],
            columnId: source.columnIds[source.columnIds.length - 1],
          },
        },
      });
    };
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, [enabled, fillTo]);

  /** The range as a matrix of text, in visible order. */
  const rangeTsv = useCallback((current: CellRange): string => {
    const { getCellText: read } = stateRef.current;
    return toTsv(
      current.rowKeys.map((rowKey) =>
        current.columnIds.map((columnId) => read(rowKey, columnId)),
      ),
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const move = (rowStep: number, colStep: number, extend: boolean, toEdge: boolean) => {
      const { focus: currentFocus, rowKeys: keys, columnIds: cols } = stateRef.current;
      if (!currentFocus) return;
      const r = keys.indexOf(currentFocus.rowKey);
      const c = cols.indexOf(currentFocus.columnId);
      if (r < 0 || c < 0) return;

      const nextRow = toEdge && rowStep !== 0
        ? rowStep < 0 ? 0 : keys.length - 1
        : Math.min(Math.max(r + rowStep, 0), keys.length - 1);
      const nextCol = toEdge && colStep !== 0
        ? colStep < 0 ? 0 : cols.length - 1
        : Math.min(Math.max(c + colStep, 0), cols.length - 1);

      const next = { rowKey: keys[nextRow], columnId: cols[nextCol] };
      setFocus(next);
      if (!extend) setAnchor(next);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditingActiveElement()) return;
      const mod = event.ctrlKey || event.metaKey;

      if (event.key === "Escape") {
        if (stateRef.current.focus) clear();
        return;
      }

      if (mod && (event.key === "a" || event.key === "A")) {
        const { rowKeys: keys, columnIds: cols } = stateRef.current;
        // Only when the grid already has a cursor. Otherwise Ctrl+A still means
        // "select the page", which is what someone reading it expects.
        if (!stateRef.current.focus || keys.length === 0 || cols.length === 0) return;
        event.preventDefault();
        setAnchor({ rowKey: keys[0], columnId: cols[0] });
        setFocus({
          rowKey: keys[keys.length - 1],
          columnId: cols[cols.length - 1],
        });
        return;
      }

      const steps: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const step = steps[event.key];
      if (step && stateRef.current.focus) {
        event.preventDefault();
        move(step[0], step[1], event.shiftKey, mod);
        return;
      }

      if ((event.key === "Tab" || event.key === "Enter") && stateRef.current.focus) {
        event.preventDefault();
        if (event.key === "Tab") move(0, event.shiftKey ? -1 : 1, false, false);
        else move(event.shiftKey ? -1 : 1, 0, false, false);
      }
    };

    const onCopyEvent = (event: ClipboardEvent) => {
      if (isEditingActiveElement()) return;
      const current = rangeRef.current;
      if (!current) return;
      const tsv = rangeTsv(current);
      if (event.clipboardData) {
        event.preventDefault();
        event.clipboardData.setData("text/plain", tsv);
      } else {
        // No clipboardData on the event: the async API is the only route left,
        // and if it is denied too the range simply does not copy.
        void navigator.clipboard?.writeText?.(tsv)?.catch?.(() => {});
      }
      handlersRef.current.onCopy?.(tsv, current);
    };

    const onPasteEvent = (event: ClipboardEvent) => {
      if (isEditingActiveElement()) return;
      const current = rangeRef.current;
      const handler = handlersRef.current.onPaste;
      if (!current || !handler) return;
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (text === "") return;
      event.preventDefault();
      // Top-left of the selection, not the focus cell: dragging a range
      // bottom-up and pasting fills downwards from the top, as it does in a
      // spreadsheet.
      handler({
        anchor: { rowKey: current.rowKeys[0], columnId: current.columnIds[0] },
        matrix: parseTsv(text),
      });
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("copy", onCopyEvent);
    document.addEventListener("paste", onPasteEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("copy", onCopyEvent);
      document.removeEventListener("paste", onPasteEvent);
    };
  }, [enabled, clear, rangeTsv]);

  const selectedRows = useMemo(
    () => new Set(range?.rowKeys ?? []),
    [range],
  );
  const selectedCols = useMemo(
    () => new Set(range?.columnIds ?? []),
    [range],
  );

  const fillRows = useMemo(() => {
    if (!range || !fillTo) return new Set<string>();
    const last = range.rowKeys[range.rowKeys.length - 1];
    const from = rowKeys.indexOf(last);
    const to = rowKeys.indexOf(fillTo);
    if (from < 0 || to <= from) return new Set<string>();
    return new Set(rowKeys.slice(from + 1, to + 1));
  }, [range, fillTo, rowKeys]);

  return {
    enabled,
    anchor,
    focus,
    range,
    isFocused: useCallback(
      (rowKey, columnId) =>
        focus?.rowKey === rowKey && focus?.columnId === columnId,
      [focus],
    ),
    isSelected: useCallback(
      (rowKey, columnId) =>
        selectedRows.has(rowKey) && selectedCols.has(columnId),
      [selectedRows, selectedCols],
    ),
    isFillPreview: useCallback(
      (rowKey, columnId) => fillRows.has(rowKey) && selectedCols.has(columnId),
      [fillRows, selectedCols],
    ),
    isFillOrigin: useCallback(
      (rowKey, columnId) =>
        !!range &&
        range.rowKeys[range.rowKeys.length - 1] === rowKey &&
        range.columnIds[range.columnIds.length - 1] === columnId,
      [range],
    ),
    onCellMouseDown,
    onCellMouseEnter,
    onFillHandleMouseDown,
    clear,
  };
}

export default useCellSelection;
