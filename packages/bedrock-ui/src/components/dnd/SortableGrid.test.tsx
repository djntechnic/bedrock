/**
 * @file SortableGrid.test.tsx
 * @description Pointer (HTML5 DnD) and keyboard reorder cycles for SortableGrid.
 */
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortableGrid, SortableItem } from "./SortableGrid";

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function Harness({
  initial = ["A", "B", "C", "D"],
  columns = 1,
  disabled = false,
  onReorder,
}: {
  initial?: string[];
  columns?: number;
  disabled?: boolean;
  onReorder: (from: number, to: number) => void;
}) {
  const [items, setItems] = useState(initial);
  return (
    <SortableGrid
      aria-label="Letters"
      itemCount={items.length}
      columns={columns}
      disabled={disabled}
      getItemLabel={(i) => items[i]}
      onReorder={(from, to) => {
        onReorder(from, to);
        setItems((cur) => move(cur, from, to));
      }}
    >
      {items.map((item, i) => (
        <SortableItem key={item} index={i}>
          {item}
        </SortableItem>
      ))}
    </SortableGrid>
  );
}

const items = () => screen.getAllByRole("button");
const item = (name: string) => screen.getByRole("button", { name });
/** Visual order: DOM text sorted by the CSS `order` each item is drawn at. */
const visualOrder = () =>
  items()
    .map((el) => ({ text: el.textContent, order: Number(el.style.order) }))
    .sort((a, b) => a.order - b.order)
    .map((x) => x.text);
const liveRegion = () => screen.getByRole("status");

function dataTransfer() {
  return { effectAllowed: "", dropEffect: "", setData: vi.fn(), getData: vi.fn() };
}

describe("SortableGrid — ARIA", () => {
  it("marks items as sortable with instructions and a single tab stop", () => {
    render(<Harness onReorder={vi.fn()} />);
    const all = items();
    expect(all).toHaveLength(4);
    for (const el of all) {
      expect(el).toHaveAttribute("aria-roledescription", "sortable item");
      expect(el).toHaveAttribute("aria-grabbed", "false");
      expect(el).toHaveAttribute("draggable", "true");
      expect(el).toHaveAccessibleDescription(/pick up/i);
    }
    expect(all.map((el) => el.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(liveRegion()).toHaveAttribute("aria-live", "assertive");
  });

  it("throws when SortableItem renders outside SortableGrid", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<SortableItem index={0}>x</SortableItem>)).toThrow(/inside <SortableGrid>/);
    spy.mockRestore();
  });
});

describe("SortableGrid — pointer drag and drop", () => {
  it("fires onReorder(source, target) on drop and applies the move", () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    const dt = dataTransfer();

    fireEvent.dragStart(item("A"), { dataTransfer: dt });
    expect(dt.setData).toHaveBeenCalledWith("text/plain", "0");
    expect(item("A")).toHaveAttribute("aria-grabbed", "true");
    expect(item("A")).toHaveAttribute("data-dragging", "true");

    fireEvent.dragOver(item("C"), { dataTransfer: dt });
    expect(visualOrder()).toEqual(["B", "C", "A", "D"]);

    fireEvent.drop(item("A"), { dataTransfer: dt });
    fireEvent.dragEnd(item("A"), { dataTransfer: dt });

    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(0, 2);
    expect(items().map((el) => el.textContent)).toEqual(["B", "C", "A", "D"]);
    expect(item("A")).toHaveAttribute("aria-grabbed", "false");
    expect(liveRegion()).toHaveTextContent("A dropped at position 3 of 4.");
  });

  it("moves an item backwards", () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    const dt = dataTransfer();
    fireEvent.dragStart(item("D"), { dataTransfer: dt });
    fireEvent.dragOver(item("B"), { dataTransfer: dt });
    fireEvent.drop(item("B"), { dataTransfer: dt });
    fireEvent.dragEnd(item("D"), { dataTransfer: dt });
    expect(onReorder).toHaveBeenCalledWith(3, 1);
    expect(items().map((el) => el.textContent)).toEqual(["A", "D", "B", "C"]);
  });

  it("cancels when the drag ends outside any item", () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    const dt = dataTransfer();
    fireEvent.dragStart(item("A"), { dataTransfer: dt });
    fireEvent.dragOver(item("C"), { dataTransfer: dt });
    fireEvent.dragEnd(item("A"), { dataTransfer: dt });
    expect(onReorder).not.toHaveBeenCalled();
    expect(visualOrder()).toEqual(["A", "B", "C", "D"]);
    expect(liveRegion()).toHaveTextContent(/Reorder cancelled/);
  });

  it("does not fire onReorder for a drop on the original position", () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    const dt = dataTransfer();
    fireEvent.dragStart(item("B"), { dataTransfer: dt });
    fireEvent.drop(item("B"), { dataTransfer: dt });
    fireEvent.dragEnd(item("B"), { dataTransfer: dt });
    expect(onReorder).not.toHaveBeenCalled();
    expect(liveRegion()).toHaveTextContent("B dropped. Position unchanged.");
  });

  it("is inert when disabled", () => {
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} disabled />);
    const dt = dataTransfer();
    expect(item("A")).toHaveAttribute("draggable", "false");
    fireEvent.dragStart(item("A"), { dataTransfer: dt });
    fireEvent.dragOver(item("C"), { dataTransfer: dt });
    fireEvent.drop(item("C"), { dataTransfer: dt });
    expect(onReorder).not.toHaveBeenCalled();
    expect(item("A")).toHaveAttribute("aria-grabbed", "false");
  });
});

