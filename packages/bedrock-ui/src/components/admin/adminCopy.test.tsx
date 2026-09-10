import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GridColumnsPanel from "./gridEditor/GridColumnsPanel";
import GridSettingsPanel from "./gridEditor/GridSettingsPanel";
import MenuNavEditorPanel from "./MenuNavEditorPanel";
import * as useNavSettingsModule from "../../hooks/useNavSettings";
import * as useAuthModule from "../../hooks/useAuth";
import { __clearNavItems, registerNavItems } from "../navRegistry";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("Admin UI Copy Standards Check", () => {
  beforeEach(() => {
    __clearNavItems();
    vi.clearAllMocks();

    registerNavItems([
      {
        to: "/dashboard",
        label: "Dashboard",
        icon: () => null,
      },
    ]);

    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      user: { id: "test-user", username: "tester", role: "admin", is_active: true } as any,
      token: "mock-token",
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
      isLoading: false,
    });

    vi.spyOn(useNavSettingsModule, "useNavSettingsManager").mockReturnValue({
      settings: [],
      isLoading: false,
      refetch: vi.fn(),
      updateSettings: vi.fn(),
      isUpdating: false,
      resetSettings: vi.fn(),
      isResetting: false,
      deleteSetting: vi.fn(),
      isDeleting: false,
    });
  });

  it("ensures GridSettingsPanel contains zero developer standards references in rendered copy", () => {
    const mockGrid = {
      grid_setting_id: 1,
      grid_id: "test_grid",
      pagination_enabled: 1,
      default_page_size: 25,
      page_size_options: "25,50,100",
      sticky_header: 1,
      sticky_first_column: 0,
      allow_column_reorder: 1,
      allow_expansion: 0,
      row_striping: 1,
      dense_mode: 0,
      wrap_text: 0,
      min_column_width: 80,
      default_sort_column: null,
      default_sort_direction: null,
      allow_column_toggle: 1,
      allow_export: 1,
      allow_print: 0,
      show_row_count: 1,
      show_ranking: 0,
      show_rank_highlight: 0,
      allow_selection: 0,
      selection_position: "end" as const,
      show_search: 1,
      show_density_toggle: 1,
      tooltip_delay_duration: null,
      sort_asc_color: null,
      sort_desc_color: null,
      hover_color: null,
      numeral_style: "default" as const,
      live_update_highlight: 0,
      row_accent_reactive: 0,
      page: null,
      title: null,
      sub_header: null,
      footer: null,
      caption: null,
      row_key_column: null,
    };

    const { container } = render(
      <GridSettingsPanel
        draftGrid={mockGrid}
        columnIds={["id", "name"]}
        setGridField={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const textContent = container.textContent || "";
    const innerHTML = container.innerHTML || "";

    // Check for developer standard codes like §S1, §S2, §S9, Standard 9, etc.
    expect(textContent).not.toMatch(/§S\d+/i);
    expect(textContent).not.toMatch(/Standard\s+9/i);
    expect(innerHTML).not.toMatch(/§S\d+/i);
    expect(innerHTML).not.toMatch(/Standard\s+9/i);
  });

  it("ensures GridColumnsPanel contains zero developer standards references in rendered copy", () => {
    const mockColumns = [
      {
        grid_setting_id: 1,
        column_id: "test_col",
        label_override: null,
        tooltip_override: null,
        column_order: 10,
        default_visible: 1,
        allow_sort: true,
        allow_sort_mode: "both" as const,
        default_sort: null,
        read_only: 0,
        text_align: "left" as const,
        width: 100,
        min_width: 60,
        max_width: 200,
        cell_type: "text",
        format_string: null,
        null_display: null,
        aggregate_function: null,
        link_target: null,
        sort_asc_color: null,
        sort_desc_color: null,
        gradient_from_color: null,
        gradient_to_color: null,
        conditional_format: null,
        pinned: null,
        allow_filter: 0,
        default_filter: null,
        resizable: 1,
        group_by: 0,
        wrap_text: 0,
        editable: 0,
      },
    ];

    const { container } = render(
      <GridColumnsPanel
        draftColumns={mockColumns}
        setColumnField={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const textContent = container.textContent || "";
    const innerHTML = container.innerHTML || "";

    expect(textContent).not.toMatch(/§S\d+/i);
    expect(textContent).not.toMatch(/Standard\s+9/i);
    expect(innerHTML).not.toMatch(/§S\d+/i);
    expect(innerHTML).not.toMatch(/Standard\s+9/i);
  });

  it("ensures MenuNavEditorPanel contains zero developer standards references in rendered copy", () => {
    const { container } = render(<MenuNavEditorPanel />, {
      wrapper: createWrapper(),
    });

    const textContent = container.textContent || "";
    const innerHTML = container.innerHTML || "";

    expect(textContent).not.toMatch(/§S\d+/i);
    expect(textContent).not.toMatch(/Standard\s+9/i);
    expect(innerHTML).not.toMatch(/§S\d+/i);
    expect(innerHTML).not.toMatch(/Standard\s+9/i);
  });
});
