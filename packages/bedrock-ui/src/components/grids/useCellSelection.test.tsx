/**
 * @file useCellSelection.test.tsx
 * @description The spreadsheet cursor: rectangle maths, keyboard navigation,
 *              TSV round trip, the clipboard events and the fill handle.
 *
 * The hook is exercised through a table harness rather than in isolation,
 * because every one of its behaviours is a DOM interaction — a mousedown, a
 * window keydown, a `copy` event — and asserting on returned state alone would
 * test a different thing from the one that ships.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useCellSelection,
  parseTsv,
  seedForKey,
  toTsv,
  type CellRef,
  type CellRangeFill,
  type CellRangePaste,
} from "./useCellSelection";

const ROWS = ["r1", "r2", "r3", "r4"];
const COLS = ["a", "b", "c"];

function Harness({
  rowKeys = ROWS,
  columnIds = COLS,
  enabled = true,
  onPaste,
  onFill,
  onCopy,
  onBeginEdit,
  withInput = false,
}: {
  rowKeys?: string[];
  columnIds?: string[];
  enabled?: boolean;
  onPaste?: (paste: CellRangePaste) => void;
  onFill?: (fill: CellRangeFill) => void;
  onCopy?: (tsv: string, range: unknown) => void;
  onBeginEdit?: (cell: CellRef, seed: string | null) => boolean | void;
  withInput?: boolean;
}) {
  const sel = useCellSelection({
    enabled,
    rowKeys,
    columnIds,
    getCellText: (rowKey, columnId) => `${rowKey}${columnId}`,
    onPaste,
    onFill,
    onCopy,
    onBeginEdit,
  });
  return (
    <>
      {withInput && <input aria-label="editor" />}
      <table>
        <tbody>
          {rowKeys.map((rowKey) => (
            <tr key={rowKey}>
              {columnIds.map((columnId) => (
                <td
                  key={columnId}
                  data-testid={`${rowKey}:${columnId}`}
                  data-focused={sel.isFocused(rowKey, columnId) || undefined}
                  data-selected={sel.isSelected(rowKey, columnId) || undefined}
                  data-fill={sel.isFillPreview(rowKey, columnId) || undefined}
                  onMouseDown={(event) =>
                    sel.onCellMouseDown(rowKey, columnId, event)
                  }
                  onMouseEnter={() => sel.onCellMouseEnter(rowKey, columnId)}
                >
                  {sel.isFillOrigin(rowKey, columnId) && (
                    <span
                      data-testid="fill-handle"
                      onMouseDown={sel.onFillHandleMouseDown}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const cell = (rowKey: string, columnId: string) =>
  screen.getByTestId(`${rowKey}:${columnId}`);
const selected = () => document.querySelectorAll("[data-selected]").length;
const focused = () => document.querySelector("[data-focused]");

/** A `copy`/`paste` event with a clipboard jsdom does not otherwise provide. */
function clipboardEvent(type: "copy" | "paste", text = "") {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const setData = vi.fn();
  Object.defineProperty(event, "clipboardData", {
    value: { setData, getData: () => text },
  });
  return { event, setData };
}

// ── TSV ──────────────────────────────────────────────────────────────────────

describe("TSV", () => {
  it("round-trips a plain rectangle", () => {
    const matrix = [
      ["1989 Upper Deck", "Ken Griffey Jr."],
      ["1989 Upper Deck", "Nolan Ryan"],
    ];
    expect(parseTsv(toTsv(matrix))).toEqual(matrix);
  });

  it("round-trips values containing tabs, newlines and quotes", () => {
    const matrix = [['a\tb', 'line1\nline2', 'say "hi"']];
    const tsv = toTsv(matrix);
    expect(tsv).toContain('"a\tb"');
    expect(parseTsv(tsv)).toEqual(matrix);
  });

  it("drops the trailing newline but keeps interior blank rows", () => {
    expect(parseTsv("a\tb\n\nc\td\n")).toEqual([
      ["a", "b"],
      [""],
      ["c", "d"],
    ]);
  });

  it("leaves ragged input ragged", () => {
    // Padding here would decide, on the consumer's behalf, whether a short row
    // clears the remaining cells.
    expect(parseTsv("a\tb\tc\nd")).toEqual([["a", "b", "c"], ["d"]]);
  });
});

// ── Mouse ────────────────────────────────────────────────────────────────────

