import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Table } from "@tanstack/react-table";
import GridHeader from "./GridHeader";
import type { GridConfig } from "../../hooks/useGridConfig";
import { log } from "../../utils/logger";

vi.mock("../../utils/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

function makeMockTable(rowCount: number): Table<any> {
  const rows = Array.from({ length: rowCount }, (_, i) => ({ id: String(i) }));
  return {
    options: { getFilteredRowModel: () => ({ rows }) },
    getFilteredRowModel: () => ({ rows }),
    getRowModel: () => ({ rows }),
  } as unknown as Table<any>;
}

function makeMockConfig(overrides: Partial<GridConfig> = {}): GridConfig {
  return {
    gridId: "test_grid",
    page: null,
    defaultPageSize: 25,
    pageSizeOptions: [10, 25, 50],
    paginationEnabled: true,
    stickyHeader: false,
    rowStriping: false,
    denseMode: false,
    defaultSortColumn: null,
    defaultSortDirection: null,
    showRowCount: false,
    showRanking: false,
    wrapText: false,
    allowColumnToggle: false,
    allowExport: false,
    columns: {},
    columnOrder: [],
    isLoaded: true,
    isUnseeded: false,
    readOnly: 0,
    sortAscColor: null,
    sortDescColor: null,
    hoverColor: null,
    allowSelection: false,
    selectionPosition: "end",
    allowPrintView: false,
    title: null,
    subHeader: null,
    footer: null,
    minColumnWidth: 60,
    tooltipDelayDuration: 200,
    showSearch: false,
    showDensityToggle: false,
    showRankHighlight: false,
    rowKeyColumn: "id",
    caption: null,
    stickyFirstColumn: false,
    ...overrides,
  } as unknown as GridConfig;
}

describe("GridHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("lifecycle telemetry (§S003)", () => {
    it("logs a structured mount trace once, with gridId, action, and recordCount", () => {
      const table = makeMockTable(3);
      const config = makeMockConfig({ gridId: "my_grid" });
      render(<GridHeader table={table} config={config} />);

      const mountCalls = (log.info as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([payload]) => payload?.action === "mount",
      );
      expect(mountCalls).toHaveLength(1);
      expect(mountCalls[0][0]).toMatchObject({
        gridId: "my_grid",
        action: "mount",
        recordCount: 3,
      });
    });
  });

  describe("record count", () => {
    it("does not render the row count when config.showRowCount is false", () => {
      const table = makeMockTable(5);
      const config = makeMockConfig({ showRowCount: false });
      render(<GridHeader table={table} config={config} />);
      expect(screen.queryByText(/rows?$/i)).not.toBeInTheDocument();
    });

    it("renders singular 'row' for a count of 1", () => {
      const table = makeMockTable(1);
      const config = makeMockConfig({ showRowCount: true });
      render(<GridHeader table={table} config={config} />);
      expect(screen.getByText("1 row")).toBeInTheDocument();
    });

    it("renders plural 'rows' for a count other than 1", () => {
      const table = makeMockTable(5);
      const config = makeMockConfig({ showRowCount: true });
      render(<GridHeader table={table} config={config} />);
      expect(screen.getByText("5 rows")).toBeInTheDocument();
    });

    it("comma-formats large row counts", () => {
      const table = makeMockTable(12345);
      const config = makeMockConfig({ showRowCount: true });
      render(<GridHeader table={table} config={config} />);
      expect(screen.getByText("12,345 rows")).toBeInTheDocument();
    });
  });

  describe("title / subHeader block", () => {
    it("renders title and subHeader when both are set", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ title: "My Title", subHeader: "My Sub" });
      render(<GridHeader table={table} config={config} />);
      expect(screen.getByText("My Title")).toBeInTheDocument();
      expect(screen.getByText("My Sub")).toBeInTheDocument();
    });

    it("omits the title block entirely when neither title nor subHeader is set", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ title: null, subHeader: null });
      const { container } = render(<GridHeader table={table} config={config} />);
      expect(container.querySelector("h2")).not.toBeInTheDocument();
    });
  });

  describe("search input", () => {
    it("does not render when showSearch is true but onSearchChange is undefined", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ showSearch: true });
      expect(() =>
        render(<GridHeader table={table} config={config} onSearchChange={undefined} />),
      ).not.toThrow();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("does not render when onSearchChange is provided but showSearch is false", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ showSearch: false });
      render(<GridHeader table={table} config={config} onSearchChange={vi.fn()} />);
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("renders with the given placeholder when both showSearch and onSearchChange are set", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ showSearch: true });
      render(
        <GridHeader
          table={table}
          config={config}
          onSearchChange={vi.fn()}
          searchPlaceholder="Find rows…"
        />,
      );
      expect(screen.getByPlaceholderText("Find rows…")).toBeInTheDocument();
    });

    it("invokes onSearchChange and logs a structured search action when typing", () => {
      const table = makeMockTable(2);
      const config = makeMockConfig({ showSearch: true, gridId: "search_grid" });
      const onSearchChange = vi.fn();
      render(<GridHeader table={table} config={config} onSearchChange={onSearchChange} />);

      const input = screen.getByRole("textbox", { name: /search grid rows/i });
      fireEvent.change(input, { target: { value: "abc" } });

      expect(onSearchChange).toHaveBeenCalledWith("abc");
      const searchCalls = (log.info as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([payload]) => payload?.action === "search",
      );
      expect(searchCalls).toHaveLength(1);
      expect(searchCalls[0][0]).toMatchObject({
        gridId: "search_grid",
        action: "search",
        query: "abc",
      });
    });

    it("shows a clear button when search value is non-empty and clears it on click", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ showSearch: true });
      const onSearchChange = vi.fn();
      render(
        <GridHeader
          table={table}
          config={config}
          onSearchChange={onSearchChange}
          search="abc"
        />,
      );

      const clearBtn = screen.getByRole("button", { name: /clear search/i });
      expect(clearBtn).toBeInTheDocument();
      fireEvent.click(clearBtn);
      expect(onSearchChange).toHaveBeenCalledWith("");
    });

    it("does not show a clear button when search value is empty", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ showSearch: true });
      render(<GridHeader table={table} config={config} onSearchChange={vi.fn()} search="" />);
      expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();
    });
  });

  describe("filtersSlot", () => {
    it("renders the provided filtersSlot node", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig();
      render(
        <GridHeader
          table={table}
          config={config}
          filtersSlot={<div data-testid="custom-filter">Custom Filter</div>}
        />,
      );
      expect(screen.getByTestId("custom-filter")).toBeInTheDocument();
    });

    it("does not render a filters slot when not provided", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig();
      const { container } = render(<GridHeader table={table} config={config} />);
      expect(container.querySelector('[data-slot="grid-header-filters"]')).not.toBeInTheDocument();
    });
  });

  describe("density toggle", () => {
    it("does not render when config.showDensityToggle is false", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ showDensityToggle: false });
      render(
        <GridHeader
          table={table}
          config={config}
          density="standard"
          onDensityChange={vi.fn()}
        />,
      );
      expect(screen.queryByRole("button", { name: /row density/i })).not.toBeInTheDocument();
    });

    it("does not render when density is undefined even if showDensityToggle is true", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ showDensityToggle: true });
      render(<GridHeader table={table} config={config} onDensityChange={vi.fn()} />);
      expect(screen.queryByRole("button", { name: /row density/i })).not.toBeInTheDocument();
    });

    it("does not render when onDensityChange is undefined even if showDensityToggle is true", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ showDensityToggle: true });
      render(<GridHeader table={table} config={config} density="standard" />);
      expect(screen.queryByRole("button", { name: /row density/i })).not.toBeInTheDocument();
    });

    it("renders and invokes onDensityChange + logs density action when all three are provided", () => {
      const table = makeMockTable(4);
      const config = makeMockConfig({ showDensityToggle: true, gridId: "density_grid" });
      const onDensityChange = vi.fn();
      render(
        <GridHeader
          table={table}
          config={config}
          density="standard"
          onDensityChange={onDensityChange}
        />,
      );

      const btn = screen.getByRole("button", { name: /row density/i });
      fireEvent.click(btn);

      expect(onDensityChange).toHaveBeenCalledTimes(1);
      const densityCalls = (log.info as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([payload]) => payload?.action === "density",
      );
      expect(densityCalls).toHaveLength(1);
      expect(densityCalls[0][0]).toMatchObject({
        gridId: "density_grid",
        action: "density",
        recordCount: 4,
      });
    });
  });

  describe("CSV export", () => {
    it("does not render when config.allowExport is false", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ allowExport: false });
      render(<GridHeader table={table} config={config} onExport={vi.fn()} />);
      expect(screen.queryByRole("button", { name: /export grid to csv/i })).not.toBeInTheDocument();
    });

    it("does not render when onExport is undefined even if allowExport is true", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ allowExport: true });
      render(<GridHeader table={table} config={config} />);
      expect(screen.queryByRole("button", { name: /export grid to csv/i })).not.toBeInTheDocument();
    });

    it("renders and invokes onExport + logs export action when both are provided", () => {
      const table = makeMockTable(7);
      const config = makeMockConfig({ allowExport: true, gridId: "export_grid" });
      const onExport = vi.fn();
      render(<GridHeader table={table} config={config} onExport={onExport} />);

      const btn = screen.getByRole("button", { name: /export grid to csv/i });
      fireEvent.click(btn);

      expect(onExport).toHaveBeenCalledTimes(1);
      const exportCalls = (log.info as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([payload]) => payload?.action === "export",
      );
      expect(exportCalls).toHaveLength(1);
      expect(exportCalls[0][0]).toMatchObject({
        gridId: "export_grid",
        action: "export",
        recordCount: 7,
      });
    });
  });

  describe("print trigger", () => {
    it("does not render when config.allowPrintView is false", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ allowPrintView: false });
      render(<GridHeader table={table} config={config} />);
      expect(screen.queryByRole("button", { name: /trigger page print layout/i })).not.toBeInTheDocument();
    });

    it("renders, calls window.print, and logs a print action when clicked", () => {
      const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
      const table = makeMockTable(9);
      const config = makeMockConfig({ allowPrintView: true, gridId: "print_grid" });
      render(<GridHeader table={table} config={config} />);

      const btn = screen.getByRole("button", { name: /trigger page print layout/i });
      fireEvent.click(btn);

      expect(printSpy).toHaveBeenCalledTimes(1);
      const printCalls = (log.info as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([payload]) => payload?.action === "print",
      );
      expect(printCalls).toHaveLength(1);
      expect(printCalls[0][0]).toMatchObject({
        gridId: "print_grid",
        action: "print",
        recordCount: 9,
      });
      printSpy.mockRestore();
    });
  });

  describe("dashboard pin button", () => {
    it("is omitted entirely when dashboardPin is undefined", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig();
      render(
        <GridHeader
          table={table}
          config={config}
          dashboardPin={undefined}
          onDashboardPinToggle={vi.fn()}
        />,
      );
      expect(
        screen.queryByRole("button", { name: /pin to dashboard|unpin from dashboard/i }),
      ).not.toBeInTheDocument();
    });

    it("renders in the unpinned state when dashboardPin is false, and pins on click", () => {
      const table = makeMockTable(2);
      const config = makeMockConfig({ gridId: "pin_grid" });
      const onDashboardPinToggle = vi.fn();
      render(
        <GridHeader
          table={table}
          config={config}
          dashboardPin={false}
          onDashboardPinToggle={onDashboardPinToggle}
        />,
      );

      const btn = screen.getByRole("button", { name: /pin to dashboard/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);

      expect(onDashboardPinToggle).toHaveBeenCalledTimes(1);
      const pinCalls = (log.info as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([payload]) => payload?.action === "dashboard_pin",
      );
      expect(pinCalls).toHaveLength(1);
      expect(pinCalls[0][0]).toMatchObject({
        gridId: "pin_grid",
        action: "dashboard_pin",
        pinned: true,
      });
    });

    it("renders in the pinned state when dashboardPin is true, and unpins on click", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig({ gridId: "pin_grid" });
      const onDashboardPinToggle = vi.fn();
      render(
        <GridHeader
          table={table}
          config={config}
          dashboardPin={true}
          onDashboardPinToggle={onDashboardPinToggle}
        />,
      );

      const btn = screen.getByRole("button", { name: /unpin from dashboard/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);

      expect(onDashboardPinToggle).toHaveBeenCalledTimes(1);
      const pinCalls = (log.info as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([payload]) => payload?.action === "dashboard_pin",
      );
      expect(pinCalls[0][0]).toMatchObject({
        gridId: "pin_grid",
        action: "dashboard_pin",
        pinned: false,
      });
    });
  });

  describe("bulk save", () => {
    it("does not render a Save control when bulkDirty is false", () => {
      const table = makeMockTable(0);
      const config = makeMockConfig();
      render(<GridHeader table={table} config={config} bulkDirty={false} onBulkSave={vi.fn()} />);
      expect(screen.queryByRole("button", { name: /save unsaved edits/i })).not.toBeInTheDocument();
    });

    it("renders a Save control and invokes onBulkSave + logs bulk-save action when clicked", () => {
      const table = makeMockTable(6);
      const config = makeMockConfig({ gridId: "bulk_grid" });
      const onBulkSave = vi.fn();
      render(
        <GridHeader
          table={table}
          config={config}
          bulkDirty={true}
          onBulkSave={onBulkSave}
        />,
      );

      const btn = screen.getByRole("button", { name: /save unsaved edits/i });
      fireEvent.click(btn);

      expect(onBulkSave).toHaveBeenCalledTimes(1);
      const saveCalls = (log.info as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([payload]) => payload?.action === "bulk-save",
      );
      expect(saveCalls).toHaveLength(1);
      expect(saveCalls[0][0]).toMatchObject({
        gridId: "bulk_grid",
        action: "bulk-save",
        recordCount: 6,
      });
    });
  });
});
