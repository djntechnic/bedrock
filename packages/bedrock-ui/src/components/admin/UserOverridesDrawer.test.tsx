/**
 * @file UserOverridesDrawer.test.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description Unit tests for UserOverridesDrawer component.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../api/client";
import { TooltipProvider } from "../ui/tooltip";
import UserOverridesDrawer from "./UserOverridesDrawer";

vi.mock("../../api/client", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

const mockUser = {
  user_id: 1,
  email: "curator@example.com",
  display_name: "Lead Curator",
  roles: ["viewer", "curator"],
  is_active: true,
  is_superuser: false,
};

const mockOverrides = [
  {
    override_id: 1,
    user_id: 1,
    module_id: 10,
    module_slug: "inventory",
    module_label: "Inventory",
    is_core: false,
    can_view: null,
    can_update: true,
    can_delete: false,
    can_execute: null,
  },
];

const mockProfile = {
  user_id: 1,
  email: "curator@example.com",
  is_superuser: false,
  roles: ["viewer", "curator"],
  capabilities: {
    inventory: {
      view: true,
      update: true,
      delete: false,
      execute: false,
    },
  },
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {ui}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe("UserOverridesDrawer", () => {
  beforeEach(() => {
    vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true } });
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/overrides")) {
        return Promise.resolve({ data: mockOverrides });
      }
      if (url.includes("/profile")) {
        return Promise.resolve({ data: mockProfile });
      }
      return Promise.resolve({ data: [] });
    });
  });

  it("renders user information and override modules in sheet", async () => {
    renderWithClient(
      <UserOverridesDrawer
        user={mockUser}
        open={true}
        onOpenChange={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("curator@example.com")).toBeDefined();
      expect(screen.getByText("Inventory")).toBeDefined();
    });

    expect(screen.getByText("Granular Overrides")).toBeDefined();
    expect(screen.getByText("Compiled Profile")).toBeDefined();
  });

  it("triggers update when clicking a tri-state button", async () => {
    renderWithClient(
      <UserOverridesDrawer
        user={mockUser}
        open={true}
        onOpenChange={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Inventory")).toBeDefined();
    });

    const grantButtons = screen.getAllByTitle(/Force grant capability/i);
    expect(grantButtons.length).toBeGreaterThan(0);

    fireEvent.click(grantButtons[0]);

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        "/api/v1/security/users/1/overrides",
        expect.objectContaining({
          overrides: expect.arrayContaining([
            expect.objectContaining({
              module_id: 10,
            }),
          ]),
        })
      );
    });
  });
});
