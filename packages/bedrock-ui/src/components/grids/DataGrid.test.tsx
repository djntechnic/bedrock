/**
 * @file DataGrid.test.tsx
 * @description Invariants and behaviors for `<DataGrid>`:
 *   - The `gridRef` handle (#35): pulled sorted model order.
 *   - Phase 7 D1 row-key invariant (#49).
 *   - Selection column, positioning, and max cap (#49).
 *   - Phase 7 F1 sticky_first_column wiring.
 *   - Phase 8 H1 virtualized variant.
 *   - Phase 8 H3 inline-editing wiring.
 *   - Phase 10 B2 row-expansion primitive.
 *   - Phase 10 B3 bulk-save primitive.
 *   - Phase 3 §S9 grid style tokens (numeralStyle, liveUpdateHighlight, rowAccentReactive).
 */
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { GridColumnSetting, GridSetting } from "../../hooks/useAdminPlatform";
import type { GridConfig } from "../../hooks/useGridConfig";
import { buildGridConfig } from "../../hooks/useGridConfig";
import { makeColumnSetting, makeGridConfig } from "../../test/gridMocks";
import { ensureDomMocks, renderWithGridProviders } from "../../test/test-utils";
import {
  registerRowAccentResolver,
  __clearRowAccentResolver,
} from "./rowAccentRegistry";

beforeAll(() => {
  ensureDomMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

let activeConfig: GridConfig | null = null;
let activeSorting: SortingState = [];
let activeColumnVisibility: Record<string, boolean> = {};

function seedConfig(overrides: Partial<GridConfig> = {}) {
  const cfg = makeGridConfig({
    columns: {
      name: makeColumnSetting({ column_id: "name", label_override: "Name" }),
    },
    columnOrder: ["name"],
    rowKeyColumn: "id",
    ...overrides,
  });
  activeConfig = cfg;
  return cfg;
}

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock("../../hooks/useAdminPlatform", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useAdminPlatform")>()),
  useAdmin: () => ({ logExport: vi.fn() }),
}));

vi.mock("../../hooks/useTableState", () => ({
  useTableState: (gridId: string) => {
    const config = activeConfig ?? testConfig(gridId);
    const [sorting, setSorting] = useState<SortingState>(activeSorting);
    const [columnVisibility, setColumnVisibility] =
      useState<Record<string, boolean>>(activeColumnVisibility);
    return {
      config,
      sorting,
      setSorting,
      columnVisibility,
      setColumnVisibility,
      cellPad: config.denseMode ? "px-2 py-1" : "px-3 py-2",
      headerClassName: config.stickyHeader ? "sticky top-0 z-10" : "",
      bodyClassName: config.rowStriping
        ? "[&>tr:nth-child(even)]:bg-muted/20"
        : "",
      rowClassName: config.wrapText ? "" : "whitespace-nowrap",
      isLoaded: true,
      pinnedFilters: null,
      columnOrder: config.columnOrder ?? [],
      persistFilters: () => {},
      persistColumnOrder: () => {},
      dashboardPin: false,
      setDashboardPin: () => {},
    };
  },
}));

// eslint-disable-next-line import/first -- must follow the vi.mock calls above
import DataGrid, { type DataGridHandle } from "./DataGrid";

interface Card extends Record<string, unknown> {
  id: number;
  name: string;
  category?: string;
  score?: number;
}

/** Deliberately not in name order: an unsorted grid must not look sorted. */
const CARDS: Card[] = [
  { id: 10, name: "Charlie" },
  { id: 20, name: "Alice" },
  { id: 30, name: "Bravo" },
];

function nameColumn(): GridColumnSetting {
  return {
    grid_setting_id: 1,
    column_id: "name",
    label_override: "Name",
    tooltip_override: null,
    default_visible: true,
    column_order: 1,
    null_display: "—",
    allow_sort: true,
    allow_sort_mode: "both",
    allow_filter: false,
    read_only: true,
    width: 200,
    min_width: 80,
    text_align: "left",
    wrap_text: false,
    resizable: false,
    cell_type: "text",
    group_by: false,
  };
}

