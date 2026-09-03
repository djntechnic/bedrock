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
    const resetButtons = screen.getAllByTitle("Reset item overrides to code default");
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
    const resetButtons = screen.getAllByTitle("Reset item overrides to code default");
    expect(resetButtons).toHaveLength(2);

    // Click reset on the child row (the second reset button)
    fireEvent.click(resetButtons[1]);

    await waitFor(() => {
      expect(mockDeleteSetting).toHaveBeenCalledWith("/collection::/collection");
      // Must NOT have called deleteSetting with the parent's key
      expect(mockDeleteSetting).not.toHaveBeenCalledWith("/collection");
    });
  });
});
