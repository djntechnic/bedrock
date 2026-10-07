/**
 * @file ImageAnnotatorModal.tsx
 * @module @djntechnic/bedrock-ui/components/media
 * @description Modal image editor: rotate, crop and draw vector annotations
 * (arrow, line, rectangle, text) over a picture, then export a flattened JPEG.
 * Rendering is a local 2D canvas through Konva; nothing is fetched and no
 * script is loaded from a CDN. Export happens in the browser and the blob is
 * handed to `onSave` — uploading it is the host application's business.
 *
 * The session state is a plain serialisable value (`ImageAnnotationState`), so
 * the host can persist it and pass it back as `value`. Rotating clears the
 * crop, because the crop lives in rotated-canvas space.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { KonvaEventObject } from "konva/lib/Node";
import { Arrow, Group, Image as KonvaImage, Layer, Line, Rect, Stage, Text } from "react-konva";
import useImage from "use-image";
import { Redo2, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { cn } from "../../lib/utils";
import { log } from "../../utils/logger";
import { exportToBlob } from "./exportCanvas";
import {
  CONTENT_COLORS,
  DEFAULT_FONT_SIZE,
  MAX_ROTATION,
  MAX_STROKE_WIDTH,
  MIN_STROKE_WIDTH,
  clampDimensions,
  createHistory,
  emptyState,
  historyReducer,
  normalizeState,
  rotatedSize,
  type Size,
} from "./imageAnnotation";
import type { AnnotationItem, CropRect, ExportMeta, ImageAnnotationState } from "./types";

type Tool = "select" | "arrow" | "line" | "rect" | "text" | "crop";

const TOOLS: ReadonlyArray<{ id: Tool; label: string }> = [
  { id: "select", label: "Select" },
  { id: "arrow", label: "Arrow" },
  { id: "line", label: "Line" },
  { id: "rect", label: "Rectangle" },
  { id: "text", label: "Text" },
  { id: "crop", label: "Crop" },
];

/** Longest side of the on-screen stage; the stage scales down to fit, never up. */
const VIEW_MAX = 720;
/** Drags shorter than this are clicks, not shapes. */
const MIN_DRAG = 3;
/** Crop outline: a content colour (Blue) drawn on the picture, not UI chrome. */
const CROP_OUTLINE = CONTENT_COLORS[3].hex;

export interface ImageAnnotatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Image URL. Loaded with `crossOrigin="anonymous"` so the canvas stays exportable. */
  src: string;
  /** Controlled annotation session. Untrusted: it is normalised before use. */
  value?: ImageAnnotationState;
  onChange?: (state: ImageAnnotationState) => void;
  /** Receives the flattened JPEG and the state that produced it. */
  onSave: (blob: Blob, meta: ExportMeta) => void | Promise<void>;
  title?: string;
}

