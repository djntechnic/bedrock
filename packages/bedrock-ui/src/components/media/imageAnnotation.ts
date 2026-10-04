/**
 * @file imageAnnotation.ts
 * @module @djntechnic/bedrock-ui/components/media
 * @description Pure, canvas-free half of the image annotator: normalising
 * untrusted state, the working-bitmap clamp, output geometry and the
 * undo/redo reducer. Nothing here touches the DOM, so all of it is unit
 * tested directly.
 */
import type { AnnotationItem, CropRect, ImageAnnotationState } from "./types";

// ── Limits ───────────────────────────────────────────────────────────────────

export const MAX_LONG_EDGE = 3200;
/** 16 megapixels. */
export const MAX_PIXELS = 16_000_000;
export const MIN_STROKE_WIDTH = 1;
export const MAX_STROKE_WIDTH = 20;
export const MAX_ROTATION = 360;
export const DEFAULT_FONT_SIZE = 24;
const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 200;

/**
 * The six swatches. These are *content* colours — what gets burned into the
 * picture — not UI chrome, so they are literals by design and cannot follow
 * the theme: a red arrow must stay red in dark mode.
 */
export const CONTENT_COLORS = [
  { name: "Red", hex: "#ef4444" }, // exempt_literals: content colour, burned into the exported image (§S009)
  { name: "Yellow", hex: "#facc15" }, // exempt_literals: content colour, burned into the exported image (§S009)
  { name: "Green", hex: "#22c55e" }, // exempt_literals: content colour, burned into the exported image (§S009)
  { name: "Blue", hex: "#3b82f6" }, // exempt_literals: content colour, burned into the exported image (§S009)
  { name: "White", hex: "#ffffff" }, // exempt_literals: content colour, burned into the exported image (§S009)
  { name: "Black", hex: "#000000" }, // exempt_literals: content colour, burned into the exported image (§S009)
] as const;

/** JPEG has no alpha; transparent regions (rotation corners) flatten onto this. */
export const EXPORT_BACKGROUND = "#ffffff"; // exempt_literals: JPEG has no alpha, so corners need an opaque fill (§S009)

// ── Dimension clamp ──────────────────────────────────────────────────────────

export class InvalidDimensionsError extends Error {
  constructor(width: number, height: number) {
    super(`Invalid image dimensions: ${width}x${height}`);
    this.name = "InvalidDimensionsError";
  }
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Scales a bitmap down — never up — until its long edge is at most
 * `MAX_LONG_EDGE` and its area at most `MAX_PIXELS`, with one scale factor so
 * the aspect ratio holds. Sides never drop below 1px.
 */
export function clampDimensions(width: number, height: number): Size {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new InvalidDimensionsError(width, height);
  }
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(width, height), Math.sqrt(MAX_PIXELS / (width * height)));
  if (scale === 1) return { width, height };
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

// ── Geometry ─────────────────────────────────────────────────────────────────

/** Bounding box of a `width` x `height` image rotated by `degrees`. */
export function rotatedSize(width: number, height: number, degrees: number): Size {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  // Trig on exact quarter turns leaves ~1e-16 residue; round so 90deg is exactly swapped.
  return {
    width: Math.round(width * cos + height * sin),
    height: Math.round(width * sin + height * cos),
  };
}

/** The output size: the crop if there is one, otherwise the rotated canvas. */
export function exportBounds(state: ImageAnnotationState, width: number, height: number): Size {
  if (state.crop) return { width: state.crop.width, height: state.crop.height };
  return rotatedSize(width, height, state.rotation);
}

// ── Normalisation ────────────────────────────────────────────────────────────

export function emptyState(): ImageAnnotationState {
  return { rotation: 0, crop: null, items: [] };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeCrop(raw: unknown, bounds: Size): CropRect | null {
  if (!isRecord(raw)) return null;
  const x = finite(raw.x);
  const y = finite(raw.y);
  const w = finite(raw.width);
  const h = finite(raw.height);
  if (x === null || y === null || w === null || h === null) return null;
  const left = clamp(x, 0, bounds.width);
  const top = clamp(y, 0, bounds.height);
  const width = clamp(x + w, 0, bounds.width) - left;
  const height = clamp(y + h, 0, bounds.height) - top;
  if (width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
}

function normalizeItem(raw: unknown): AnnotationItem | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || raw.id === "") return null;
  const id = raw.id;
  const color = typeof raw.color === "string" && HEX.test(raw.color) ? raw.color : CONTENT_COLORS[0].hex;
  const strokeWidth = clamp(finite(raw.strokeWidth) ?? MIN_STROKE_WIDTH, MIN_STROKE_WIDTH, MAX_STROKE_WIDTH);
  const base = { id, color, strokeWidth };

  switch (raw.kind) {
    case "arrow":
    case "line": {
      const p = Array.isArray(raw.points) ? raw.points.map(finite) : [];
      if (p.length !== 4 || p.some((n) => n === null)) return null;
      return { ...base, kind: raw.kind, points: p as [number, number, number, number] };
    }
    case "rect": {
      const x = finite(raw.x);
      const y = finite(raw.y);
      const w = finite(raw.width);
      const h = finite(raw.height);
      if (x === null || y === null || w === null || h === null) return null;
      // A drag up and to the left produces negative extents; store the box upright.
      return { ...base, kind: "rect", x: Math.min(x, x + w), y: Math.min(y, y + h), width: Math.abs(w), height: Math.abs(h) };
    }
    case "text": {
      const x = finite(raw.x);
      const y = finite(raw.y);
      if (x === null || y === null || typeof raw.text !== "string") return null;
      const fontSize = clamp(finite(raw.fontSize) ?? DEFAULT_FONT_SIZE, MIN_FONT_SIZE, MAX_FONT_SIZE);
      return { ...base, kind: "text", x, y, text: raw.text, fontSize };
    }
    default:
      return null;
  }
}

/**
 * Coerces untrusted input (a stored session, a parent's `value`) into a valid
 * state for a `width` x `height` source. Invalid parts are repaired or dropped,
 * never thrown on, so a corrupt stored value degrades to an editable session.
 */
export function normalizeState(raw: unknown, width: number, height: number): ImageAnnotationState {
  if (!isRecord(raw)) return emptyState();
  const rotation = clamp(finite(raw.rotation) ?? 0, -MAX_ROTATION, MAX_ROTATION);
  const crop = normalizeCrop(raw.crop, rotatedSize(width, height, rotation));
  const seen = new Set<string>();
  const items: AnnotationItem[] = [];
  for (const candidate of Array.isArray(raw.items) ? raw.items : []) {
    const item = normalizeItem(candidate);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return { rotation, crop, items };
}

// ── History ──────────────────────────────────────────────────────────────────

export interface History {
  past: ImageAnnotationState[];
  present: ImageAnnotationState;
  future: ImageAnnotationState[];
}

export type HistoryAction = { type: "push"; state: ImageAnnotationState } | { type: "undo" } | { type: "redo" };

export function createHistory(present: ImageAnnotationState): History {
  return { past: [], present, future: [] };
}

export function historyReducer(history: History, action: HistoryAction): History {
  switch (action.type) {
    case "push":
      if (action.state === history.present) return history;
      return { past: [...history.past, history.present], present: action.state, future: [] };
    case "undo": {
      const previous = history.past[history.past.length - 1];
      if (!previous) return history;
      return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
    }
    case "redo": {
      const [next, ...rest] = history.future;
      if (!next) return history;
      return { past: [...history.past, history.present], present: next, future: rest };
    }
  }
}