function gridSetting(gridId: string): GridSetting {
  return {
    grid_setting_id: 1,
    grid_id: gridId,
    grid_label: "Cards",
    allow_column_toggle: false,
    allow_export: false,
    read_only: true,
    default_page_size: 50,
    page_size_options: "25,50",
    pagination_enabled: true,
    sticky_header: false,
    sticky_first_column: false,
    row_striping: false,
    dense_mode: false,
    show_row_count: false,
    show_ranking: false,
    wrap_text: false,
    min_column_width: 40,
    row_key_column: "id",
  };
}

function testConfig(gridId: string) {
  return buildGridConfig(gridId, gridSetting(gridId), [nameColumn()], true);
}

function domRowKeys(): string[] {
  const keys = Array.from(
    document.querySelectorAll<HTMLElement>("[data-row-key]"),
  ).map((el) => el.dataset.rowKey ?? "");
  return Array.from(new Set(keys));
}

function renderGrid(props: Record<string, unknown> = {}) {
  const box: { handle: DataGridHandle | null } = { handle: null };
  renderWithGridProviders(
    <DataGrid<Card>
      gridId="cards"
      rows={CARDS}
      isEmbedded
      gridRef={(h) => {
        box.handle = h;
      }}
      {...props}
    />,
  );
  return box;
}

// ─── 1. gridRef handle ────────────────────────────────────────────────────────
describe("gridRef", () => {
  beforeEach(() => {
    activeConfig = null;
    activeSorting = [];
    activeColumnVisibility = {};
    __clearRowAccentResolver();
  });

  it("hands over the model's row order, keyed by rowKeyColumn", () => {
    const box = renderGrid();
    expect(box.handle?.getSortedRowKeys()).toEqual(["10", "20", "30"]);
  });

  it("re-reflects the order after the user sorts", async () => {
    const user = userEvent.setup();
    const box = renderGrid();

    await user.click(screen.getByText("Name"));

    expect(box.handle?.getSortedRowKeys()).toEqual(["20", "30", "10"]);
  });

  it("answers with no cell selection enabled", () => {
    const box = renderGrid({ cellSelection: false });
    expect(box.handle?.getSortedRowKeys()).toEqual(["10", "20", "30"]);
  });

  it("agrees with the DOM when the DOM is complete", () => {
    const box = renderGrid();
    expect(box.handle?.getSortedRowKeys()).toEqual(domRowKeys());
  });

  it("stays complete under virtualisation, where the DOM is not", () => {
    const many: Card[] = Array.from({ length: 300 }, (_, i) => ({
      id: i + 1,
      name: `Card ${i + 1}`,
    }));
    const box = renderGrid({
      rows: many,
      isEmbedded: false,
      variant: "virtualized",
    });

    const keys = box.handle?.getSortedRowKeys() ?? [];
    expect(keys).toHaveLength(300);
    expect(keys[0]).toBe("1");
    expect(keys[299]).toBe("300");
    expect(domRowKeys().length).toBeLessThan(300);
  });

  it("is optional — the grid renders without one", () => {
    renderWithGridProviders(
      <DataGrid<Card> gridId="cards" rows={CARDS} isEmbedded />,
    );
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });
});

// ─── 2. Row Key Invariant (Phase 7 D1 / Bedrock #49) ──────────────────────────
describe("DataGrid — Phase 7 D1 row-key invariant", () => {
  beforeEach(() => {
    activeConfig = null;
    vi.clearAllMocks();
    __clearRowAccentResolver();
  });

  it("throws when config.rowKeyColumn is null", () => {
    seedConfig({ rowKeyColumn: null as unknown as string });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      renderWithGridProviders(
        <DataGrid gridId="grid_missing_key" rows={CARDS} />,
      ),
    ).toThrow(/rowKeyColumn is required/i);
    consoleError.mockRestore();
  });

  it("renders normally when config.rowKeyColumn is set", () => {
    seedConfig({ rowKeyColumn: "id" });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_with_key" rows={CARDS} />,
    );
    expect(container.querySelector("table")).not.toBeNull();
  });
});