type Point = { x: number; y: number };

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function ImageAnnotatorModal({ open, onOpenChange, src, value, onChange, onSave, title = "Edit image" }: ImageAnnotatorModalProps) {
  const [image] = useImage(src, "anonymous");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // The clamp runs before anything is drawn: the stage never sees the raw bitmap size.
  const sizing = useMemo<{ work: Size } | { error: string } | null>(() => {
    if (!image) return null;
    try {
      return { work: clampDimensions(image.naturalWidth, image.naturalHeight) };
    } catch (err) {
      log.error({ err, src }, "ImageAnnotatorModal: invalid image dimensions");
      return { error: "Invalid image dimensions." };
    }
  }, [image, src]);
  const work = sizing && "work" in sizing ? sizing.work : null;

  const [history, dispatch] = useReducer(historyReducer, undefined, () => createHistory(emptyState()));
  const state = history.present;
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState<string>(CONTENT_COLORS[0].hex);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [label, setLabel] = useState("");
  const [draft, setDraft] = useState<AnnotationItem | CropRect | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const origin = useRef<Point | null>(null);
  const emitted = useRef<ImageAnnotationState | null>(null);

  // Adopt the host's value once the image size is known, and whenever it changes
  // to something other than what we last reported (an external reset).
  useEffect(() => {
    if (!work) return;
    const next = normalizeState(value, work.width, work.height);
    if (emitted.current && JSON.stringify(emitted.current) === JSON.stringify(next)) return;
    dispatch({ type: "reset", state: next });
  }, [value, work]);

  const commit = useCallback(
    (next: ImageAnnotationState) => {
      dispatch({ type: "push", state: next });
      emitted.current = next;
      onChange?.(next);
    },
    [onChange],
  );

  const step = useCallback(
    (type: "undo" | "redo") => {
      const next = historyReducer(history, { type }).present;
      dispatch({ type });
      emitted.current = next;
      onChange?.(next);
    },
    [history, onChange],
  );

  const rotateTo = (degrees: number) => {
    const rotation = Math.min(MAX_ROTATION, Math.max(-MAX_ROTATION, degrees));
    if (rotation === state.rotation) return;
    commit({ ...state, rotation, crop: null });
  };
  const rotateBy = (delta: number) => {
    const next = state.rotation + delta;
    rotateTo(next > MAX_ROTATION ? next - 360 : next < -MAX_ROTATION ? next + 360 : next);
  };

  const canvas = work ? rotatedSize(work.width, work.height, state.rotation) : null;
  const scale = canvas ? Math.min(1, VIEW_MAX / canvas.width, VIEW_MAX / canvas.height) : 1;

  const pointer = (e: KonvaEventObject<MouseEvent | TouchEvent>): Point | null => {
    const p = e.target.getStage()?.getPointerPosition();
    return p ? { x: p.x / scale, y: p.y / scale } : null;
  };

  const onDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const p = pointer(e);
    if (!p || tool === "select") return;
    if (tool === "text") {
      commit({
        ...state,
        items: [
          ...state.items,
          { id: makeId(), kind: "text", color, strokeWidth, x: p.x, y: p.y, text: label.trim() || "Text", fontSize: DEFAULT_FONT_SIZE },
        ],
      });
      return;
    }
    origin.current = p;
  };

  const shapeFor = (a: Point, b: Point): AnnotationItem | CropRect => {
    if (tool === "crop") return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
    if (tool === "rect") {
      return { id: "draft", kind: "rect", color, strokeWidth, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
    }
    return { id: "draft", kind: tool === "line" ? "line" : "arrow", color, strokeWidth, points: [a.x, a.y, b.x, b.y] };
  };

  const onMove = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const p = pointer(e);
    if (p && origin.current) setDraft(shapeFor(origin.current, p));
  };

  const onUp = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const a = origin.current;
    const b = pointer(e);
    origin.current = null;
    setDraft(null);
    if (!a || !b || !canvas || Math.hypot(b.x - a.x, b.y - a.y) < MIN_DRAG) return;
    const shape = shapeFor(a, b);
    if (tool === "crop") {
      const next = normalizeState({ ...state, crop: shape }, work?.width ?? 0, work?.height ?? 0);
      if (next.crop) commit({ ...state, crop: next.crop });
    } else {
      commit({ ...state, items: [...state.items, { ...(shape as AnnotationItem), id: makeId() }] });
    }
  };

  const handleSave = async () => {
    if (!image || !work) return;
    setSaving(true);
    setError(null);
    try {
      const { blob, width, height } = await exportToBlob(image, work, state);
      await onSave(blob, { width, height, state });
    } catch (err) {
      log.error({ err, src }, "ImageAnnotatorModal: export failed");
      setError("Could not export the image.");
    } finally {
      setSaving(false);
    }
  };

  const failure = error ?? (sizing && "error" in sizing ? sizing.error : null);
  const drawItem = (item: AnnotationItem) => {
    const common = { key: item.id, stroke: item.color, strokeWidth: item.strokeWidth, lineCap: "round" as const, lineJoin: "round" as const };
    switch (item.kind) {
      case "arrow":
        return <Arrow {...common} points={item.points} fill={item.color} pointerLength={10 + item.strokeWidth * 2} pointerWidth={10 + item.strokeWidth * 2} />;
      case "line":
        return <Line {...common} points={item.points} />;
      case "rect":
        return <Rect {...common} x={item.x} y={item.y} width={item.width} height={item.height} />;
      case "text":
        return <Text key={item.id} x={item.x} y={item.y} text={item.text} fontSize={item.fontSize} fill={item.color} />;
    }
  };
  const isCrop = (d: AnnotationItem | CropRect): d is CropRect => !("kind" in d);
  const crop = tool === "crop" && draft && isCrop(draft) ? draft : state.crop;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Rotate, crop and mark up the image, then save a JPEG.</DialogDescription>
        </DialogHeader>

        <div data-testid="annotator-body" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Image tools">
            {TOOLS.map((t) => (
              <Button key={t.id} type="button" size="sm" variant={tool === t.id ? "default" : "outline"} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
                {t.label}
              </Button>
            ))}
            <Button type="button" size="sm" variant="outline" aria-label="Rotate left" onClick={() => rotateBy(-90)}>
              <RotateCcw className="size-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" aria-label="Rotate right" onClick={() => rotateBy(90)}>
              <RotateCw className="size-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" aria-label="Undo" disabled={history.past.length === 0} onClick={() => step("undo")}>
              <Undo2 className="size-4" />
            </Button>
            <Button type="button" size="sm" variant="outline" aria-label="Redo" disabled={history.future.length === 0} onClick={() => step("redo")}>
              <Redo2 className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1" role="group" aria-label="Colour">
              {CONTENT_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  aria-label={c.name}
                  aria-pressed={color === c.hex}
                  onClick={() => setColor(c.hex)}
                  style={{ backgroundColor: c.hex }}
                  className={cn(
                    "size-6 rounded-full border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !reducedMotion && "transition-transform hover:scale-110",
                    color === c.hex && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                  )}
                />
              ))}
            </div>
            <label className="flex items-center gap-2">
              Stroke width
              <input type="range" min={MIN_STROKE_WIDTH} max={MAX_STROKE_WIDTH} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2">
              Rotation
              <input type="range" min={-MAX_ROTATION} max={MAX_ROTATION} value={state.rotation} onChange={(e) => rotateTo(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2">
              Text
              <input
                type="text"
                value={label}
                placeholder="Text"
                onChange={(e) => setLabel(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2"
              />
            </label>
          </div>

          <div className="flex justify-center rounded-md border border-border bg-muted p-2">
            {work && canvas ? (
              <Stage
                width={canvas.width * scale}
                height={canvas.height * scale}
                scaleX={scale}
                scaleY={scale}
                onMouseDown={onDown}
                onMouseMove={onMove}
                onMouseUp={onUp}
                onTouchStart={onDown}
                onTouchMove={onMove}
                onTouchEnd={onUp}
              >
                <Layer>
                  <KonvaImage
                    image={image}
                    x={canvas.width / 2}
                    y={canvas.height / 2}
                    width={work.width}
                    height={work.height}
                    offsetX={work.width / 2}
                    offsetY={work.height / 2}
                    rotation={state.rotation}
                  />
                  <Group>
                    {state.items.map(drawItem)}
                    {draft && !isCrop(draft) && drawItem(draft)}
                  </Group>
                  {crop && <Rect x={crop.x} y={crop.y} width={crop.width} height={crop.height} stroke={CROP_OUTLINE} strokeWidth={2} dash={[8, 4]} />}
                </Layer>
              </Stage>
            ) : (
              !failure && <p className="p-8 text-sm text-muted-foreground">Loading image…</p>
            )}
          </div>

          {failure && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
        </div>

        <DialogFooter>
          {state.crop && (
            <Button type="button" variant="ghost" onClick={() => commit({ ...state, crop: null })}>
              Clear crop
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!work || saving} onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImageAnnotatorModal;
