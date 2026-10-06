import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "./ui/tooltip";
import AppFooter from "./AppFooter";

vi.mock("../context/KeyboardShortcutsContext", () => ({
  useKeyboardShortcuts: () => ({ open: vi.fn() }),
}));

vi.mock("../hooks/useAppSettings", () => ({
  useAppSettings: () => ({
    system: { appName: "Acme Collect" },
  }),
}));

function renderFooter(props = {}) {
  return render(
    <TooltipProvider>
      <AppFooter {...props} />
    </TooltipProvider>
  );
}

describe("AppFooter", () => {
  it("renders appName and built on bedrock attribution", () => {
    renderFooter();
    expect(screen.getByText("Acme Collect")).toBeDefined();
    const attr = screen.getByTestId("footer-attribution");
    expect(attr.textContent).toBe("built on bedrock");
  });

  it("renders tagline between appName and attribution when provided", () => {
    renderFooter({ tagline: "Inventory Manager" });
    expect(screen.getByText("Acme Collect")).toBeDefined();
    expect(screen.getByText("Inventory Manager")).toBeDefined();
    expect(screen.getByTestId("footer-attribution").textContent).toBe("built on bedrock");
  });
});
