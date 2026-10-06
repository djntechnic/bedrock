import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AppShell from "./AppShell";

const mockSidebar = {
  pinned: false,
  hovered: false,
};

vi.mock("../store/sidebarStore", () => ({
  useSidebarStore: vi.fn((selector) => selector(mockSidebar)),
}));

vi.mock("../hooks/useMediaQuery", () => ({
  useMediaQuery: vi.fn(() => false),
}));

vi.mock("./AppFooter", () => ({
  default: () => <footer data-testid="footer" />,
}));

vi.mock("./AppSidebar", () => ({
  default: () => <aside data-testid="default-sidebar" />,
}));

describe("AppShell", () => {
  beforeEach(() => {
    mockSidebar.pinned = false;
    mockSidebar.hovered = false;
  });

  it("calculates ml-16 when sidebar is collapsed on desktop", () => {
    render(
      <AppShell sidebar={<div data-testid="sidebar" />} header={<div data-testid="header" />}>
        <div>Content</div>
      </AppShell>
    );

    const mainColumn = screen.getByTestId("app-shell-main-column");
    expect(mainColumn.className).toContain("ml-16");
    expect(screen.getByTestId("header")).toBeDefined();
  });

  it("calculates ml-60 when sidebar is pinned on desktop", () => {
    mockSidebar.pinned = true;
    render(
      <AppShell sidebar={<div data-testid="sidebar" />} header={<div data-testid="header" />}>
        <div>Content</div>
      </AppShell>
    );

    const mainColumn = screen.getByTestId("app-shell-main-column");
    expect(mainColumn.className).toContain("ml-60");
  });

  it("hides header when layout is fullBleed", () => {
    render(
      <AppShell layout="fullBleed" header={<div data-testid="header" />}>
        <div>Content</div>
      </AppShell>
    );

    expect(screen.queryByTestId("header")).toBeNull();
  });
});
