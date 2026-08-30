/**
 * @file CommandPalette.test.tsx
 * @description Tests for CommandPalette component, verifying security filtering on routes.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import CommandPalette from "./CommandPalette";
import * as useAuthModule from "../hooks/useAuth";
import * as useModulesModule from "../hooks/useModules";
import * as useSecurityModule from "../hooks/useSecurity";
import * as commandRoutesModule from "../lib/commandRoutes";
import * as searchSourceRegistryModule from "./searchSourceRegistry";

vi.mock("../store/commandPaletteStore", () => ({
  useCommandPaletteStore: vi.fn((selector) => {
    const store = {
      open: true,
      setOpen: vi.fn(),
      toggle: vi.fn(),
      recentIds: [],
      pinnedIds: [],
      addRecent: vi.fn(),
      togglePinned: vi.fn(),
    };
    return selector(store);
  }),
}));

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.ResizeObserver = class ResizeObserver { observe() {} unobserve() {} disconnect() {} } as any;

    vi.spyOn(searchSourceRegistryModule, "getSearchSources").mockReturnValue([]);
    vi.spyOn(searchSourceRegistryModule, "getSearchAllTarget").mockReturnValue(undefined);
  });

  it("filters unauthorized command routes based on security capability", () => {
    vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
      user: { id: 1 },
      isAdmin: false,
      hasRole: () => false,
      login: vi.fn(),
      logout: vi.fn(),
      isLoading: false,
      isAuthenticated: true,
    } as any);

    vi.spyOn(useModulesModule, "useModules").mockReturnValue({
      hasModule: () => true,
    } as any);

    vi.spyOn(useSecurityModule, "useSecurity").mockReturnValue({
      can: (mod: string, action?: any) => {
        if (mod === "inventory" && action === "view") return true;
        return false;
      },
    } as any);

    vi.spyOn(commandRoutesModule, "getCommandRoutes").mockReturnValue([
      {
        id: "inventory-dashboard",
        to: "/inventory",
        label: "Inventory Dashboard",
        group: "Inventory",
        icon: () => <svg />,
        module: "inventory",
        action: "view",
      } as any,
      {
        id: "inventory-settings",
        to: "/inventory/settings",
        label: "Inventory Settings",
        group: "Inventory",
        icon: () => <svg />,
        module: "inventory",
        action: "update",
      } as any
    ]);

    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    );

    expect(screen.getByText("Inventory Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Inventory Settings")).not.toBeInTheDocument();
  });
});