describe("SortableGrid — keyboard", () => {
  it("picks up, moves with arrows, and commits with Space", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);

    await user.tab();
    expect(item("A")).toHaveFocus();

    await user.keyboard(" ");
    expect(item("A")).toHaveAttribute("aria-grabbed", "true");
    expect(liveRegion()).toHaveTextContent("Picked up A. Current position 1 of 4.");

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(visualOrder()).toEqual(["B", "C", "A", "D"]);
    expect(liveRegion()).toHaveTextContent("A moved to position 3 of 4.");
    expect(onReorder).not.toHaveBeenCalled();

    await user.keyboard(" ");
    expect(onReorder).toHaveBeenCalledTimes(1);
    expect(onReorder).toHaveBeenCalledWith(0, 2);
    expect(items().map((el) => el.textContent)).toEqual(["B", "C", "A", "D"]);
    expect(item("A")).toHaveFocus();
    expect(item("A")).toHaveAttribute("tabindex", "0");
    expect(item("A")).toHaveAttribute("aria-grabbed", "false");
  });

  it("commits with Enter", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    act(() => item("C").focus());
    await user.keyboard("{Enter}{ArrowUp}{Enter}");
    expect(onReorder).toHaveBeenCalledWith(2, 1);
    expect(items().map((el) => el.textContent)).toEqual(["A", "C", "B", "D"]);
  });

  it("Escape cancels and restores the original position", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    act(() => item("B").focus());
    await user.keyboard(" {ArrowDown}{ArrowDown}");
    expect(visualOrder()).toEqual(["A", "C", "D", "B"]);

    await user.keyboard("{Escape}");
    expect(onReorder).not.toHaveBeenCalled();
    expect(visualOrder()).toEqual(["A", "B", "C", "D"]);
    expect(item("B")).toHaveAttribute("aria-grabbed", "false");
    expect(item("B")).toHaveFocus();
    expect(liveRegion()).toHaveTextContent(
      "Reorder cancelled. B returned to position 2 of 4.",
    );
  });

  it("clamps movement at the edges", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    render(<Harness onReorder={onReorder} />);
    act(() => item("A").focus());
    await user.keyboard(" {ArrowUp}{ArrowLeft} ");
    expect(onReorder).not.toHaveBeenCalled();
    expect(liveRegion()).toHaveTextContent("A dropped. Position unchanged.");
  });

  it("moves by a full row with Up/Down in a multi-column grid", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    render(<Harness initial={["A", "B", "C", "D", "E", "F"]} columns={3} onReorder={onReorder} />);
    act(() => item("A").focus());
    await user.keyboard(" {ArrowDown}{ArrowRight} ");
    expect(onReorder).toHaveBeenCalledWith(0, 4);
    expect(items().map((el) => el.textContent)).toEqual(["B", "C", "D", "E", "A", "F"]);

    act(() => item("F").focus());
    await user.keyboard(" {ArrowUp}{ArrowLeft}{Enter}");
    expect(onReorder).toHaveBeenLastCalledWith(5, 1);
  });

  it("arrow keys move focus between items when nothing is picked up", async () => {
    const user = userEvent.setup();
    render(<Harness initial={["A", "B", "C", "D", "E", "F"]} columns={3} onReorder={vi.fn()} />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(item("B")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("E")).toHaveFocus();
    expect(item("E")).toHaveAttribute("tabindex", "0");
    expect(item("B")).toHaveAttribute("tabindex", "-1");
    await user.keyboard("{Home}");
    expect(item("A")).toHaveFocus();
    await user.keyboard("{End}");
    expect(item("F")).toHaveFocus();
  });

  it("ignores keys from interactive children", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    render(
      <SortableGrid itemCount={1} onReorder={onReorder}>
        <SortableItem index={0}>
          <input aria-label="note" />
        </SortableItem>
      </SortableGrid>,
    );
    await user.click(screen.getByRole("textbox", { name: "note" }));
    await user.keyboard(" ");
    expect(screen.getByRole("button")).toHaveAttribute("aria-grabbed", "false");
  });

  it("does not pick up when disabled", async () => {
    const user = userEvent.setup();
    render(<Harness onReorder={vi.fn()} disabled />);
    act(() => item("A").focus());
    await user.keyboard(" ");
    expect(item("A")).toHaveAttribute("aria-grabbed", "false");
    expect(item("A")).toHaveAttribute("aria-disabled", "true");
  });
});
