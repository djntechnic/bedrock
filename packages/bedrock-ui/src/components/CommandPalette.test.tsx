/**
 * @file CommandPalette.test.tsx
 * @description Tests for CommandPalette component, verifying security filtering on routes.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import CommandPalette from "./CommandPalette";
import * as useAuthModule from "../hooks/useAuth";
import * as useModulesModule from "../hooks/useModules";
import * as useSecurityModule from "../hooks/useSecurity";
import * as commandRoutesModule from "../lib/commandRoutes";
import * as searchSourceRegistryModule from "./searchSourceRegistry";
import { __clearNavItems, registerNavItems } from "./navRegistry";
import { useEditSessionStore } from "../store/editSessionStore";

const navigateMock = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

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
    navigateMock.mockReset();
    __clearNavItems();
    useEditSessionStore.setState({ sessions: {}, pendingLeave: null });
    vi.spyOn(useModulesModule, "useModules").mockReturnValue({
      hasModule: () => true,
    } as unknown as ReturnType<typeof useModulesModule.useModules>);
    vi.spyOn(useSecurityModule, "useSecurity").mockReturnValue({
      can: () => true,
    } as unknown as ReturnType<typeof useSecurityModule.useSecurity>);
    vi.spyOn(commandRoutesModule, "getCommandRoutes").mockReturnValue([]);
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

  it("sources navigation items from navRegistry without explicit command routes", () => {
    registerNavItems([
      { to: "/hub", label: "Hub", icon: () => <svg /> },
      {
        to: "/parent",
        label: "Parent",
        icon: () => <svg />,
        children: [{ to: "/parent/child", label: "Child Page" }],
        groups: [{ label: "Tools", items: [{ to: "/parent/tool", label: "Tool Page" }] }],
      },
    ]);

    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    );

    expect(screen.getByText("Hub")).toBeInTheDocument();
    expect(screen.getByText("Child Page")).toBeInTheDocument();
    expect(screen.getByText("Tool Page")).toBeInTheDocument();
  });

  it("does not duplicate a route registered in both navRegistry and command routes", () => {
    registerNavItems([{ to: "/hub", label: "Hub", icon: () => <svg /> }]);
    vi.spyOn(commandRoutesModule, "getCommandRoutes").mockReturnValue([
      { id: "hub-explicit", to: "/hub", label: "Hub Explicit", group: "G", icon: () => <svg /> },
    ]);

    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    );

    expect(screen.getByText("Hub")).toBeInTheDocument();
    expect(screen.queryByText("Hub Explicit")).not.toBeInTheDocument();
  });

  it("navigates immediately when no edit session is dirty", () => {
    registerNavItems([{ to: "/hub", label: "Hub", icon: () => <svg /> }]);

    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText("Hub"));

    expect(navigateMock).toHaveBeenCalledWith("/hub");
  });

  it("defers navigation through requestLeave when an edit session is dirty", () => {
    registerNavItems([{ to: "/hub", label: "Hub", icon: () => <svg /> }]);
    useEditSessionStore.getState().register("session-1", vi.fn());

    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText("Hub"));

    expect(useEditSessionStore.getState().pendingLeave).not.toBeNull();
    expect(navigateMock).not.toHaveBeenCalled();

    useEditSessionStore.getState().confirmLeave();
    expect(navigateMock).toHaveBeenCalledWith("/hub");
  });
});