// ─── 3. Selection Column & Positioning & Max (Bedrock #49) ────────────────────
describe("DataGrid — Selection column and positioning", () => {
  beforeEach(() => {
    activeConfig = null;
    vi.clearAllMocks();
    __clearRowAccentResolver();
  });

  it("renders selection column at end by default", () => {
    seedConfig({
      allowSelection: true,
      selectionPosition: "end",
      columnOrder: [],
    });
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_sel_end"
        rows={CARDS}
        selectionOverride={{ selectedIds: [], onChange: vi.fn() }}
      />,
    );
    const headers = container.querySelectorAll("thead th");
    const lastHeader = headers[headers.length - 1];
    expect(lastHeader.textContent).toContain("Sel");
  });

  it("renders selection column at start when configured", () => {
    seedConfig({
      allowSelection: true,
      selectionPosition: "start",
      columnOrder: [],
    });
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_sel_start"
        rows={CARDS}
        selectionOverride={{ selectedIds: [], onChange: vi.fn() }}
      />,
    );
    const headers = container.querySelectorAll("thead th");
    expect(headers[0].textContent).toContain("Sel");
  });

  it("respects selectionOptions.max and limits selection", () => {
    seedConfig({ allowSelection: true, columnOrder: [] });
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_sel_max"
        rows={CARDS}
        selectionOverride={{ selectedIds: [10], onChange: vi.fn() }}
        selectionOptions={{ maxSelected: 1 }}
      />,
    );

    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'tbody input[type="checkbox"]',
    );
    expect(checkboxes.length).toBe(3);
    // Row 10 is checked and enabled
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[0].disabled).toBe(false);
    // Other rows are disabled because maxSelected limit (1) is reached
    expect(checkboxes[1].disabled).toBe(true);
    expect(checkboxes[2].disabled).toBe(true);
  });
});

// ─── 4. Sticky First Column Wiring (Phase 7 F1) ──────────────────────────────
describe("DataGrid — Phase 7 F1 sticky_first_column wiring", () => {
  beforeEach(() => {
    activeConfig = null;
    vi.clearAllMocks();
    __clearRowAccentResolver();
  });

  it("applies sticky pin styling to the first visible column when stickyFirstColumn=true", () => {
    seedConfig({ stickyFirstColumn: true });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_sticky_first" rows={CARDS} />,
    );
    const firstHeaderCell = container.querySelector("thead th");
    expect(firstHeaderCell?.className).toMatch(/sticky/);
  });

  it("leaves columns unpinned when stickyFirstColumn=false and no explicit pinned column exists", () => {
    seedConfig({ stickyFirstColumn: false });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_no_sticky" rows={CARDS} />,
    );
    const firstHeaderCell = container.querySelector("thead th");
    expect(firstHeaderCell?.className || "").not.toMatch(/left-0/);
  });
});

// ─── 5. Virtualized Variant (Phase 8 H1) ──────────────────────────────────────
describe("DataGrid — Phase 8 H1 virtualized variant", () => {
  beforeEach(() => {
    activeConfig = null;
    vi.clearAllMocks();
    __clearRowAccentResolver();
  });

  it("does not render a GridWrapper pagination shell in virtualized mode", () => {
    seedConfig({ paginationEnabled: true });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_virt" variant="virtualized" rows={CARDS} />,
    );
    expect(container.textContent || "").not.toMatch(/rows per page/i);
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("still renders the GridHeader toolbar (search / density / export gates)", () => {
    seedConfig({ showSearch: true });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_virt_header" variant="virtualized" rows={CARDS} />,
    );
    expect(container.querySelector("input")).not.toBeNull();
  });

  it("renders every row in the sorted set (no pagination slicing) when virtualized", () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: i,
      name: `Card ${i}`,
    }));
    seedConfig({ paginationEnabled: true, defaultPageSize: 10 });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_virt_full" variant="virtualized" rows={rows} />,
    );
    expect(container.textContent || "").toContain("Card 24");
  });
});