describe("mouse", () => {
  it("sets the cursor on mousedown", () => {
    render(<Harness />);
    fireEvent.mouseDown(cell("r2", "b"), { button: 0 });
    expect(focused()).toBe(cell("r2", "b"));
    expect(selected()).toBe(1);
  });

  it("extends the rectangle on shift-click, keeping the anchor", () => {
    render(<Harness />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(cell("r3", "b"), { button: 0, shiftKey: true });
    expect(selected()).toBe(6);
    expect(cell("r3", "c")).not.toHaveAttribute("data-selected");
    // Shift moved the far corner only, so extending again from the same anchor
    // shrinks rather than restarts.
    fireEvent.mouseDown(cell("r2", "a"), { button: 0, shiftKey: true });
    expect(selected()).toBe(2);
  });

  it("extends while dragging, and stops extending after mouseup", () => {
    render(<Harness />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    fireEvent.mouseEnter(cell("r2", "b"));
    expect(selected()).toBe(4);
    fireEvent.mouseUp(window);
    fireEvent.mouseEnter(cell("r4", "c"));
    expect(selected()).toBe(4);
  });

  it("ignores a right-click", () => {
    render(<Harness />);
    fireEvent.mouseDown(cell("r2", "b"), { button: 2 });
    expect(selected()).toBe(0);
  });
});

// ── Keyboard ─────────────────────────────────────────────────────────────────

describe("keyboard", () => {
  it("moves, extends, and jumps to the edge", () => {
    render(<Harness />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    fireEvent.mouseUp(window);

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(focused()).toBe(cell("r2", "a"));
    expect(selected()).toBe(1);

    fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
    expect(selected()).toBe(2);

    fireEvent.keyDown(window, { key: "ArrowDown", ctrlKey: true });
    expect(focused()).toBe(cell("r4", "b"));
    expect(selected()).toBe(1);
  });

  it("clamps at the edges rather than wrapping", () => {
    render(<Harness />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    fireEvent.keyDown(window, { key: "ArrowUp" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(focused()).toBe(cell("r1", "a"));
  });

  it("selects every cell on Ctrl+A, and only once there is a cursor", () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    expect(selected()).toBe(0);

    fireEvent.mouseDown(cell("r2", "b"), { button: 0 });
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    expect(selected()).toBe(12);
  });

  it("clears the selection on Escape", () => {
    render(<Harness />);
    fireEvent.mouseDown(cell("r2", "b"), { button: 0 });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(selected()).toBe(0);
  });

  it("keeps its hands off while a cell editor has focus", () => {
    render(<Harness withInput />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    screen.getByLabelText("editor").focus();
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(focused()).toBe(cell("r1", "a"));
  });

  it("binds nothing when disabled", () => {
    render(<Harness enabled={false} />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(selected()).toBe(0);
  });
});

// ── Type to edit ─────────────────────────────────────────────────────────────

describe("seedForKey", () => {
  it("opens preserving the value for Enter, Space and F2", () => {
    for (const key of ["Enter", " ", "F2"]) {
      expect(seedForKey(key, false)).toBeNull();
    }
  });

  it("opens empty for Backspace and Delete", () => {
    expect(seedForKey("Backspace", false)).toBe("");
    expect(seedForKey("Delete", false)).toBe("");
  });

  it("seeds a printable character with itself", () => {
    expect(seedForKey("7", false)).toBe("7");
    expect(seedForKey("é", false)).toBe("é");
  });

  it("declines a modified key or a named key it does not own", () => {
    expect(seedForKey("a", true)).toBeUndefined();
    expect(seedForKey("Enter", true)).toBeUndefined();
    expect(seedForKey("ArrowDown", false)).toBeUndefined();
    expect(seedForKey("Tab", false)).toBeUndefined();
  });
});

describe("onBeginEdit", () => {
  it("begins an edit instead of navigating, seeded with the character typed", () => {
    const onBeginEdit = vi.fn(() => true);
    render(<Harness onBeginEdit={onBeginEdit} />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });

    fireEvent.keyDown(window, { key: "9" });
    expect(onBeginEdit).toHaveBeenCalledWith({ rowKey: "r1", columnId: "a" }, "9");

    fireEvent.keyDown(window, { key: "Enter" });
    expect(onBeginEdit).toHaveBeenLastCalledWith(
      { rowKey: "r1", columnId: "a" },
      null,
    );
    // Enter was claimed, so the cursor stayed put rather than moving down.
    expect(focused()).toBe(cell("r1", "a"));
  });

  it("falls through when the consumer declines, so Enter still moves down", () => {
    const onBeginEdit = vi.fn(() => false);
    render(<Harness onBeginEdit={onBeginEdit} />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onBeginEdit).toHaveBeenCalled();
    expect(focused()).toBe(cell("r2", "a"));
  });

  it("leaves navigation, Ctrl+A, Escape and Tab alone", () => {
    const onBeginEdit = vi.fn(() => true);
    render(<Harness onBeginEdit={onBeginEdit} />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(focused()).toBe(cell("r2", "a"));
    fireEvent.keyDown(window, { key: "Tab" });
    expect(focused()).toBe(cell("r2", "b"));
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });
    expect(selected()).toBe(12);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(selected()).toBe(0);
    expect(onBeginEdit).not.toHaveBeenCalled();
  });

  it("changes nothing when the consumer supplies no handler", () => {
    render(<Harness />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    fireEvent.keyDown(window, { key: "9" });
    expect(focused()).toBe(cell("r1", "a"));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(focused()).toBe(cell("r2", "a"));
  });

  it("stays out of the way while a cell editor has focus", () => {
    const onBeginEdit = vi.fn(() => true);
    render(<Harness withInput onBeginEdit={onBeginEdit} />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    screen.getByLabelText("editor").focus();
    fireEvent.keyDown(window, { key: "9" });
    expect(onBeginEdit).not.toHaveBeenCalled();
  });
});

// ── Rectangle validity ───────────────────────────────────────────────────────

describe("rectangle validity", () => {
  it("drops a selection whose row is filtered away", () => {
    const { rerender } = render(<Harness />);
    fireEvent.mouseDown(cell("r3", "b"), { button: 0 });
    expect(selected()).toBe(1);
    rerender(<Harness rowKeys={["r1", "r2"]} />);
    expect(selected()).toBe(0);
  });

  it("drops a selection whose column is hidden", () => {
    const { rerender } = render(<Harness />);
    fireEvent.mouseDown(cell("r1", "c"), { button: 0 });
    rerender(<Harness columnIds={["a", "b"]} />);
    expect(selected()).toBe(0);
  });
});

// ── Clipboard ────────────────────────────────────────────────────────────────

describe("clipboard", () => {
  it("writes the range to the clipboard as TSV", () => {
    const onCopy = vi.fn();
    render(<Harness onCopy={onCopy} />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    fireEvent.mouseDown(cell("r2", "b"), { button: 0, shiftKey: true });

    const { event, setData } = clipboardEvent("copy");
    document.dispatchEvent(event);
    expect(setData).toHaveBeenCalledWith("text/plain", "r1a\tr1b\nr2a\tr2b");
    expect(onCopy).toHaveBeenCalledWith("r1a\tr1b\nr2a\tr2b", expect.anything());
    expect(event.defaultPrevented).toBe(true);
  });

  it("copies nothing when there is no selection", () => {
    render(<Harness />);
    const { event, setData } = clipboardEvent("copy");
    document.dispatchEvent(event);
    expect(setData).not.toHaveBeenCalled();
  });

  it("falls back to the async clipboard when the event carries none", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<Harness />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    document.dispatchEvent(new Event("copy", { bubbles: true, cancelable: true }));
    expect(writeText).toHaveBeenCalledWith("r1a");
    vi.unstubAllGlobals();
  });

  it("reports a paste at the top-left of the selection", () => {
    const onPaste = vi.fn();
    render(<Harness onPaste={onPaste} />);
    // Dragged bottom-up: the anchor is r3, but a paste fills downwards from the
    // top of the rectangle, which is r2.
    fireEvent.mouseDown(cell("r3", "b"), { button: 0 });
    fireEvent.mouseDown(cell("r2", "a"), { button: 0, shiftKey: true });

    const { event } = clipboardEvent("paste", "x\ty\nz\tw\n");
    document.dispatchEvent(event);
    expect(onPaste).toHaveBeenCalledWith({
      anchor: { rowKey: "r2", columnId: "a" },
      matrix: [
        ["x", "y"],
        ["z", "w"],
      ],
      rowKeys: ["r2", "r3"],
      columnIds: ["a", "b"],
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it("reports the target rows in the grid's visible order, not the DOM's", () => {
    // The defect this replaces: only `anchor` shipped, so a consumer had to
    // answer "which row is next?" itself, and the only order reachable from out
    // there was the rendered one. Handing it a row order that is deliberately
    // not the natural one proves the payload comes from the model.
    const onPaste = vi.fn();
    const sorted = ["r4", "r2", "r3", "r1"];
    render(<Harness rowKeys={sorted} onPaste={onPaste} />);

    fireEvent.mouseDown(cell("r2", "b"), { button: 0 });
    const { event } = clipboardEvent("paste", "x\ny\nz");
    document.dispatchEvent(event);

    expect(onPaste.mock.calls[0][0].rowKeys).toEqual(["r2", "r3", "r1"]);
    expect(onPaste.mock.calls[0][0].columnIds).toEqual(["b"]);
  });

  it("clamps a matrix taller or wider than the rows and columns left", () => {
    // Overflow is dropped rather than invented: there is no row past the last
    // one to write into, and a consumer trusting `matrix.length` would index
    // past the end of its own buffer.
    const onPaste = vi.fn();
    render(<Harness onPaste={onPaste} />);

    fireEvent.mouseDown(cell("r3", "b"), { button: 0 });
    const { event } = clipboardEvent("paste", "1\t2\t3\n4\t5\t6\n7\t8\t9");
    document.dispatchEvent(event);

    expect(onPaste.mock.calls[0][0].rowKeys).toEqual(["r3", "r4"]);
    expect(onPaste.mock.calls[0][0].columnIds).toEqual(["b", "c"]);
    // The matrix itself is untouched — trimming it here would take the "does a
    // short row clear or skip?" decision away from the consumer.
    expect(onPaste.mock.calls[0][0].matrix).toHaveLength(3);
  });

  it("sizes the columns to the widest row of a ragged matrix", () => {
    const onPaste = vi.fn();
    render(<Harness onPaste={onPaste} />);

    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    const { event } = clipboardEvent("paste", "x\ny\tz");
    document.dispatchEvent(event);

    expect(onPaste.mock.calls[0][0].columnIds).toEqual(["a", "b"]);
  });

  it("leaves an empty clipboard alone", () => {
    const onPaste = vi.fn();
    render(<Harness onPaste={onPaste} />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    const { event } = clipboardEvent("paste", "");
    document.dispatchEvent(event);
    expect(onPaste).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves the paste to the browser while an editor has focus", () => {
    const onPaste = vi.fn();
    render(<Harness withInput onPaste={onPaste} />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    screen.getByLabelText("editor").focus();
    const { event } = clipboardEvent("paste", "x");
    document.dispatchEvent(event);
    expect(onPaste).not.toHaveBeenCalled();
  });
});

// ── Fill handle ──────────────────────────────────────────────────────────────

describe("fill handle", () => {
  it("sits on the range's bottom-right cell only", () => {
    render(<Harness onFill={vi.fn()} />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    fireEvent.mouseEnter(cell("r2", "b"));
    fireEvent.mouseUp(window);
    const handles = screen.getAllByTestId("fill-handle");
    expect(handles).toHaveLength(1);
    expect(cell("r2", "b")).toContainElement(handles[0]);
  });

  it("previews the dragged rows and reports the fill on mouseup", () => {
    const onFill = vi.fn();
    render(<Harness onFill={onFill} />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    fireEvent.mouseEnter(cell("r1", "b"));
    fireEvent.mouseUp(window);
    expect(selected()).toBe(2);

    fireEvent.mouseDown(screen.getByTestId("fill-handle"));
    fireEvent.mouseEnter(cell("r3", "b"));
    // Two rows × two columns of preview, and the source rectangle untouched.
    expect(document.querySelectorAll("[data-fill]")).toHaveLength(4);
    expect(selected()).toBe(2);

    fireEvent.mouseUp(window);
    expect(onFill).toHaveBeenCalledTimes(1);
    const fill = onFill.mock.calls[0][0] as CellRangeFill;
    expect(fill.source.rowKeys).toEqual(["r1"]);
    expect(fill.source.columnIds).toEqual(["a", "b"]);
    expect(fill.target.rowKeys).toEqual(["r2", "r3"]);
    expect(fill.target.columnIds).toEqual(["a", "b"]);
    expect(document.querySelectorAll("[data-fill]")).toHaveLength(0);
  });

  it("reports nothing for a drag that goes nowhere or upwards", () => {
    const onFill = vi.fn();
    render(<Harness onFill={onFill} />);
    fireEvent.mouseDown(cell("r3", "a"), { button: 0 });
    fireEvent.mouseUp(window);

    fireEvent.mouseDown(screen.getByTestId("fill-handle"));
    fireEvent.mouseEnter(cell("r1", "a"));
    fireEvent.mouseUp(window);
    expect(onFill).not.toHaveBeenCalled();
  });

  it("does not collapse the range when the handle is grabbed", () => {
    render(<Harness onFill={vi.fn()} />);
    fireEvent.mouseDown(cell("r1", "a"), { button: 0 });
    fireEvent.mouseEnter(cell("r2", "b"));
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(screen.getByTestId("fill-handle"));
    expect(selected()).toBe(4);
  });
});
