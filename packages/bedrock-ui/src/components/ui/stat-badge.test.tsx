/**
 * @file stat-badge.test.tsx
 * @description Upstream unit coverage for `<StatBadge>` (#98): value text
 * rendering across sample inputs, semantic variant color resolution through
 * CSS custom properties rather than literal hex (§S009), and `className`
 * merge behavior that neither drops the baseline pill classes nor clobbers
 * the variant's inline style.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatBadge, type StatBadgeVariant } from "./stat-badge";

describe("StatBadge", () => {
  describe("value rendering", () => {
    it.each(["+0.045", "-12", "Neutral"])(
      "renders the value text %s",
      (value) => {
        render(<StatBadge value={value} variant="neutral" />);
        expect(screen.getByText(value)).toBeTruthy();
      },
    );

    it("renders an empty string value without throwing", () => {
      render(<StatBadge value="" variant="neutral" />);
      const badge = document.querySelector("span");
      expect(badge).toBeTruthy();
      expect(badge?.textContent).toBe("");
    });
  });

  describe("variant color resolution via CSS custom properties", () => {
    const variants: StatBadgeVariant[] = ["positive", "negative", "warning", "neutral"];

    it.each(variants)("resolves %s through hsl(var(--%s)) tokens, not a literal hex", (variant) => {
      render(<StatBadge value="stat" variant={variant} />);
      const badge = screen.getByText("stat");

      // Source alignment padding (e.g. `--warning  / 0.15`) is collapsed
      // before comparison so the assertion checks semantic equivalence, not
      // incidental whitespace from the source's column alignment.
      const normalize = (css: string) => css.replace(/\s+/g, " ");

      expect(normalize(badge.style.backgroundColor)).toBe(`hsl(var(--${variant}) / 0.15)`);
      expect(normalize(badge.style.color)).toBe(`hsl(var(--${variant}))`);

      // No literal hex/rgb value should ever appear in the resolved style.
      expect(badge.style.backgroundColor).not.toMatch(/#|rgb\(/);
      expect(badge.style.color).not.toMatch(/#|rgb\(/);
    });
  });

  describe("className merging", () => {
    it("merges a custom className onto the root span alongside baseline pill classes", () => {
      render(<StatBadge value="stat" variant="positive" className="custom-extra" />);
      const badge = screen.getByText("stat");

      expect(badge.tagName).toBe("SPAN");
      expect(badge.className).toContain("inline-flex");
      expect(badge.className).toContain("rounded-full");
      expect(badge.className).toContain("tabular-nums");
      expect(badge.className).toContain("custom-extra");
    });

    it("does not let a custom className overwrite the variant's inline styles", () => {
      render(
        <StatBadge
          value="stat"
          variant="negative"
          className="bg-red-500 text-white"
        />,
      );
      const badge = screen.getByText("stat");

      // Tailwind utility classes may be present in the class list, but the
      // component's inline style (higher specificity) must still resolve to
      // the token-backed variant colors, not the className's literal utility.
      expect(badge.style.backgroundColor).toBe("hsl(var(--negative) / 0.15)");
      expect(badge.style.color).toBe("hsl(var(--negative))");
    });

    it("renders with baseline pill classes and no crash when className is omitted", () => {
      render(<StatBadge value="stat" variant="warning" />);
      const badge = screen.getByText("stat");

      expect(badge.className).toContain("inline-flex");
      expect(badge.className).toContain("rounded-full");
      expect(badge.className).toContain("tabular-nums");
    });
  });
});
