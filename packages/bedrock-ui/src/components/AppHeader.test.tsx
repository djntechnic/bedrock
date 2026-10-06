import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AppHeader from "./AppHeader";

const mockSidebar = {
  mobileOpen: false,
  setMobileOpen: vi.fn(),
};

vi.mock("../store/sidebarStore", () => ({
  useSidebarStore: vi.fn((selector) => selector(mockSidebar)),
}));

describe("AppHeader", () => {
  beforeEach(() => {
    mockSidebar.mobileOpen = false;
    mockSidebar.setMobileOpen.mockClear();
  });

  it("renders header with app-header class and children", () => {
    render(
      <AppHeader actions={<button>User</button>}>
        <input placeholder="Search" />
      </AppHeader>
    );

    const header = document.querySelector("header.app-header");
    expect(header).toBeDefined();
    expect(screen.getByPlaceholderText("Search")).toBeDefined();
    expect(screen.getByRole("button", { name: "User" })).toBeDefined();
  });

  it("toggles mobileOpen when mobile hamburger button is clicked", () => {
    render(<AppHeader />);
    const menuBtn = screen.getByRole("button", { name: /Open navigation/i });
    fireEvent.click(menuBtn);
    expect(mockSidebar.setMobileOpen).toHaveBeenCalledWith(true);
  });

  it("renders Close navigation label when mobile drawer is open", () => {
    mockSidebar.mobileOpen = true;
    render(<AppHeader />);
    expect(screen.getByRole("button", { name: /Close navigation/i })).toBeDefined();
  });
});
