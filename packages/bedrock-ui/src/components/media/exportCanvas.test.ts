/**
 * @file exportCanvas.test.ts
 * @description The raster half of the annotator, driven against a recording
 * 2D context: jsdom has no canvas, and what matters here is the transform
 * order and the draw calls, not pixels.
 */
import { describe, expect, it } from "vitest";
import { arrowHeadPoints, drawAnnotated, type Drawing2D } from "./exportCanvas";
import { emptyState } from "./imageAnnotation";
import type { ImageAnnotationState } from "./types";

type Call = { name: string; args: unknown[] };

/** Records every method call and plain assignment, in order. */
function recorder(): { ctx: Drawing2D; calls: Call[]; styles: Record<string, unknown[]> } {
  const calls: Call[] = [];
  const styles: Record<string, unknown[]> = {};
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args });
    };
  const style = (name: string) => ({
    set: (value: unknown) => {
      (styles[name] ??= []).push(value);
    },
    get: () => undefined,
  });
  const ctx = {
    save: record("save"),
    restore: record("restore"),
    translate: record("translate"),
    rotate: record("rotate"),
    drawImage: record("drawImage"),
    beginPath: record("beginPath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    closePath: record("closePath"),
    stroke: record("stroke"),
    fill: record("fill"),
    strokeRect: record("strokeRect"),
    fillRect: record("fillRect"),
    fillText: record("fillText"),
  };
  for (const prop of ["strokeStyle", "fillStyle", "lineWidth", "lineCap", "lineJoin", "font", "textBaseline"]) {
    Object.defineProperty(ctx, prop, style(prop));
  }
  return { ctx: ctx as unknown as Drawing2D, calls, styles };
}

const IMAGE = {} as CanvasImageSource;
const names = (calls: Call[]) => calls.map((c) => c.name);

describe("drawAnnotated", () => {
  it("draws the bare image centred, with no stroke calls, for an empty state", () => {
    const { ctx, calls } = recorder();
    drawAnnotated(ctx, IMAGE, { width: 200, height: 100 }, emptyState());
    expect(names(calls)).toEqual(["save", "translate", "translate", "rotate", "drawImage", "restore"]);
    expect(calls[1].args).toEqual([0, 0]);
    expect(calls[2].args).toEqual([100, 50]);
    expect(calls[3].args).toEqual([0]);
    expect(calls[4].args).toEqual([IMAGE, -100, -50, 200, 100]);
  });

  it("rotates about the centre of the expanded canvas, in radians", () => {
    const { ctx, calls } = recorder();
    drawAnnotated(ctx, IMAGE, { width: 200, height: 100 }, { ...emptyState(), rotation: 90 });
    expect(calls[2].args).toEqual([50, 100]);
    expect(calls[3].args[0]).toBeCloseTo(Math.PI / 2);
  });

  it("offsets everything by the crop origin", () => {
    const { ctx, calls } = recorder();
    const state: ImageAnnotationState = { ...emptyState(), crop: { x: 30, y: 10, width: 50, height: 40 } };
    drawAnnotated(ctx, IMAGE, { width: 200, height: 100 }, state);
    expect(calls[1]).toEqual({ name: "translate", args: [-30, -10] });
  });

  it("draws each item kind after the image, in item order, with its colour and width", () => {
    const { ctx, calls, styles } = recorder();
    const state: ImageAnnotationState = {
      rotation: 0,
      crop: null,
      items: [
        { id: "r", kind: "rect", color: "#112233", strokeWidth: 6, x: 1, y: 2, width: 30, height: 40 },
        { id: "l", kind: "line", color: "#445566", strokeWidth: 3, points: [0, 0, 9, 9] },
        { id: "a", kind: "arrow", color: "#778899", strokeWidth: 4, points: [0, 0, 50, 0] },
        { id: "t", kind: "text", color: "#aabbcc", strokeWidth: 2, x: 7, y: 8, text: "hello", fontSize: 24 },
      ],
    };
    drawAnnotated(ctx, IMAGE, { width: 200, height: 100 }, state);
    const all = names(calls);
    expect(all.indexOf("drawImage")).toBeLessThan(all.indexOf("strokeRect"));
    expect(calls.find((c) => c.name === "strokeRect")?.args).toEqual([1, 2, 30, 40]);
    expect(calls.find((c) => c.name === "fillText")?.args).toEqual(["hello", 7, 8]);
    expect(all.indexOf("strokeRect")).toBeLessThan(all.indexOf("fillText"));
    expect(styles.strokeStyle).toEqual(expect.arrayContaining(["#112233", "#445566", "#778899"]));
    expect(styles.fillStyle).toEqual(expect.arrayContaining(["#778899", "#aabbcc"]));
    expect(styles.lineWidth).toEqual(expect.arrayContaining([6, 3, 4]));
    expect(styles.font).toEqual(["24px sans-serif"]);
  });

  it("leaves a balanced save/restore stack", () => {
    const { ctx, calls } = recorder();
    const state: ImageAnnotationState = {
      ...emptyState(),
      items: [{ id: "a", kind: "arrow", color: "#000000", strokeWidth: 2, points: [0, 0, 10, 10] }],
    };
    drawAnnotated(ctx, IMAGE, { width: 20, height: 20 }, state);
    expect(names(calls).filter((n) => n === "save")).toHaveLength(names(calls).filter((n) => n === "restore").length);
  });
});

describe("arrowHeadPoints", () => {
  it("places two barbs behind the head, symmetric about the shaft", () => {
    const [l, r] = arrowHeadPoints([0, 0, 100, 0], 4);
    expect(l[0]).toBeLessThan(100);
    expect(r[0]).toBeCloseTo(l[0]);
    expect(l[1]).toBeCloseTo(-r[1]);
    expect(l[1]).not.toBe(0);
  });

  it("returns a degenerate head for a zero-length arrow without NaN", () => {
    const [l, r] = arrowHeadPoints([5, 5, 5, 5], 4);
    expect([...l, ...r].every(Number.isFinite)).toBe(true);
  });

  it("grows with stroke width", () => {
    const small = arrowHeadPoints([0, 0, 100, 0], 2)[0];
    const big = arrowHeadPoints([0, 0, 100, 0], 12)[0];
    expect(Math.abs(big[1])).toBeGreaterThan(Math.abs(small[1]));
  });
});
