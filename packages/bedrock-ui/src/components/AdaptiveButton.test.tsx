import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "./ui/tooltip";
import { AdaptiveButton, IconAction, collapseClass } from "./AdaptiveButton";

function renderWithTooltip(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("AdaptiveButton", () => {
  it("renders with icon, visible label, and container query collapse classes", () => {
    renderWithTooltip(
      <AdaptiveButton
        icon={<span data-testid="test-icon">icon</span>}
        label="Download Report"
        collapseBelow="lg"
      />
    );

    expect(screen.getByTestId("test-icon")).toBeDefined();
    const labelSpan = screen.getByText("Download Report");
    expect(labelSpan.className).toBe(collapseClass("lg"));
    expect(labelSpan.className).toContain("@max-5xl:sr-only");
  });

  it("renders square button classes when square prop is true", () => {
    const { container } = renderWithTooltip(
      <AdaptiveButton
        icon={<span>x</span>}
        label="Delete"
        collapseBelow="md"
        square
      />
    );

    const button = container.querySelector("button");
    expect(button?.className).toContain("@max-3xl:w-8");
  });

  it("renders IconAction with aria-label for accessibility", () => {
    renderWithTooltip(<IconAction icon={<span>edit</span>} label="Edit Row" />);
    const button = screen.getByRole("button", { name: "Edit Row" });
    expect(button).toBeDefined();
  });
});