// ─── 6. Inline-Editing Wiring (Phase 8 H3) ───────────────────────────────────
describe("DataGrid — Phase 8 H3 inline-editing wiring", () => {
  beforeEach(() => {
    activeConfig = null;
    vi.clearAllMocks();
    __clearRowAccentResolver();
  });

  function seedEditableConfig(overrides: Partial<GridConfig> = {}) {
    return seedConfig({
      columns: {
        name: makeColumnSetting({
          column_id: "name",
          label_override: "Name",
          editable: true,
        }),
      },
      columnOrder: ["name"],
      ...overrides,
    });
  }

  it("promotes editable cells to <EditableCell> when onCellCommit is provided", () => {
    seedEditableConfig();
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_editable"
        rows={[{ id: 1, name: "Alpha" }]}
        onCellCommit={vi.fn()}
      />,
    );
    expect(
      container.querySelector('[aria-label="Double-click or type to edit"]'),
    ).not.toBeNull();
  });

  it("does not wrap when onCellCommit is omitted (columns stay read-only)", () => {
    seedEditableConfig();
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_no_commit" rows={[{ id: 1, name: "Alpha" }]} />,
    );
    expect(
      container.querySelector('[aria-label="Double-click or type to edit"]'),
    ).toBeNull();
  });

  it("does not wrap when config.readOnly=1 even for editable columns", () => {
    seedEditableConfig({ readOnly: 1 });
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_readonly"
        rows={[{ id: 1, name: "Alpha" }]}
        onCellCommit={vi.fn()}
      />,
    );
    expect(
      container.querySelector('[aria-label="Double-click or type to edit"]'),
    ).toBeNull();
  });

  it("invokes onCellCommit with (rowId, columnId, nextValue) after Enter", async () => {
    const user = userEvent.setup();
    const onCellCommit = vi.fn().mockResolvedValue(undefined);
    seedEditableConfig();
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_commit"
        rows={[{ id: 42, name: "Alpha" }]}
        onCellCommit={onCellCommit}
      />,
    );
    const trigger = container.querySelector<HTMLElement>(
      '[aria-label="Double-click or type to edit"]',
    );
    expect(trigger).not.toBeNull();
    trigger!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const input = await screen.findByRole("textbox");
    await user.clear(input);
    await user.type(input, "Omega{Enter}");
    expect(onCellCommit).toHaveBeenCalledWith("42", "name", "Omega");
  });
});

// ─── 7. Row-Expansion Primitive (Phase 10 B2) ─────────────────────────────────
describe("DataGrid — Phase 10 B2 row-expansion primitive", () => {
  beforeEach(() => {
    activeConfig = null;
    vi.clearAllMocks();
    __clearRowAccentResolver();
  });

  it("does NOT prepend an expander column when renderSubRow is omitted", () => {
    seedConfig({ allowExpansion: true });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_no_render_sub" rows={CARDS} />,
    );
    expect(
      container.querySelector('button[aria-label="Expand row"]'),
    ).toBeNull();
  });

  it("does NOT prepend an expander column when allowExpansion is false", () => {
    seedConfig({ allowExpansion: false });
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_expansion_off"
        rows={CARDS}
        renderSubRow={() => <div>detail</div>}
      />,
    );
    expect(
      container.querySelector('button[aria-label="Expand row"]'),
    ).toBeNull();
  });

  it("renders an expander per row when allowExpansion + renderSubRow are provided", () => {
    seedConfig({ allowExpansion: true });
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_expansion_on"
        rows={CARDS}
        renderSubRow={() => <div>detail</div>}
      />,
    );
    const chevrons = container.querySelectorAll(
      'button[aria-label="Expand row"]',
    );
    expect(chevrons.length).toBe(3);
  });

  it("hides the expander chevron when renderSubRow returns null for that row", () => {
    seedConfig({ allowExpansion: true });
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_expansion_null"
        rows={CARDS}
        renderSubRow={(row) => (row.id === 10 ? <div>detail</div> : null)}
      />,
    );
    const chevrons = container.querySelectorAll(
      'button[aria-label="Expand row"]',
    );
    expect(chevrons.length).toBe(1);
  });

  it("expands the sub-row on chevron click and renders the detail payload", async () => {
    const user = userEvent.setup();
    seedConfig({ allowExpansion: true });
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_expansion_toggle"
        rows={[CARDS[0]]}
        renderSubRow={(row) => (
          <div data-testid="detail-payload">detail-for-{row.id}</div>
        )}
      />,
    );
    expect(screen.queryByTestId("detail-payload")).toBeNull();
    const chevron = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Expand row"]',
    );
    expect(chevron).not.toBeNull();
    await user.click(chevron!);
    expect(await screen.findByTestId("detail-payload")).toBeInTheDocument();
    expect(
      container.querySelector('button[aria-label="Collapse row"]'),
    ).not.toBeNull();
  });
});

