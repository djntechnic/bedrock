/**
 * @file DataGrid.test.tsx
 * @description The `gridRef` handle (#35): the sorted row order, pulled.
 *
 * The whole point of the handle is that it answers from the *model*, not the
 * DOM — so every assertion here is written against a case where the two
 * disagree, or would if the implementation were reading the document.
 *
 * `useTableState` is mocked rather than stubbed at the query layer: it is the
 * single hook `<DataGrid>` takes its config and sort state from, so replacing
 * it with a real `useState` pair gives the grid genuine sorting behaviour
 * without a server, a router-served config, or a `QueryClientProvider`.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { describe, expect, it, vi } from "vitest";

import type { GridColumnSetting, GridSetting } from "../../hooks/useAdminPlatform";
import { buildGridConfig } from "../../hooks/useGridConfig";

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
vi.mock("../../hooks/useAdminPlatform", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useAdminPlatform")>()),
  useAdmin: () => ({ logExport: vi.fn() }),
}));
vi.mock("../../hooks/useTableState", () => ({
  useTableState: (gridId: string) => {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnVisibility, setColumnVisibility] = useState({});
    return {
      config: testConfig(gridId),
      sorting,
      setSorting,
      columnVisibility,
      setColumnVisibility,
      cellPad: "px-3 py-2",
      headerClassName: "",
      bodyClassName: "",
      rowClassName: "",
      isLoaded: true,
      pinnedFilters: null,
      columnOrder: ["name"],
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
    // Without this `<DataGrid>` throws — and it is what makes the handle's
    // keys the domain's ids rather than array positions.
    row_key_column: "id",
  };
}

function testConfig(gridId: string) {
  return buildGridConfig(gridId, gridSetting(gridId), [nameColumn()], true);
}

/**
 * What a host reading the document sees. Kept deliberately: several assertions
 * below are about the handle *disagreeing* with this.
 */
function domRowKeys(): string[] {
  const keys = Array.from(
    document.querySelectorAll<HTMLElement>("[data-row-key]"),
  ).map((el) => el.dataset.rowKey ?? "");
  return Array.from(new Set(keys));
}

/** Captures the handle with a callback ref — the shape a `ref` also accepts. */
function renderGrid(props: Record<string, unknown> = {}) {
  const box: { handle: DataGridHandle | null } = { handle: null };
  render(
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

describe("gridRef", () => {
  it("hands over the model's row order, keyed by rowKeyColumn", () => {
    const box = renderGrid();
    expect(box.handle?.getSortedRowKeys()).toEqual(["10", "20", "30"]);
  });

  it("re-reflects the order after the user sorts", async () => {
    const user = userEvent.setup();
    const box = renderGrid();

    await user.click(screen.getByText("Name"));

    // Alice, Bravo, Charlie — nothing about the rows array changed.
    expect(box.handle?.getSortedRowKeys()).toEqual(["20", "30", "10"]);
  });

  it("answers with no cell selection enabled", () => {
    // The cursorless paste dialog is exactly this caller: it has no cell
    // cursor, so it never receives a `CellRangePaste` and its `rowKeys`.
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
    const box = renderGrid({ rows: many, isEmbedded: false, variant: "virtualized" });

    const keys = box.handle?.getSortedRowKeys() ?? [];
    expect(keys).toHaveLength(300);
    expect(keys[0]).toBe("1");
    expect(keys[299]).toBe("300");
    // The claim that motivates the whole issue: a host reading `[data-row-key]`
    // out of the document sees only the mounted window.
    expect(domRowKeys().length).toBeLessThan(300);
  });

  it("is optional — the grid renders without one", () => {
    render(<DataGrid<Card> gridId="cards" rows={CARDS} isEmbedded />);
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });
});
