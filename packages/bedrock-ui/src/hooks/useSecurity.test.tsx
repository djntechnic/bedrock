/**
 * @file useSecurity.test.tsx
 * @description Unit tests for useSecurity hook, <Can> component, and <PermissionButton>.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { apiClient } from "../api/client";
import { useSecurity, Can, PermissionButton } from "./useSecurity";

// Mock useAuth
vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: { id: 1, email: "test@example.com" },
    token: "fake-token",
    isAdmin: false,
    hasRole: () => true,
    isLoading: false,
  }),
}));

// Mock apiClient
vi.mock("../api/client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockPermissions = {
  inventory: { view: true, update: true, delete: false, execute: true },
  admin: { view: false, update: false, delete: false, execute: false },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("useSecurity hook", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockPermissions });
  });

  it("resolves capabilities correctly", async () => {
    const { result } = renderHook(() => useSecurity(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.can("inventory", "view")).toBe(true);
    expect(result.current.can("inventory", "update")).toBe(true);
    expect(result.current.can("inventory", "delete")).toBe(false);
    expect(result.current.can("admin", "view")).toBe(false);
  });
});

describe("<Can>", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockPermissions });
  });

  it("renders children when permission is granted", async () => {
    render(
      <Can module="inventory" action="update" fallback={<div>Access Denied</div>}>
        <div data-testid="secret-content">Secret Content</div>
      </Can>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByTestId("secret-content")).toBeDefined();
    });
    expect(screen.queryByText("Access Denied")).toBeNull();
  });

  it("renders fallback when permission is denied", async () => {
    render(
      <Can module="admin" action="view" fallback={<div>Access Denied</div>}>
        <div data-testid="secret-content">Secret Content</div>
      </Can>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText("Access Denied")).toBeDefined();
    });
    expect(screen.queryByTestId("secret-content")).toBeNull();
  });
});

describe("<PermissionButton>", () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockPermissions });
  });

  it("is enabled when user has permission", async () => {
    render(
      <PermissionButton module="inventory" action="update">
        Save Inventory
      </PermissionButton>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Save Inventory" }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
  });

  it("is disabled with tooltip when user lacks permission", async () => {
    render(
      <PermissionButton
        module="inventory"
        action="delete"
        tooltipWhenDisabled="You do not have permission to delete items"
      >
        Delete Item
      </PermissionButton>,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: "Delete Item" }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.title).toBe("You do not have permission to delete items");
    });
  });
});
