import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SelectionDock from "./SelectionDock";

describe("SelectionDock", () => {
  it("returns null when count is less than 1", () => {
    const { container } = render(<SelectionDock count={0} onClear={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders toolbar with count, clear button, and slot actions", () => {
    const onClear = vi.fn();
    render(
      <SelectionDock count={12} onClear={onClear}>
        <button>Assign</button>
      </SelectionDock>
    );

    const dock = screen.getByRole("toolbar", { name: "Selection" });
    expect(dock).toBeDefined();
    expect(screen.getByText("12 selected")).toBeDefined();
    expect(screen.getByRole("button", { name: "Assign" })).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Clear/i }));
    expect(onClear).toHaveBeenCalled();
  });
});
