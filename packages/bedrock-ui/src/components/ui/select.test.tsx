/**
 * @file select.test.tsx
 * @module @djntechnic/bedrock-ui/components/ui
 * @description SelectTrigger must shrink inside a flex row and truncate a long
 * value rather than push its container wide. jsdom has no layout, so the
 * contract is asserted on the classes that produce it.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

const LONG = "x".repeat(120);

function renderLong() {
  return render(
    <Select value="long">
      <SelectTrigger aria-label="Kind" title="Kind title">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="long">{LONG}</SelectItem>
      </SelectContent>
    </Select>,
  );
}

describe("SelectTrigger truncation", () => {
  it("lets the trigger shrink and truncates the value slot", () => {
    renderLong();
    const trigger = screen.getByRole("combobox", { name: "Kind" });
    expect(trigger.className.split(/\s+/)).toContain("min-w-0");
    expect(trigger.className.split(/\s+/)).toContain("[&>span]:truncate");
    const value = trigger.querySelector('[data-slot="select-value"]');
    expect(value).not.toBeNull();
    expect(value).toHaveTextContent(LONG);
  });

  it("leaves title and aria-label untouched", () => {
    renderLong();
    const trigger = screen.getByRole("combobox", { name: "Kind" });
    expect(trigger).toHaveAttribute("title", "Kind title");
    expect(trigger).toHaveAttribute("aria-label", "Kind");
  });

  it("still lets a caller override width through className", () => {
    render(
      <Select value="a">
        <SelectTrigger aria-label="Narrow" className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
        </SelectContent>
      </Select>,
    );
    const cls = screen.getByRole("combobox", { name: "Narrow" }).className.split(/\s+/);
    expect(cls).toContain("w-24");
    expect(cls).not.toContain("w-fit");
  });
});
