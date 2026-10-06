import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "./ui/tooltip";
import AppSidebar, { type AppSidebarProps } from "./AppSidebar";
import type { NavItem } from "./navRegistry";

const mockState = {
  pinned: true,
  hovered: false,
  mobileOpen: false,
  isMobile: false,
  reducedMotion: false,
  togglePinned: vi.fn(),
  setHovered: vi.fn(),
  setMobileOpen: vi.fn(),
};

vi.mock("../store/sidebarStore", () => ({
  useSidebarStore: vi.fn((selector) => selector(mockState)),
}));

vi.mock("../store/commandPaletteStore", () => ({
  useCommandPaletteStore: vi.fn((selector) => selector({ open: false, setOpen: vi.fn() })),
}));

vi.mock("../hooks/useAppSettings", () => ({
  useAppSettings: () => ({
    system: { appName: "Acme Warehouse" },
    grid: { tooltipDelayDuration: 0 },
  }),
}));

vi.mock("../hooks/useMediaQuery", () => ({
  useMediaQuery: (query: string) => {
    if (query.includes("prefers-reduced-motion")) return mockState.reducedMotion;
    if (query.includes("max-width")) return mockState.isMobile;
    return false;
  },
}));

const TEST_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: () => <span data-testid="icon-dashboard" />, exact: true },
  { to: "/reports", label: "Reports", icon: () => <span data-testid="icon-reports" /> },
];

vi.mock("../hooks/useNavSettings", () => ({
  useNavSettings: () => ({
    navItems: TEST_NAV,
    isLoading: false,
  }),
}));

const mockAuth = {
  user: { email: "dan@example.com", display_name: "Dan N" },
  token: "xyz",
  isLoading: false,
  isAuthenticated: true,
  isAdmin: true,
  hasRole: () => true,
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  completeGoogleLogin: vi.fn(),
  logout: vi.fn(),
  setSession: vi.fn(),
};

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}));

vi.mock("../hooks/useModules", () => ({
  useModules: () => ({
    hasModule: () => true,
    enabledModules: ["reports"],
  }),
}));

vi.mock("../hooks/useSecurity", () => ({
  useSecurity: () => ({
    can: () => true,
  }),
}));

function renderSidebar(props: AppSidebarProps = {}, initialRoute = "/") {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <TooltipProvider>
        <AppSidebar {...props} />
      </TooltipProvider>
    </MemoryRouter>
  );
}

describe("AppSidebar Shell Refresh - Brand & Backdrop", () => {
  beforeEach(() => {
    mockState.pinned = true;
    mockState.isMobile = false;
    mockState.mobileOpen = false;
    mockState.reducedMotion = false;
  });

  it("renders the first letter of appName as default brand mark and removes baseball SVG", () => {
    renderSidebar();
    const mark = screen.getByTestId("sidebar-brand-mark");
    expect(mark.textContent).toBe("A");
    expect(mark.querySelector("svg")).toBeNull();
  });

  it("renders custom brand mark when supplied", () => {
    renderSidebar({ brand: { mark: <span data-testid="custom-mark">★</span> } });
    expect(screen.getByTestId("custom-mark")).toBeDefined();
  });

  it("does not render Analytics subtitle by default", () => {
    renderSidebar();
    expect(screen.queryByText("Analytics")).toBeNull();
  });

  it("renders custom brand subtitle when supplied", () => {
    renderSidebar({ brand: { subtitle: "Enterprise Console" } });
    expect(screen.getByText("Enterprise Console")).toBeDefined();
  });

  it("uses bg-scrim/40 for mobile drawer backdrop", () => {
    mockState.isMobile = true;
    mockState.mobileOpen = true;
    renderSidebar();
    const backdrop = screen.getByTestId("sidebar-mobile-backdrop");
    expect(backdrop.className).toContain("bg-scrim/40");
    expect(backdrop.className).not.toContain("bg-black/40");
  });
});

describe("AppSidebar Shell Refresh - Indicator & Motion", () => {
  beforeEach(() => {
    mockState.pinned = true;
    mockState.isMobile = false;
    mockState.mobileOpen = false;
    mockState.reducedMotion = false;
  });

  it("renders active indicator bar and rounded-lg rows without ring box", () => {
    renderSidebar({}, "/");
    const activeIndicator = screen.getByTestId("nav-active-indicator");
    expect(activeIndicator).toBeDefined();
    expect(activeIndicator.className).toContain("bg-primary");

    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    expect(dashboardLink.className).toContain("rounded-lg");
    expect(dashboardLink.className).not.toContain("ring-1");
  });

  it("gates sidebar width transition on reduced motion", () => {
    mockState.reducedMotion = false;
    const { container, rerender } = renderSidebar();
    const aside = container.querySelector("aside.app-sidebar");
    expect(aside?.className).toContain("transition-[width]");

    mockState.reducedMotion = true;
    rerender(
      <MemoryRouter initialEntries={["/"]}>
        <TooltipProvider>
          <AppSidebar />
        </TooltipProvider>
      </MemoryRouter>
    );
    expect(aside?.className).not.toContain("transition-[width]");
  });
});
