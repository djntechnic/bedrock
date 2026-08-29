import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../api/client";
import RoleMatrixPanel from "./RoleMatrixPanel";

vi.mock("../../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockRoles = [
  {
    role_id: 1,
    slug: "viewer",
    label: "Viewer",
    description: "Read-only viewer",
    user_count: 5,
    created_at: "2026-01-01",
    created_by: "System",
    modified_at: "2026-01-01",
    modified_by: "System",
  },
  {
    role_id: 2,
    slug: "admin",
    label: "Administrator",
    description: "Admin",
    user_count: 1,
    created_at: "2026-01-01",
    created_by: "System",
    modified_at: "2026-01-01",
    modified_by: "System",
  },
];

const mockMatrix = [
  {
    role_id: 1,
    role_slug: "viewer",
    role_label: "Viewer",
    module_id: 10,
    module_slug: "inventory",
    module_label: "Inventory",
    is_core: 0,
    can_view: true,
    can_update: false,
    can_delete: false,
    can_execute: false,
  },
  {
    role_id: 2,
    role_slug: "admin",
    role_label: "Administrator",
    module_id: 10,
    module_slug: "inventory",
    module_label: "Inventory",
    is_core: 0,
    can_view: true,
    can_update: true,
    can_delete: true,
    can_execute: true,
  },
];

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("RoleMatrixPanel", () => {
  beforeEach(() => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/roles")) {
        return Promise.resolve({ data: mockRoles });
      }
      if (url.includes("/matrix")) {
        return Promise.resolve({ data: mockMatrix });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it("renders role columns, module rows, and active role badges", async () => {
    renderWithClient(<RoleMatrixPanel />);

    await waitFor(() => {
      expect(screen.getByText("Security & Permissions Matrix")).toBeDefined();
      expect(screen.getByText("Inventory")).toBeDefined();
    });

    expect(screen.getByText("Active Roles:")).toBeDefined();
    expect(screen.getByText("5 users")).toBeDefined();
  });

  it("locks Administrator switches to disabled while allowing viewer edits", async () => {
    renderWithClient(<RoleMatrixPanel />);

    await waitFor(() => {
      expect(screen.getByText("Inventory")).toBeDefined();
    });

    const adminViewSwitch = screen.getByLabelText("admin view inventory") as HTMLButtonElement;
    expect(adminViewSwitch.disabled).toBe(true);

    const viewerUpdSwitch = screen.getByLabelText("viewer update inventory") as HTMLButtonElement;
    expect(viewerUpdSwitch.disabled).toBe(false);
  });

  it("auto-saves immediately when a permission toggle is flipped", async () => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });
    renderWithClient(<RoleMatrixPanel />);

    await waitFor(() => {
      expect(screen.getByText("Inventory")).toBeDefined();
    });

    const viewerUpdSwitch = screen.getByLabelText("viewer update inventory") as HTMLButtonElement;
    fireEvent.click(viewerUpdSwitch);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        "/api/v1/security/matrix",
        expect.objectContaining({
          updates: expect.arrayContaining([
            expect.objectContaining({
              role_id: 1,
              module_id: 10,
              can_update: true,
            }),
          ]),
        })
      );
    });
  });
});
