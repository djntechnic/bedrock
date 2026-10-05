/**
 * @file imageAnnotation.test.ts
 * @description The pure half of the annotator: state normalisation, the
 * working-bitmap clamp, output geometry and the undo/redo reducer.
 */
import { describe, expect, it } from "vitest";
import {
  CONTENT_COLORS,
  InvalidDimensionsError,
  MAX_LONG_EDGE,
  MAX_PIXELS,
  MAX_STROKE_WIDTH,
  clampDimensions,
  createHistory,
  emptyState,
  exportBounds,
  historyReducer,
  normalizeState,
  rotatedSize,
} from "./imageAnnotation";
import type { ImageAnnotationState } from "./types";

describe("normalizeState", () => {
  it("clamps rotation to -360..360", () => {
    expect(normalizeState({ rotation: 900 }, 100, 100).rotation).toBe(360);
    expect(normalizeState({ rotation: -900 }, 100, 100).rotation).toBe(-360);
    expect(normalizeState({ rotation: 45 }, 100, 100).rotation).toBe(45);
  });

  it("defaults non-numeric rotation and non-object input to the empty state", () => {
    expect(normalizeState({ rotation: "x" }, 100, 100).rotation).toBe(0);
    expect(normalizeState(null, 100, 100)).toEqual(emptyState());
    expect(normalizeState(42, 100, 100)).toEqual(emptyState());
  });

  it("clamps the crop to the image bounds", () => {
    const s = normalizeState({ crop: { x: -10, y: 20, width: 500, height: 500 } }, 200, 100);
    expect(s.crop).toEqual({ x: 0, y: 20, width: 200, height: 80 });
  });

  it("turns a zero-area or malformed crop into null", () => {
    expect(normalizeState({ crop: { x: 10, y: 10, width: 0, height: 50 } }, 100, 100).crop).toBeNull();
    expect(normalizeState({ crop: { x: 500, y: 0, width: 50, height: 50 } }, 100, 100).crop).toBeNull();
    expect(normalizeState({ crop: { x: 0, y: 0, width: NaN, height: 5 } }, 100, 100).crop).toBeNull();
    expect(normalizeState({ crop: "nope" }, 100, 100).crop).toBeNull();
  });

  it("bounds the crop by the rotated canvas, not the source", () => {
    // 100x100 rotated 45deg has a ~141.4px bounding box.
    const s = normalizeState({ rotation: 45, crop: { x: 0, y: 0, width: 140, height: 140 } }, 100, 100);
    expect(s.crop).toEqual({ x: 0, y: 0, width: 140, height: 140 });
  });

  it("keeps each of the four kinds and drops an unknown one", () => {
    const s = normalizeState(
      {
        items: [
          { id: "a", kind: "arrow", color: "#ff0000", strokeWidth: 4, points: [0, 0, 10, 10] },
          { id: "b", kind: "rect", color: "#00ff00", strokeWidth: 4, x: 1, y: 2, width: 3, height: 4 },
          { id: "c", kind: "line", color: "#0000ff", strokeWidth: 4, points: [1, 1, 2, 2] },
          { id: "d", kind: "text", color: "#000", strokeWidth: 4, x: 5, y: 6, text: "hi", fontSize: 20 },
          { id: "e", kind: "circle", color: "#000", strokeWidth: 4 },
        ],
      },
      100,
      100,
    );
    expect(s.items.map((i) => i.kind)).toEqual(["arrow", "rect", "line", "text"]);
  });

  it("drops duplicate and empty ids, keeping the first", () => {
    const base = { kind: "line", color: "#000000", strokeWidth: 2, points: [0, 0, 1, 1] };
    const s = normalizeState({ items: [{ ...base, id: "x" }, { ...base, id: "x" }, { ...base, id: "" }, base] }, 10, 10);
    expect(s.items).toHaveLength(1);
  });

  it("falls back to the default content colour for an invalid colour", () => {
    const base = { id: "a", kind: "line", strokeWidth: 2, points: [0, 0, 1, 1] };
    const s = normalizeState({ items: [{ ...base, color: "red" }, { ...base, id: "b", color: "#12" }] }, 10, 10);
    expect(s.items.map((i) => i.color)).toEqual([CONTENT_COLORS[0].hex, CONTENT_COLORS[0].hex]);
  });

  it("clamps strokeWidth to 1..20", () => {
    const base = { kind: "line", color: "#000000", points: [0, 0, 1, 1] };
    const s = normalizeState(
      {
        items: [
          { ...base, id: "a", strokeWidth: 0 },
          { ...base, id: "b", strokeWidth: 99 },
          { ...base, id: "c", strokeWidth: "x" },
        ],
      },
      10,
      10,
    );
    expect(s.items.map((i) => i.strokeWidth)).toEqual([1, MAX_STROKE_WIDTH, 1]);
  });

  it("drops items with non-finite geometry and flips negative rect extents", () => {
    const s = normalizeState(
      {
        items: [
          { id: "a", kind: "line", color: "#000000", strokeWidth: 2, points: [0, 0, Infinity, 1] },
          { id: "b", kind: "rect", color: "#000000", strokeWidth: 2, x: 10, y: 10, width: -4, height: -6 },
        ],
      },
      100,
      100,
    );
    expect(s.items).toEqual([expect.objectContaining({ id: "b", x: 6, y: 4, width: 4, height: 6 })]);
  });

  it("is idempotent", () => {
    const once = normalizeState(
      {
        rotation: 30,
        crop: { x: 5, y: 5, width: 50, height: 50 },
        items: [{ id: "a", kind: "text", color: "#fff", strokeWidth: 3, x: 1, y: 1, text: "t", fontSize: 18 }],
      },
      200,
      200,
    );
    expect(normalizeState(once, 200, 200)).toEqual(once);
  });
});