// ─── 8. Bulk-Save Primitive (Phase 10 B3) ────────────────────────────────────
describe("DataGrid — Phase 10 B3 bulk-save primitive", () => {
  beforeEach(() => {
    activeConfig = null;
    vi.clearAllMocks();
    __clearRowAccentResolver();
  });

  function seedBulkEditableConfig() {
    return seedConfig({
      columns: {
        name: makeColumnSetting({
          column_id: "name",
          label_override: "Name",
          editable: true,
        }),
      },
      columnOrder: ["name"],
      rowKeyColumn: "id",
    });
  }

  it("does NOT show the Save button when the draft store is empty", () => {
    seedBulkEditableConfig();
    renderWithGridProviders(
      <DataGrid gridId="grid_bulk_empty" rows={CARDS} onBulkCommit={vi.fn()} />,
    );
    expect(
      screen.queryByRole("button", { name: /save unsaved edits/i }),
    ).toBeNull();
  });

  it("shows the Save/Discard bar as soon as bulkDirtyOverride flips true", () => {
    seedBulkEditableConfig();
    renderWithGridProviders(
      <DataGrid
        gridId="grid_bulk_override"
        rows={CARDS}
        onBulkCommit={vi.fn()}
        bulkDirtyOverride={true}
      />,
    );
    expect(
      screen.getByRole("button", { name: /save unsaved edits/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /discard unsaved edits/i }),
    ).toBeInTheDocument();
  });

  it("accumulates cell edits into the draft store and passes them to onBulkCommit on Save", async () => {
    const user = userEvent.setup();
    const onBulkCommit = vi.fn().mockResolvedValue(undefined);
    seedBulkEditableConfig();
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_bulk_commit"
        rows={[{ id: 7, name: "Alpha" }]}
        onBulkCommit={onBulkCommit}
      />,
    );
    const trigger = container.querySelector<HTMLElement>(
      '[aria-label="Double-click or type to edit"]',
    );
    expect(trigger).not.toBeNull();
    trigger!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const input = await screen.findByRole("textbox");
    await user.clear(input);
    await user.type(input, "Bravo{Enter}");

    expect(onBulkCommit).not.toHaveBeenCalled();
    const saveBtn = await screen.findByRole("button", {
      name: /save unsaved edits/i,
    });
    await user.click(saveBtn);
    expect(onBulkCommit).toHaveBeenCalledTimes(1);
    expect(onBulkCommit).toHaveBeenCalledWith({ "7": { name: "Bravo" } });
  });

  it("clears the draft store after onBulkCommit resolves", async () => {
    const user = userEvent.setup();
    seedBulkEditableConfig();
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_bulk_clear"
        rows={[{ id: 7, name: "Alpha" }]}
        onBulkCommit={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    const trigger = container.querySelector<HTMLElement>(
      '[aria-label="Double-click or type to edit"]',
    );
    trigger!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const input = await screen.findByRole("textbox");
    await user.clear(input);
    await user.type(input, "Bravo{Enter}");
    await user.click(
      await screen.findByRole("button", { name: /save unsaved edits/i }),
    );
    await vi.waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /save unsaved edits/i }),
      ).toBeNull();
    });
  });

  it("Discard clears drafts without calling onBulkCommit", async () => {
    const user = userEvent.setup();
    const onBulkCommit = vi.fn();
    seedBulkEditableConfig();
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_bulk_discard"
        rows={[{ id: 7, name: "Alpha" }]}
        onBulkCommit={onBulkCommit}
        confirmBulkDiscard={false}
      />,
    );
    const trigger = container.querySelector<HTMLElement>(
      '[aria-label="Double-click or type to edit"]',
    );
    trigger!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const input = await screen.findByRole("textbox");
    await user.clear(input);
    await user.type(input, "Bravo{Enter}");
    await user.click(
      await screen.findByRole("button", { name: /discard unsaved edits/i }),
    );
    expect(onBulkCommit).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /save unsaved edits/i }),
      ).toBeNull();
    });
  });
});

