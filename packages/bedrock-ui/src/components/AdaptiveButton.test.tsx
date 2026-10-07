import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "./ui/tooltip";
import {
  AdaptiveButton,
  IconAction,
  collapseClass,
  ADAPTIVE_BAR,
  type CollapseBelow,
} from "./AdaptiveButton";

// Radix Tooltip measures its arrow with ResizeObserver, which jsdom lacks.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function renderWithTooltip(ui: React.ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("AdaptiveButton - Breakpoint and collapse transitions", () => {
  it("renders with icon, visible label, and container query collapse classes for explicit breakpoints", () => {
    renderWithTooltip(
      <AdaptiveButton
        icon={<span data-testid="test-icon">icon</span>}
        label="Download Report"
        collapseBelow="xl"
      />
    );

    expect(screen.getByTestId("test-icon")).toBeDefined();
    const labelSpan = screen.getByText("Download Report");
    expect(labelSpan.className).toBe(collapseClass("xl"));
    expect(labelSpan.className).toContain("@max-[1350px]:sr-only");
  });

  it("defaults to the lg breakpoint transition when no responsive container width is explicitly declared", () => {
    renderWithTooltip(
      <AdaptiveButton icon={<svg />} label="Guided Navigation" />
    );

    const button = screen.getByRole("button", { name: "Guided Navigation" });
    expect(button).toBeDefined();
    const labelSpan = screen.getByText("Guided Navigation");
    expect(labelSpan.className).toBe(collapseClass("lg"));
    expect(labelSpan.className).toContain("@max-5xl:sr-only");
  });

  it("keeps the label in the DOM as the accessible name", () => {
    renderWithTooltip(<AdaptiveButton icon={<svg />} label="Save view" />);
    expect(screen.getByRole("button", { name: "Save view" })).toBeDefined();
  });
});

describe("AdaptiveButton - Sizing and non-square icons", () => {
  it("renders square button classes under explicit breakpoint when square prop is true", () => {
    const { container } = renderWithTooltip(
      <AdaptiveButton
        icon={<span>x</span>}
        label="Delete"
        collapseBelow="md"
        square
      />
    );

    const button = container.querySelector("button");
    expect(button?.className).toContain("h-8");
    expect(button?.className).toContain("shrink-0");
    expect(button?.className).toContain("@max-3xl:w-8");
    expect(button?.className).toContain("@max-3xl:px-0");
  });

  it("defaults to lg breakpoint square classes when square is true and collapseBelow is omitted", () => {
    const { container } = renderWithTooltip(
      <AdaptiveButton icon={<svg />} label="Fill down" square />
    );

    const button = container.querySelector("button");
    expect(button?.className).toContain("h-8");
    expect(button?.className).toContain("shrink-0");
    expect(button?.className).toContain("@max-5xl:w-8");
    expect(button?.className).toContain("@max-5xl:px-0");
  });

  it("stays a normal button unless square is asked for", () => {
    const { container } = renderWithTooltip(
      <AdaptiveButton icon={<svg />} label="Standard Button" collapseBelow="lg" />
    );

    const button = container.querySelector("button");
    expect(button?.className).not.toContain("@max-5xl:w-8");
    expect(button?.className).not.toContain("@max-5xl:px-0");
  });

  it("handles non-square child action icons without distorting button padding or aspect ratio", () => {
    const nonSquareIcon = (
      <svg
        data-testid="wide-icon"
        viewBox="0 0 32 16"
        className="w-8 h-4 shrink-0"
      />
    );

    const { container, rerender } = renderWithTooltip(
      <AdaptiveButton icon={nonSquareIcon} label="Wide Action" />
    );

    const button = container.querySelector("button");
    expect(button).toBeDefined();
    // Verify default size="sm" styling is retained without distortion
    expect(button?.className).toContain("px-2.5");
    expect(button?.className).toContain("gap-1");
    expect(screen.getByTestId("wide-icon")).toBeDefined();

    // Verify when square={true}, the button retains square container constraints
    rerender(
      <TooltipProvider>
        <AdaptiveButton icon={nonSquareIcon} label="Wide Action" square />
      </TooltipProvider>
    );

    expect(button?.className).toContain("h-8");
    expect(button?.className).toContain("shrink-0");
    expect(button?.className).toContain("@max-5xl:w-8");
    expect(button?.className).toContain("@max-5xl:px-0");
  });
});

