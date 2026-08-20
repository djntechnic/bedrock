/**
 * @file gridUtils.test.tsx
 * @description The selection checkbox column, after it stopped being a
 *              player-comparison widget: no hardcoded cap, either side of the
 *              grid, and a row key of 0 that still gets a checkbox.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ColumnDef } from "@tanstack/react-table";
import { prependSelectionColumn } from "./gridUtils";

interface Row extends Record<string, unknown> {
  item_id: number;
  title: string;
}

const DATA: ColumnDef<Row>[] = [{ id: "title", header: "Title" }];

function build(
  selectedIds: number[],
  options?: Parameters<typeof prependSelectionColumn<Row>>[6],
  position: "start" | "end" = "end",
) {
  const onSelectionChange = vi.fn();
  const cols = prependSelectionColumn<Row>(
    DATA,
    true,
    selectedIds,
    onSelectionChange,
    "item_id",
    position,
    options,
  );
  return { cols, onSelectionChange };
}

/** Render one checkbox cell without standing up a whole table. */
function renderCell(cols: ColumnDef<Row>[], row: Row) {
  const col = cols.find((c) => (c as any).id === "_compare") as any;
  return render(<>{col.cell({ row: { original: row } })}</>);
}

describe("prependSelectionColumn", () => {
  it("returns the columns untouched when selection is off", () => {
    expect(prependSelectionColumn<Row>(DATA, false, [], vi.fn(), "item_id")).toBe(
      DATA,
    );
  });

  it("sits on the side the caller asks for", () => {
    expect((build([], undefined, "end").cols[1] as any).id).toBe("_compare");
    expect((build([], undefined, "start").cols[0] as any).id).toBe("_compare");
  });

  it("has no selection cap by default", () => {
    const { cols } = build([1, 2, 3, 4, 5]);
    renderCell(cols, { item_id: 6, title: "six" });
    expect(screen.getByRole("checkbox")).toBeEnabled();
  });

  it("disables an unchecked box once an opted-in cap is reached", () => {
    const { cols } = build([1, 2, 3], { maxSelected: 3, cellTitleAtLimit: "Max 3" });
    renderCell(cols, { item_id: 4, title: "four" });
    const box = screen.getByRole("checkbox");
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute("title", "Max 3");
  });

  it("leaves a checked box usable at the cap, so it can be unchecked", () => {
    const { cols } = build([1, 2, 3], { maxSelected: 3 });
    renderCell(cols, { item_id: 3, title: "three" });
    expect(screen.getByRole("checkbox")).toBeEnabled();
  });

  it("renders a checkbox for row key 0 and none for a missing key", () => {
    const { cols } = build([]);
    const zero = renderCell(cols, { item_id: 0, title: "zero" });
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    zero.unmount();
    renderCell(cols, { title: "no key" } as unknown as Row);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("carries caller-supplied header and cell copy", () => {
    const { cols } = build([], {
      headerLabel: "Pick",
      headerTitle: "Pick listings",
      cellTitle: "Pick this listing",
    });
    const col = cols.find((c) => (c as any).id === "_compare") as any;
    render(<>{col.header()}</>);
    expect(screen.getByTitle("Pick listings")).toHaveTextContent("Pick");
    renderCell(cols, { item_id: 1, title: "one" });
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "title",
      "Pick this listing",
    );
  });
});
