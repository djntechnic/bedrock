/**
 * @file types.ts
 * @module @djntechnic/bedrock-ui/components/media
 * @description The serialisable state of an image annotation session
 * (Bedrock #127). Everything the editor can do to a picture is a value here,
 * so a session can be stored, restored, undone and re-exported without the
 * canvas.
 *
 * Coordinates: `crop` and every item live in the *rotated canvas* space — the
 * source image after `rotation`, expanded to its bounding box — not in source
 * pixels. Rotate first, then crop and annotate.
 */

export type AnnotationKind = "arrow" | "rect" | "line" | "text";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AnnotationBase {
  /** Unique within a state. */
  id: string;
  /** `#rgb` or `#rrggbb`. */
  color: string;
  /** Clamped to 1..20. */
  strokeWidth: number;
}

export interface ArrowAnnotation extends AnnotationBase {
  kind: "arrow";
  /** Tail x, tail y, head x, head y. */
  points: [number, number, number, number];
}

export interface LineAnnotation extends AnnotationBase {
  kind: "line";
  points: [number, number, number, number];
}

export interface RectAnnotation extends AnnotationBase {
  kind: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextAnnotation extends AnnotationBase {
  kind: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export type AnnotationItem = ArrowAnnotation | LineAnnotation | RectAnnotation | TextAnnotation;

export interface ImageAnnotationState {
  /** Degrees, clamped to -360..360. Positive is clockwise. */
  rotation: number;
  crop: CropRect | null;
  items: AnnotationItem[];
}

export interface ExportMeta {
  width: number;
  height: number;
  state: ImageAnnotationState;
}
