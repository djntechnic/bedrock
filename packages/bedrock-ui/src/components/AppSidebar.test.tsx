/**
 * @file AppSidebar.test.tsx
 * @description Tests for AppSidebar component, verifying security filtering on children.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AppSidebar from "./AppSidebar";
import * as useAuthModule from "../hooks/useAuth";
import * as useModulesModule from "../hooks/useModules";
import * as useSecurityModule from "../hooks/useSecurity";
import { __clearNavItems, getNavItems, registerNavItems } from "./navRegistry";

// Mock zustand stores
vi.mock("../store/sidebarStore", () => ({
  useSidebarStore: vi.fn((selector) => {
    const store = {
      pinned: true,
      hovered: false,
      mobileOpen: false,
      togglePinned: vi.fn(),
      setHovered: vi.fn(),
      setMobileOpen: vi.fn(),
    };
    return selector(store);
  }),
}));

vi.mock("../store/commandPaletteStore", () => ({
  useCommandPaletteStore: vi.fn(),
}));

vi.mock("../hooks/useAppSettings", () => ({
  useAppSettings: () => ({ system: { appName: "Test App" } })
}));

vi.mock("../hooks/useMediaQuery", () => ({
  useMediaQuery: () => false
}));

vi.mock("../hooks/useNavSettings", () => ({
  useNavSettings: () => ({
    navItems: getNavItems(),
    settings: [],
    isLoading: false,
  }),
}));

describe("AppSidebar", () => {
  beforeEach(() => {
    __clearNavItems();
    vi.restoreAllMocks();
  });

  it("filters unauthorized child items based on security capability", () => {
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
        if (mod === "inventory" && action === "view") return true; // Parent allowed
        if (mod === "inventory" && action === "update") return false; // Child restricted
        return false;
      },
    } as any);

    registerNavItems([
      {
        to: "/inventory",
        label: "Inventory",
        icon: () => <svg />,
        module: "inventory",
        action: "view",
        exact: false,
        children: [
          {
            to: "/inventory/allowed",
            label: "Allowed Child",
            module: "inventory",
            action: "view",
          },
          {
            to: "/inventory/restricted",
            label: "Restricted Child",
            module: "inventory",
            action: "update",
          }
        ]
      }
    ]);

    render(
      <MemoryRouter initialEntries={["/inventory"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    // Parent should be visible
    expect(screen.getByText("Inventory")).toBeInTheDocument();
    
    // Allowed child should be visible
    expect(screen.getByText("Allowed Child")).toBeInTheDocument();
    
    // Restricted child should NOT be visible
    expect(screen.queryByText("Restricted Child")).not.toBeInTheDocument();
  });

  it("hides parent if all children are unauthorized and parent has no standalone view", () => {
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
      can: () => false, // All capabilities denied
    } as any);

    registerNavItems([
      {
        to: "/settings",
        label: "Settings",
        icon: () => <svg />,
        exact: false, // Not a standalone view
        children: [
          {
            to: "/settings/users",
            label: "Users",
            module: "admin",
            action: "view",
          }
        ]
      }
    ]);

    render(
      <MemoryRouter>
        <AppSidebar />
      </MemoryRouter>
    );

    // The entire parent should be hidden
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  });

  it("renders sub-items sharing the parent route properly when expanded", () => {
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
      can: () => true,
    } as any);

    registerNavItems([
      {
        to: "/collection",
        label: "Collection",
        icon: () => <svg />,
        children: [
          {
            to: "/collection",
            label: "My Collection",
          },
          {
            to: "/collection/sets",
            label: "My Sets",
          },
        ],
      },
    ]);

    render(
      <MemoryRouter initialEntries={["/collection"]}>
        <AppSidebar />
      </MemoryRouter>
    );

    // Parent should be visible
    expect(screen.getByText("Collection")).toBeInTheDocument();

    // Both sub-items should be rendered in the sidebar
    expect(screen.getByText("My Collection")).toBeInTheDocument();
    expect(screen.getByText("My Sets")).toBeInTheDocument();

    // The sub-item sharing the parent route should have href="/collection"
    const myCollectionLink = screen.getByRole("link", { name: "My Collection" });
    expect(myCollectionLink).toHaveAttribute("href", "/collection");
  });
});