describe("IconAction", () => {
  it("renders with aria-label, ghost variant, size-8 geometry, and no visible text", () => {
    renderWithTooltip(<IconAction icon={<svg />} label="Edit Row" />);
    const button = screen.getByRole("button", { name: "Edit Row" });
    expect(button).toBeDefined();
    expect(button.textContent).toBe("");
    expect(button.className).toContain("size-8");
    expect(button.getAttribute("aria-label")).toBe("Edit Row");
  });

  it("handles non-square child action icons without distorting button geometry", () => {
    const nonSquareIcon = (
      <svg
        data-testid="non-square-action"
        viewBox="0 0 40 20"
        className="w-10 h-5"
      />
    );
    renderWithTooltip(<IconAction icon={nonSquareIcon} label="Duplicate Row" />);

    const button = screen.getByRole("button", { name: "Duplicate Row" });
    expect(button.className).toContain("size-8");
    expect(button.className).toContain("hover:bg-muted");
    expect(screen.getByTestId("non-square-action")).toBeDefined();
  });
});

describe("Disabled interactions and tooltip suppression", () => {
  it("reports clicks when AdaptiveButton is enabled", async () => {
    const onClick = vi.fn();
    renderWithTooltip(
      <AdaptiveButton icon={<svg />} label="Submit Form" onClick={onClick} />
    );

    const button = screen.getByRole("button", { name: "Submit Form" });
    expect(button).toBeEnabled();

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows tooltip on hover when AdaptiveButton is enabled", async () => {
    renderWithTooltip(
      <AdaptiveButton icon={<svg />} label="Submit Form" />
    );

    const button = screen.getByRole("button", { name: "Submit Form" });
    await userEvent.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Submit Form");
  });

  it("strictly suppresses onClick callbacks when AdaptiveButton is disabled", async () => {
    const onClick = vi.fn();
    renderWithTooltip(
      <AdaptiveButton
        icon={<svg />}
        label="Disabled Action"
        disabled
        onClick={onClick}
      />
    );

    const button = screen.getByRole("button", { name: "Disabled Action" });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("strictly suppresses hover tooltip states when AdaptiveButton is disabled", async () => {
    renderWithTooltip(
      <AdaptiveButton
        icon={<svg />}
        label="Disabled Action"
        disabled
      />
    );

    const button = screen.getByRole("button", { name: "Disabled Action" });
    expect(button).toBeDisabled();

    await userEvent.hover(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("reports clicks when IconAction is enabled", async () => {
    const onClick = vi.fn();
    renderWithTooltip(
      <IconAction icon={<svg />} label="Delete Item" onClick={onClick} />
    );

    const button = screen.getByRole("button", { name: "Delete Item" });
    expect(button).toBeEnabled();

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows tooltip on hover when IconAction is enabled", async () => {
    renderWithTooltip(
      <IconAction icon={<svg />} label="Delete Item" />
    );

    const button = screen.getByRole("button", { name: "Delete Item" });
    await userEvent.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Delete Item");
  });

  it("strictly suppresses onClick callbacks when IconAction is disabled", async () => {
    const onClick = vi.fn();
    renderWithTooltip(
      <IconAction
        icon={<svg />}
        label="Disabled Delete"
        disabled
        onClick={onClick}
      />
    );

    const button = screen.getByRole("button", { name: "Disabled Delete" });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("strictly suppresses hover tooltip states when IconAction is disabled", async () => {
    renderWithTooltip(
      <IconAction
        icon={<svg />}
        label="Disabled Delete"
        disabled
      />
    );

    const button = screen.getByRole("button", { name: "Disabled Delete" });
    expect(button).toBeDisabled();

    await userEvent.hover(button);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("honours custom hint prop for tooltip text on AdaptiveButton", async () => {
    renderWithTooltip(
      <AdaptiveButton
        icon={<svg />}
        label="Save"
        hint="Save all pending changes (Ctrl+S)"
      />
    );

    const button = screen.getByRole("button", { name: "Save" });
    await userEvent.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Save all pending changes (Ctrl+S)"
    );
  });
});

describe("Exported constants and helpers", () => {
  it("exports ADAPTIVE_BAR container class", () => {
    expect(ADAPTIVE_BAR).toBe("@container");
  });

  it("returns correct collapse class for all supported breakpoints", () => {
    const breakpoints: CollapseBelow[] = ["md", "lg", "xl", "2xl"];
    for (const bp of breakpoints) {
      expect(collapseClass(bp)).toBeTruthy();
      expect(typeof collapseClass(bp)).toBe("string");
    }
    expect(collapseClass("md")).toBe("@max-3xl:sr-only");
    expect(collapseClass("lg")).toBe("@max-5xl:sr-only");
    expect(collapseClass("xl")).toBe("@max-[1350px]:sr-only");
    expect(collapseClass("2xl")).toBe("@max-[1600px]:sr-only");
  });
});
