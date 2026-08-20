/**
 * @file ColumnToggle.test.tsx
 * @description Cover for the Columns popover — the reachability of a long list
 *              and the All/None controls that make one navigable.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Table } from "@tanstack/react-table";
import ColumnToggle from "./ColumnToggle";

vi.mock("../utils/logger", () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

interface FakeColumn {
  id: string;
  visible: boolean;
  canHide: boolean;
}

/**
 * A table stub exposing only what ColumnToggle touches. Real column objects
 * would drag the whole TanStack instance in for a component that just reads
 * visibility and writes it back.
 */
function fakeTable(cols: FakeColumn[], onToggle = vi.fn()) {
  const columns = cols.map((c) => ({
    id: c.id,
    columnDef: { header: c.id, meta: undefined },
    getCanHide: () => c.canHide,
    getIsVisible: () => c.visible,
    toggleVisibility: (next: boolean) => onToggle(c.id, next),
    getToggleVisibilityHandler:
      () => (e: { target: { checked: boolean } }) => onToggle(c.id, e.target.checked),
  }));
  return {
    table: { getAllColumns: () => columns } as unknown as Table<unknown>,
    onToggle,
  };
}

const openPopover = async () => {
  await userEvent.click(screen.getByRole("button", { name: /toggle column visibility/i }));
};

describe("ColumnToggle", () => {
  it("counts what is shown out of what can be toggled", async () => {
    // The count sits outside the scroll region, so it stays visible however
    // long the list is — that is the whole point of it being there.
    const { table } = fakeTable([
      { id: "sku", visible: true, canHide: true },
      { id: "title", visible: true, canHide: true },
      { id: "price", visible: false, canHide: true },
      { id: "locked", visible: true, canHide: false },
    ]);
    render(<ColumnToggle table={table} gridId="g" />);
    await openPopover();
    expect(screen.getByText(/2 of 3 shown/)).toBeInTheDocument();
  });

  it("shows every toggleable column at once", async () => {
    const { table, onToggle } = fakeTable([
      { id: "a", visible: false, canHide: true },
      { id: "b", visible: false, canHide: true },
    ]);
    render(<ColumnToggle table={table} gridId="g" />);
    await openPopover();
    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onToggle).toHaveBeenCalledWith("a", true);
    expect(onToggle).toHaveBeenCalledWith("b", true);
  });

  it("hides every toggleable column at once", async () => {
    const { table, onToggle } = fakeTable([
      { id: "a", visible: true, canHide: true },
      { id: "b", visible: true, canHide: true },
    ]);
    render(<ColumnToggle table={table} gridId="g" />);
    await openPopover();
    await userEvent.click(screen.getByRole("button", { name: "None" }));
    expect(onToggle).toHaveBeenCalledWith("a", false);
    expect(onToggle).toHaveBeenCalledWith("b", false);
  });

  it("leaves columns that cannot be hidden alone", async () => {
    // A grid's row-identity column opts out of hiding; "None" must not be a
    // way around that.
    const { table, onToggle } = fakeTable([
      { id: "sku", visible: true, canHide: false },
      { id: "price", visible: true, canHide: true },
    ]);
    render(<ColumnToggle table={table} gridId="g" />);
    await openPopover();
    expect(screen.queryByLabelText("sku")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "None" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("price", false);
  });

  it("scrolls a long list instead of running off the bottom of the screen", async () => {
    // The reported defect: a grid seeding its bulk-edit columns alongside its
    // browse columns put twenty-odd entries in a panel with no scroll region,
    // and the last ones were simply unreachable.
    const many = Array.from({ length: 24 }, (_, i) => ({
      id: `c${i}`,
      visible: true,
      canHide: true,
    }));
    const { table } = fakeTable(many);
    render(<ColumnToggle table={table} gridId="g" />);
    await openPopover();
    const last = screen.getByText("c23");
    const scroller = last.closest("div")!;
    expect(scroller.className).toMatch(/overflow-y-auto/);
    expect(scroller.className).toMatch(/max-h-/);
  });

  it("toggles a single column from its checkbox", async () => {
    const { table, onToggle } = fakeTable([{ id: "price", visible: false, canHide: true }]);
    render(<ColumnToggle table={table} gridId="g" />);
    await openPopover();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith("price", true);
  });
});
