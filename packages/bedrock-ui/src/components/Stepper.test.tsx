import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Stepper from "./Stepper";

describe("Stepper", () => {
  const steps = ["Upload", "Map Columns", "Review"];

  it("renders ordered progress list with aria-current on the active step", () => {
    render(<Stepper steps={steps} current={1} />);

    const list = screen.getByRole("list", { name: "Progress" });
    expect(list).toBeDefined();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);

    expect(items[0].getAttribute("data-state")).toBe("complete");
    expect(items[0].getAttribute("aria-current")).toBeNull();

    expect(items[1].getAttribute("data-state")).toBe("current");
    expect(items[1].getAttribute("aria-current")).toBe("step");

    expect(items[2].getAttribute("data-state")).toBe("upcoming");
    expect(items[2].getAttribute("aria-current")).toBeNull();
  });
});
