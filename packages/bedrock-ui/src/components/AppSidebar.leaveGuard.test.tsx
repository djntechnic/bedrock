import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { TooltipProvider } from "./ui/tooltip";
import AppSidebar from "./AppSidebar";
import { useEditSessionStore } from "../store/editSessionStore";
import type { NavItem } from "./navRegistry";

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: () => null, exact: true },
  { to: "/reports", label: "Reports", icon: () => null },
];

vi.mock("../hooks/useNavSettings", () => ({
  useNavSettings: () => ({ navItems: NAV, isLoading: false }),
}));

vi.mock("../store/sidebarStore", () => ({
  useSidebarStore: vi.fn((sel) => sel({ pinned: true, hovered: false, mobileOpen: false })),
}));
vi.mock("../hooks/useAppSettings", () => ({
  useAppSettings: () => ({ system: { appName: "App" }, grid: { tooltipDelayDuration: 0 } }),
}));
vi.mock("../hooks/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("../hooks/useModules", () => ({ useModules: () => ({ hasModule: () => true }) }));
vi.mock("../hooks/useSecurity", () => ({ useSecurity: () => ({ can: () => true }) }));

function Probe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname}</output>;
}

describe("AppSidebar Leave Guard", () => {
  beforeEach(() => {
    useEditSessionStore.setState({ sessions: {}, pendingLeave: null });
  });

  it("intercepts link clicks and parks leave when dirty session is registered", () => {
    const discard = vi.fn();
    useEditSessionStore.getState().register("session-1", discard);

    render(
      <MemoryRouter initialEntries={["/"]}>
        <TooltipProvider>
          <Probe />
          <AppSidebar />
        </TooltipProvider>
      </MemoryRouter>
    );

    const reportsLink = screen.getByRole("link", { name: /Reports/i });
    fireEvent.click(reportsLink);

    expect(screen.getByTestId("location").textContent).toBe("/");
    expect(useEditSessionStore.getState().pendingLeave).not.toBeNull();
  });
});