describe("clampDimensions", () => {
  it("limits a 4000x3000 source to a 3200px long edge, keeping aspect ratio", () => {
    expect(clampDimensions(4000, 3000)).toEqual({ width: 3200, height: 2400 });
  });

  it("keeps 3200x3200 within 16MP", () => {
    const { width, height } = clampDimensions(3200, 3200);
    expect(width).toBe(3200);
    expect(width * height).toBeLessThanOrEqual(MAX_PIXELS);
  });

  it("limits a portrait source by its height", () => {
    expect(clampDimensions(3000, 4000)).toEqual({ width: 2400, height: 3200 });
  });

  it("leaves already-small input unchanged", () => {
    expect(clampDimensions(800, 600)).toEqual({ width: 800, height: 600 });
    expect(clampDimensions(MAX_LONG_EDGE, 10)).toEqual({ width: MAX_LONG_EDGE, height: 10 });
  });

  it("preserves aspect ratio for extreme panoramas, never below 1px", () => {
    expect(clampDimensions(20000, 100)).toEqual({ width: 3200, height: 16 });
    expect(clampDimensions(100000, 1)).toEqual({ width: 3200, height: 1 });
  });

  it("throws a typed error for zero, negative and non-finite input", () => {
    expect(() => clampDimensions(0, 10)).toThrow(InvalidDimensionsError);
    expect(() => clampDimensions(10, -1)).toThrow(InvalidDimensionsError);
    expect(() => clampDimensions(NaN, 10)).toThrow(InvalidDimensionsError);
    expect(() => clampDimensions(Infinity, 10)).toThrow(InvalidDimensionsError);
  });
});

describe("rotatedSize / exportBounds", () => {
  it("swaps the sides at 90 degrees and expands at 45", () => {
    expect(rotatedSize(200, 100, 90)).toEqual({ width: 100, height: 200 });
    expect(rotatedSize(100, 100, 45)).toEqual({ width: 141, height: 141 });
    expect(rotatedSize(200, 100, 0)).toEqual({ width: 200, height: 100 });
    expect(rotatedSize(200, 100, -360)).toEqual({ width: 200, height: 100 });
  });

  it("exports the crop size when cropped, the rotated bounds otherwise", () => {
    const base: ImageAnnotationState = { rotation: 90, crop: null, items: [] };
    expect(exportBounds(base, 200, 100)).toEqual({ width: 100, height: 200 });
    expect(exportBounds({ ...base, crop: { x: 0, y: 0, width: 40, height: 30 } }, 200, 100)).toEqual({
      width: 40,
      height: 30,
    });
  });
});

describe("history reducer", () => {
  const a = emptyState();
  const b: ImageAnnotationState = { ...a, rotation: 90 };
  const c: ImageAnnotationState = { ...a, rotation: 180 };

  it("pushes onto the past and tracks the present", () => {
    const h = historyReducer(createHistory(a), { type: "push", state: b });
    expect(h.present).toBe(b);
    expect(h.past).toEqual([a]);
    expect(h.future).toEqual([]);
  });

  it("undoes and redoes", () => {
    let h = historyReducer(createHistory(a), { type: "push", state: b });
    h = historyReducer(h, { type: "push", state: c });
    h = historyReducer(h, { type: "undo" });
    expect(h.present).toBe(b);
    h = historyReducer(h, { type: "redo" });
    expect(h.present).toBe(c);
  });

  it("clears redo on a new push", () => {
    let h = historyReducer(createHistory(a), { type: "push", state: b });
    h = historyReducer(h, { type: "undo" });
    expect(h.future).toEqual([b]);
    h = historyReducer(h, { type: "push", state: c });
    expect(h.future).toEqual([]);
  });

  it("treats undo and redo at empty as no-ops (same reference)", () => {
    const h = createHistory(a);
    expect(historyReducer(h, { type: "undo" })).toBe(h);
    expect(historyReducer(h, { type: "redo" })).toBe(h);
  });

  it("reset discards past and future", () => {
    let h = historyReducer(createHistory(a), { type: "push", state: b });
    h = historyReducer(h, { type: "undo" });
    expect(historyReducer(h, { type: "reset", state: c })).toEqual({ past: [], present: c, future: [] });
  });

  it("ignores a push of the identical state", () => {
    const h = createHistory(a);
    expect(historyReducer(h, { type: "push", state: a })).toBe(h);
  });
});
