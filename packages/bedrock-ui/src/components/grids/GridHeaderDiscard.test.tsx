import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Table } from "@tanstack/react-table";
import GridHeader from "./GridHeader";
import type { GridConfig } from "../../hooks/useGridConfig";

const mockTable = {
  options: {},
  getRowModel: () => ({ rows: [{ id: "1" }] }),
} as unknown as Table<any>;

const mockConfig = {
  gridId: "test_grid",
  allowExport: false,
  showSearch: false,
  showDensityToggle: false,
} as unknown as GridConfig;

describe("GridHeader Discard Guarding (Bedrock #55)", () => {
  it("opens confirmation dialog when clicking discard and executes on confirm", async () => {
    const onDiscard = vi.fn();
    render(
      <GridHeader
        table={mockTable}
        config={mockConfig}
        bulkDirty={true}
        onBulkDiscard={onDiscard}
        confirmBulkDiscard={true}
      />,
    );

    const discardBtn = screen.getByRole("button", { name: /discard unsaved edits/i });
    fireEvent.click(discardBtn);

    // Dialog should open
    expect(screen.getByText(/discard unsaved changes\?/i)).toBeInTheDocument();
    expect(onDiscard).not.toHaveBeenCalled();

    // Confirm button inside dialog
    const confirmBtn = screen.getByRole("button", { name: /discard changes/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onDiscard).toHaveBeenCalledTimes(1);
    });
  });

  it("does not discard if cancel is clicked in confirmation dialog", async () => {
    const onDiscard = vi.fn();
    render(
      <GridHeader
        table={mockTable}
        config={mockConfig}
        bulkDirty={true}
        onBulkDiscard={onDiscard}
        confirmBulkDiscard={true}
      />,
    );

    const discardBtn = screen.getByRole("button", { name: /discard unsaved edits/i });
    fireEvent.click(discardBtn);

    expect(screen.getByText(/discard unsaved changes\?/i)).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /keep editing/i });
    fireEvent.click(cancelBtn);

    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("bypasses confirmation dialog when confirmBulkDiscard is false", () => {
    const onDiscard = vi.fn();
    render(
      <GridHeader
        table={mockTable}
        config={mockConfig}
        bulkDirty={true}
        onBulkDiscard={onDiscard}
        confirmBulkDiscard={false}
      />,
    );

    const discardBtn = screen.getByRole("button", { name: /discard unsaved edits/i });
    fireEvent.click(discardBtn);

    expect(screen.queryByText(/discard unsaved changes\?/i)).not.toBeInTheDocument();
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("aborts discard if onBeforeBulkDiscard returns false", async () => {
    const onDiscard = vi.fn();
    const onBefore = vi.fn().mockReturnValue(false);
    render(
      <GridHeader
        table={mockTable}
        config={mockConfig}
        bulkDirty={true}
        onBulkDiscard={onDiscard}
        confirmBulkDiscard={false}
        onBeforeBulkDiscard={onBefore}
      />,
    );

    const discardBtn = screen.getByRole("button", { name: /discard unsaved edits/i });
    fireEvent.click(discardBtn);

    expect(onBefore).toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
  });
});
