/**
 * @file cellPosition.test.ts
 * @description Regression cover for the pinned column vanishing in bulk edit.
 *
 * Every assertion runs the result through `cn`, because `cn` is where the bug
 * lived: the classes were all present in the source and tailwind-merge dropped
 * one of them on the way out. Asserting on the raw return value would pass
 * against the original defect.
 */
import { describe, it, expect } from "vitest";
import { cellPositionClasses } from "./cellPosition";
import { cn } from "../../lib/utils";

/** The merged class list a cell would actually carry in the DOM. */
const merged = (...extra: string[]) => cn(...extra).split(" ");

describe("cellPositionClasses", () => {
  it("keeps a left-pinned cell sticky even when it is selectable", () => {
    // The reported defect: `Title` pinned left, ignored in bulk edit. Both
    // conditions are true for exactly one cell — a pinned column in a grid
    // with cell selection on — which is why nothing else surfaced it.
    const classes = merged(cellPositionClasses("left", false, true));
    expect(classes).toContain("sticky");
    expect(classes).not.toContain("relative");
  });

  it("keeps a right-pinned selectable cell sticky", () => {
    const classes = merged(cellPositionClasses("right", false, true));
    expect(classes).toContain("sticky");
    expect(classes).not.toContain("relative");
  });

  it("never emits two position utilities at once", () => {
    // The invariant, stated directly: whatever the combination, tailwind-merge
    // must have nothing to choose between.
    for (const pinned of [false, "left", "right"] as const) {
      for (const isName of [false, true]) {
        for (const selectable of [false, true]) {
          const out = cellPositionClasses(pinned, isName, selectable);
          const positions = out
            .split(" ")
            .filter((c) => c === "sticky" || c === "relative" || c === "absolute");
          expect(positions.length).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("sticks the name column to the left edge when nothing pins it", () => {
    const classes = merged(cellPositionClasses(false, true, true));
    expect(classes).toContain("sticky");
    expect(classes).toContain("left-0");
  });

  it("lets an explicit pin win over the implicit name-column stick", () => {
    // A left pin already puts the cell at the edge with a computed offset;
    // `left-0` would override that offset for any column after the first.
    const classes = merged(cellPositionClasses("left", true, true));
    expect(classes).not.toContain("left-0");
  });

  it("makes an unpinned selectable cell relative, to anchor the fill handle", () => {
    expect(merged(cellPositionClasses(false, false, true))).toContain("relative");
  });

  it("positions nothing for an ordinary read-only cell", () => {
    expect(cellPositionClasses(false, false, false)).toBe("");
  });
});