// ─── 9. Grid Style Tokens (Phase 3 §S9) ───────────────────────────────────────
describe("DataGrid — Phase 3 §S9 grid style tokens", () => {
  beforeEach(() => {
    activeConfig = null;
    vi.clearAllMocks();
    __clearRowAccentResolver();
  });

  it("applies tabular-nums to number cells when config.numeralStyle is 'tabular'", () => {
    seedConfig({
      columns: {
        score: makeColumnSetting({
          column_id: "score",
          cell_type: "number",
          format_string: ".3f",
        }),
      },
      columnOrder: ["score"],
      numeralStyle: "tabular",
    });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_numeral" rows={[{ id: 1, score: 0.987 }]} />,
    );
    expect(container.querySelector("tbody .tabular-nums")).not.toBeNull();
  });

  it("does not apply tabular-nums when config.numeralStyle is 'default'", () => {
    seedConfig({
      columns: {
        score: makeColumnSetting({
          column_id: "score",
          cell_type: "number",
          format_string: ".3f",
        }),
      },
      columnOrder: ["score"],
      numeralStyle: "default",
    });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_numeral_off" rows={[{ id: 1, score: 0.987 }]} />,
    );
    expect(container.querySelector("tbody .tabular-nums")).toBeNull();
  });

  it("does not flash any cell on initial mount even with liveUpdateHighlight on", () => {
    seedConfig({ liveUpdateHighlight: true });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_pulse_initial" rows={CARDS} />,
    );
    expect(container.querySelector(".animate-live-pulse")).toBeNull();
  });

  it("flashes the changed cell after a rows update when liveUpdateHighlight is on", async () => {
    seedConfig({ liveUpdateHighlight: true });
    const { container, rerender } = renderWithGridProviders(
      <DataGrid gridId="grid_pulse" rows={[{ id: 1, name: "A" }]} />,
    );
    expect(container.querySelector(".animate-live-pulse")).toBeNull();
    rerender(<DataGrid gridId="grid_pulse" rows={[{ id: 1, name: "B" }]} />);
    await vi.waitFor(() => {
      expect(container.querySelector(".animate-live-pulse")).not.toBeNull();
    });
  });

  it("does not flash a changed cell when liveUpdateHighlight is off", async () => {
    seedConfig({ liveUpdateHighlight: false });
    const { container, rerender } = renderWithGridProviders(
      <DataGrid gridId="grid_pulse_off" rows={[{ id: 1, name: "A" }]} />,
    );
    rerender(<DataGrid gridId="grid_pulse_off" rows={[{ id: 1, name: "B" }]} />);
    expect(container.querySelector(".animate-live-pulse")).toBeNull();
  });

  it("tints a row with accent border when rowAccentReactive is on and resolver matches", () => {
    registerRowAccentResolver(() => (row) => {
      if (row.category === "special") {
        return { borderLeftColor: "var(--primary)" };
      }
      return undefined;
    });
    seedConfig({ rowAccentReactive: true });
    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_accent_match"
        rows={[{ id: 1, name: "A", category: "special" }]}
      />,
    );
    const dataRow = container.querySelector("tbody tr");
    expect(dataRow?.className || "").toMatch(/border-l-/);
  });

  it("does not tint a row when rowAccentReactive is off", () => {
    registerRowAccentResolver(() => () => ({ borderLeftColor: "var(--primary)" }));
    seedConfig({ rowAccentReactive: false });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_accent_off" rows={[{ id: 1, name: "A" }]} />,
    );
    const dataRow = container.querySelector("tbody tr");
    expect(dataRow?.className || "").not.toMatch(/border-l-/);
  });

  it("does not tint a row when resolver returns undefined", () => {
    registerRowAccentResolver(() => () => undefined);
    seedConfig({ rowAccentReactive: true });
    const { container } = renderWithGridProviders(
      <DataGrid gridId="grid_accent_nomatch" rows={[{ id: 1, name: "A" }]} />,
    );
    const dataRow = container.querySelector("tbody tr");
    expect(dataRow?.className || "").not.toMatch(/border-l-/);
  });
});

// ─── 10. Density & Column Visibility ─────────────────────────────────────────
describe("DataGrid — Density & Visibility", () => {
  beforeEach(() => {
    activeConfig = null;
    vi.clearAllMocks();
    __clearRowAccentResolver();
  });

  it("respects columnVisibilityOverride to hide columns", () => {
    seedConfig({
      columns: {
        name: makeColumnSetting({ column_id: "name", label_override: "Name" }),
        category: makeColumnSetting({
          column_id: "category",
          label_override: "Category",
        }),
      },
      columnOrder: ["name", "category"],
    });

    const { container } = renderWithGridProviders(
      <DataGrid
        gridId="grid_vis"
        rows={[{ id: 1, name: "Card 1", category: "Base" }]}
        columnVisibilityOverride={{ category: false }}
      />,
    );

    const headers = Array.from(container.querySelectorAll("thead th")).map(
      (th) => th.textContent,
    );
    expect(headers).toContain("Name");
    expect(headers).not.toContain("Category");
  });
});
