import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GridColumnSetting, GridSetting } from "../../hooks/useAdminPlatform";
import { buildGridConfig } from "../../hooks/useGridConfig";
import {
  registerKpiGradientPolicy,
  __clearKpiGradientPolicies,
} from "./kpiGradientRegistry";
import DataGrid from "./DataGrid";

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));
vi.mock("../../hooks/useAdminPlatform", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/useAdminPlatform")>()),
  useAdmin: () => ({ logExport: vi.fn() }),
}));

let mockConfigColumns: Record<string, GridColumnSetting> = {};

const dummyGridSetting: GridSetting = {
  grid_setting_id: 1,
  grid_id: "kpi_test_grid",
  grid_label: "KPI Test",
  allow_column_toggle: true,
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

vi.mock("../../hooks/useTableState", () => ({
  useTableState: () => {
    const config = buildGridConfig("kpi_test_grid", dummyGridSetting, Object.values(mockConfigColumns), true);
    return {
      config: {
        ...config,
        columns: mockConfigColumns,
        rowKeyColumn: "id",
      },
      sorting: [],
      setSorting: vi.fn(),
      columnVisibility: {},
      setColumnVisibility: vi.fn(),
      cellPad: "px-3 py-2",
      headerClassName: "",
      bodyClassName: "",
      rowClassName: "",
      isLoaded: true,
      pinnedFilters: null,
      columnOrder: ["metric_a", "metric_b"],
      persistFilters: () => {},
      persistColumnOrder: () => {},
      dashboardPin: false,
      setDashboardPin: () => {},
    };
  },
}));

describe("DataGrid Automated Directional KPI Gradients (#67)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __clearKpiGradientPolicies();
  });

  it("applies automated directional KPI gradient based on registered policy when enable_kpi_gradient is true", () => {
    // Policy: metric_a has lowerBetter: false (higher is better -> high is positive, low is negative)
    //         metric_b has lowerBetter: true (lower is better -> low is positive, high is negative)
    registerKpiGradientPolicy((colId: string) => {
      if (colId === "metric_a") return { lowerBetter: false };
      if (colId === "metric_b") return { lowerBetter: true };
      return null;
    });

    mockConfigColumns = {
      metric_a: {
        grid_setting_id: 1,
        column_id: "metric_a",
        label_override: "Metric A",
        cell_type: "number",
        default_visible: true,
        column_order: 1,
        null_display: "—",
        allow_sort: true,
        allow_filter: true,
        read_only: false,
        min_width: 60,
        text_align: "right",
        wrap_text: false,
        resizable: true,
        group_by: false,
        enable_kpi_gradient: true,
      },
      metric_b: {
        grid_setting_id: 1,
        column_id: "metric_b",
        label_override: "Metric B",
        cell_type: "number",
        default_visible: true,
        column_order: 2,
        null_display: "—",
        allow_sort: true,
        allow_filter: true,
        read_only: false,
        min_width: 60,
        text_align: "right",
        wrap_text: false,
        resizable: true,
        group_by: false,
        enable_kpi_gradient: true,
      },
    };

    const rows = [
      { id: 1, metric_a: 10, metric_b: 10 },
      { id: 2, metric_a: 100, metric_b: 100 },
    ];

    const { container } = render(
      <DataGrid
        gridId="kpi_test_grid"
        rows={rows}
      />,
    );

    // Check cells rendered in table
    const cells = container.querySelectorAll("td");
    expect(cells.length).toBeGreaterThan(0);

    // Finding style background-color for metric_a and metric_b (either on the td or child span)
    const styledElements = container.querySelectorAll("[style*='background']");
    expect(styledElements.length).toBe(4);
  });
});
