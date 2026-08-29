import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../api/client";
import ModulesPanel from "./ModulesPanel";

vi.mock("../../api/client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockModules = [
  {
    module_id: 1,
    slug: "admin",
    label: "Admin Hub",
    description: "System administration and configuration",
    is_core: true,
    sort_order: 10,
  },
  {
    module_id: 2,
    slug: "inventory",
    label: "Inventory",
    description: "Manage product inventory and stock levels",
    is_core: false,
    sort_order: 20,
  },
  {
    module_id: 3,
    slug: "analytics",
    label: "Analytics",
    description: "Reporting and analytics extension",
    is_core: false,
    sort_order: 30,
  }
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("ModulesPanel", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/modules")) {
        return Promise.resolve({ data: mockModules });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it("renders module listing with correct badges", async () => {
    renderWithClient(<ModulesPanel />);

    await waitFor(() => {
      expect(screen.getByText("Admin Hub")).toBeDefined();
    });

    expect(screen.getByText("System administration and configuration")).toBeDefined();
    expect(screen.getByText("System Core")).toBeDefined();

    expect(screen.getByText("Inventory")).toBeDefined();
    const badges = screen.getAllByText("Custom Extension");
    expect(badges.length).toBe(2);
  });

  it("filters modules by search term", async () => {
    renderWithClient(<ModulesPanel />);

    await waitFor(() => {
      expect(screen.getByText("Admin Hub")).toBeDefined();
      expect(screen.getByText("Inventory")).toBeDefined();
      expect(screen.getByText("Analytics")).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText("Search modules...");
    fireEvent.change(searchInput, { target: { value: "Inventory" } });

    await waitFor(() => {
      expect(screen.getByText("Inventory")).toBeDefined();
      expect(screen.queryByText("Admin Hub")).toBeNull();
      expect(screen.queryByText("Analytics")).toBeNull();
    });
  });

  it("handles loading and error states", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("Failed to fetch"));

    renderWithClient(<ModulesPanel />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load modules.")).toBeDefined();
    });
  });
});
