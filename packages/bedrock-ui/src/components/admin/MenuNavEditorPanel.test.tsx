import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { __clearNavItems, registerNavItems } from "../navRegistry";
import MenuNavEditorPanel from "./MenuNavEditorPanel";
import * as useNavSettingsModule from "../../hooks/useNavSettings";

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

describe("MenuNavEditorPanel", () => {
  const mockUpdateSettings = vi.fn().mockResolvedValue([]);
  const mockResetSettings = vi.fn().mockResolvedValue([]);
  const mockDeleteSetting = vi.fn().mockResolvedValue([]);

  beforeEach(() => {
    __clearNavItems();
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    registerNavItems([
      {
        to: "/collection",
        label: "Collection",
        icon: () => null,
        children: [
          { to: "/collection", label: "My Collection" },
          { to: "/collection/sets", label: "Card Sets" },
        ],
      },
    ]);
  });

  it("does not let child items inherit parent overrides when child shares parent route", async () => {
    // Parent `/collection` has an override in DB, child has NO override
    const parentSetting: useNavSettingsModule.NavItemSetting = {
      nav_key: "/collection",
      parent_key: null,
      sort_order: 10,
      label_override: "Vault",
      icon_override: null,
      tooltip_override: null,
      is_hidden_override: false,
    };

    vi.spyOn(useNavSettingsModule, "useNavSettingsManager").mockReturnValue({
      settings: [parentSetting],
      isLoading: false,
      refetch: vi.fn(),
      updateSettings: mockUpdateSettings,
      isUpdating: false,
      resetSettings: mockResetSettings,
      isResetting: false,
      deleteSetting: mockDeleteSetting,
      isDeleting: false,
    });

    render(<MenuNavEditorPanel />, { wrapper: createWrapper() });

    // The parent row should show the override "Vault"
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const parentInput = inputs.find((inp) => inp.value === "Vault");
    expect(parentInput).toBeDefined();

    // The child row should have placeholder or value "My Collection", NOT "Vault"
    const childInput = inputs.find((inp) => inp.placeholder === "My Collection");
    expect(childInput).toBeDefined();
    expect(childInput?.value).toBe(""); // Not overridden by parent's "Vault"

    // The child row should NOT have a Reset button active
    // Only the parent row should have a Reset button
    const resetButtons = screen.getAllByTitle("Reset Overrides");
    expect(resetButtons).toHaveLength(1);
  });

  it("resets only the child setting when child has an override and delete is clicked", async () => {
    const parentSetting: useNavSettingsModule.NavItemSetting = {
      nav_key: "/collection",
      parent_key: null,
      sort_order: 10,
      label_override: "Vault",
      icon_override: null,
      tooltip_override: null,
      is_hidden_override: false,
    };

    const childSetting: useNavSettingsModule.NavItemSetting = {
      nav_key: "/collection::/collection",
      parent_key: "/collection",
      sort_order: 20,
      label_override: "Personal Vault",
      icon_override: null,
      tooltip_override: null,
      is_hidden_override: false,
    };

    vi.spyOn(useNavSettingsModule, "useNavSettingsManager").mockReturnValue({
      settings: [parentSetting, childSetting],
      isLoading: false,
      refetch: vi.fn(),
      updateSettings: mockUpdateSettings,
      isUpdating: false,
      resetSettings: mockResetSettings,
      isResetting: false,
      deleteSetting: mockDeleteSetting,
      isDeleting: false,
    });

    render(<MenuNavEditorPanel />, { wrapper: createWrapper() });

    // Both rows now have reset buttons
    const resetButtons = screen.getAllByTitle("Reset Overrides");
    expect(resetButtons).toHaveLength(2);

    // Click reset on the child row (the second reset button)
    fireEvent.click(resetButtons[1]);

    await waitFor(() => {
      expect(mockDeleteSetting).toHaveBeenCalledWith("/collection::/collection");
      // Must NOT have called deleteSetting with the parent's key
      expect(mockDeleteSetting).not.toHaveBeenCalledWith("/collection");
    });
  });

  it("clusters sub-items hierarchically under their resolved parent item instead of flat sort_order", async () => {
    // Register two root items: Dashboard (/) and Catalog (/catalog)
    __clearNavItems();
    registerNavItems([
      {
        to: "/",
        label: "Dashboard",
        icon: () => null,
      },
      {
        to: "/catalog",
        label: "Catalog",
        icon: () => null,
        children: [
          { to: "/catalog/cards", label: "Cards" },
          { to: "/catalog/sets", label: "Sets" },
        ],
      },
    ]);

    // Dashboard has sort_order 10.
    // Catalog has sort_order 40.
    // Cards has sort_order 20 (parent: /catalog).
    // Sets has sort_order 30 (parent: /catalog).
    // If flat sorted by sort_order: Dashboard (10) -> Cards (20) -> Sets (30) -> Catalog (40)
    // In hierarchical clustering: Dashboard (10) -> Catalog (40) -> Cards (20) -> Sets (30)
    const settings: useNavSettingsModule.NavItemSetting[] = [
      {
        nav_key: "/",
        parent_key: null,
        sort_order: 10,
        label_override: null,
        icon_override: null,
        tooltip_override: null,
        is_hidden_override: false,
      },
      {
        nav_key: "/catalog",
        parent_key: null,
        sort_order: 40,
        label_override: null,
        icon_override: null,
        tooltip_override: null,
        is_hidden_override: false,
      },
      {
        nav_key: "/catalog::/catalog/cards",
        parent_key: "/catalog",
        sort_order: 20,
        label_override: null,
        icon_override: null,
        tooltip_override: null,
        is_hidden_override: false,
      },
      {
        nav_key: "/catalog::/catalog/sets",
        parent_key: "/catalog",
        sort_order: 30,
        label_override: null,
        icon_override: null,
        tooltip_override: null,
        is_hidden_override: false,
      },
    ];

    vi.spyOn(useNavSettingsModule, "useNavSettingsManager").mockReturnValue({
      settings,
      isLoading: false,
      refetch: vi.fn(),
      updateSettings: mockUpdateSettings,
      isUpdating: false,
      resetSettings: mockResetSettings,
      isResetting: false,
      deleteSetting: mockDeleteSetting,
      isDeleting: false,
    });

    render(<MenuNavEditorPanel />, { wrapper: createWrapper() });

    // Look at the table rows in the rendered table
    const rows = screen.getAllByRole("row");
    // Row 0 is header row. Rows 1..4 are data rows.
    // We expect Dashboard first, then Catalog, then Cards, then Sets.
    const rowLabels = rows.slice(1).map((row) => {
      return row.textContent;
    });

    expect(rowLabels[0]).toContain("Dashboard");
    expect(rowLabels[1]).toContain("Catalog");
    expect(rowLabels[2]).toContain("Cards");
    expect(rowLabels[3]).toContain("Sets");
  });

  it("disambiguates reset vs delete actions and prompts", async () => {
    // 1 core item with override
    // 1 custom item
    // 1 spacer
    const settings: useNavSettingsModule.NavItemSetting[] = [
      {
        nav_key: "/collection",
        parent_key: null,
        sort_order: 10,
        label_override: "Vault",
        icon_override: null,
        tooltip_override: null,
        is_hidden_override: false,
      },
      {
        nav_key: "/custom-link",
        parent_key: null,
        sort_order: 20,
        label_override: "Custom Link",
        icon_override: null,
        tooltip_override: null,
        is_hidden_override: false,
      },
      {
        nav_key: "spacer:main:analytics",
        parent_key: null,
        sort_order: 30,
        label_override: "Analytics Section",
        icon_override: null,
        tooltip_override: null,
        is_hidden_override: false,
      },
    ];

    vi.spyOn(useNavSettingsModule, "useNavSettingsManager").mockReturnValue({
      settings,
      isLoading: false,
      refetch: vi.fn(),
      updateSettings: mockUpdateSettings,
      isUpdating: false,
      resetSettings: mockResetSettings,
      isResetting: false,
      deleteSetting: mockDeleteSetting,
      isDeleting: false,
    });

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<MenuNavEditorPanel />, { wrapper: createWrapper() });

    // Core item should have Reset button ("Reset Overrides"), not Trash2
    const resetButtons = screen.getAllByTitle("Reset Overrides");
    expect(resetButtons).toHaveLength(1);

    // Custom link and spacer should have Delete button ("Delete Item")
    const deleteButtons = screen.getAllByTitle("Delete Item");
    expect(deleteButtons).toHaveLength(2);

    // Click reset on core item
    fireEvent.click(resetButtons[0]);
    expect(confirmSpy).toHaveBeenCalledWith("Reset overrides for 'Vault' to code defaults?");
    expect(mockDeleteSetting).toHaveBeenCalledWith("/collection");

    // Click delete on custom link
    fireEvent.click(deleteButtons[0]);
    expect(confirmSpy).toHaveBeenCalledWith("Delete custom item 'Custom Link'?");
    expect(mockDeleteSetting).toHaveBeenCalledWith("/custom-link");
  });
});

