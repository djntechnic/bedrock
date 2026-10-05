/**
 * @file exportCanvas.ts
 * @module @djntechnic/bedrock-ui/components/media
 * @description Renders an annotated image to a 2D canvas context. The draw
 * routine takes the context as an argument (no `document`), so it is testable
 * against a recording fake; the Blob step lives beside it.
 *
 * Pipeline, matching the on-screen stage: draw the working bitmap rotated about
 * the centre of its bounding box, shift by the crop origin, then paint the
 * items in the same rotated-canvas space.
 */
import { EXPORT_BACKGROUND, exportBounds, rotatedSize, type Size } from "./imageAnnotation";
import type { AnnotationItem, ImageAnnotationState } from "./types";

/** The slice of the 2D context the exporter uses, so a fake can implement it exactly. */
export type Drawing2D = Pick<
  CanvasRenderingContext2D,
  | "save"
  | "restore"
  | "translate"
  | "rotate"
  | "drawImage"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "closePath"
  | "stroke"
  | "fill"
  | "strokeRect"
  | "fillRect"
  | "fillText"
  | "strokeStyle"
  | "fillStyle"
  | "lineWidth"
  | "lineCap"
  | "lineJoin"
  | "font"
  | "textBaseline"
>;

type Point = [number, number];

/** The two barbs of an arrow head, behind the tip along the shaft. */
export function arrowHeadPoints(points: [number, number, number, number], strokeWidth: number): [Point, Point] {
  const [x1, y1, x2, y2] = points;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const length = 10 + strokeWidth * 2;
  const spread = Math.PI / 7;
  return [
    [x2 - length * Math.cos(angle - spread), y2 - length * Math.sin(angle - spread)],
    [x2 - length * Math.cos(angle + spread), y2 - length * Math.sin(angle + spread)],
  ];
}

function drawItem(ctx: Drawing2D, item: AnnotationItem): void {
  ctx.strokeStyle = item.color;
  ctx.fillStyle = item.color;
  ctx.lineWidth = item.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (item.kind) {
    case "rect":
      ctx.strokeRect(item.x, item.y, item.width, item.height);
      break;
    case "line": {
      const [x1, y1, x2, y2] = item.points;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      break;
    }
    case "arrow": {
      const [x1, y1, x2, y2] = item.points;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [left, right] = arrowHeadPoints(item.points, item.strokeWidth);
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(left[0], left[1]);
      ctx.lineTo(right[0], right[1]);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "text":
      ctx.font = `${item.fontSize}px sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(item.text, item.x, item.y);
      break;
  }
}

/**
 * Paints `image` (already scaled to the `work` size) and the state's items onto
 * `ctx`, whose canvas must be `exportBounds(state, work.width, work.height)`.
 */
export function drawAnnotated(ctx: Drawing2D, image: CanvasImageSource, work: Size, state: ImageAnnotationState): void {
  const rotated = rotatedSize(work.width, work.height, state.rotation);
  const originX = state.crop?.x ?? 0;
  const originY = state.crop?.y ?? 0;

  ctx.save();
  ctx.translate(0 - originX, 0 - originY);
  ctx.translate(rotated.width / 2, rotated.height / 2);
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.drawImage(image, -work.width / 2, -work.height / 2, work.width, work.height);
  ctx.restore();

  if (state.items.length === 0) return;
  ctx.save();
  ctx.translate(0 - originX, 0 - originY);
  for (const item of state.items) drawItem(ctx, item);
  ctx.restore();
}

export const JPEG_QUALITY = 0.92;

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
}

/**
 * Renders the annotated image to a JPEG entirely client-side. Rejects rather
 * than resolving with an empty file when the browser cannot supply a 2D
 * context or refuses to encode (canvas over the platform limit).
 */
export function exportToBlob(
  image: CanvasImageSource,
  work: Size,
  state: ImageAnnotationState,
  quality: number = JPEG_QUALITY,
): Promise<ExportResult> {
  const { width, height } = exportBounds(state, work.width, work.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("2D canvas is not available"));
  ctx.fillStyle = EXPORT_BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  drawAnnotated(ctx, image, work, state);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, width, height }) : reject(new Error("JPEG encoding failed"))),
      "image/jpeg",
      quality,
    );
  });
}
