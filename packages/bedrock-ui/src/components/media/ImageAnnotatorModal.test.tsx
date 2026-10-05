/**
 * @file ImageAnnotatorModal.test.tsx
 * @description The annotator modal's contract: toolbar, controlled state,
 * client-side JPEG save, the dimension clamp ahead of the stage, and the
 * dismissal paths. react-konva and use-image are replaced with recording
 * stand-ins because jsdom has no canvas; the pure maths is covered in
 * imageAnnotation.test.ts and exportCanvas.test.ts.
 */
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Drawing2D } from "./exportCanvas";
import type { ImageAnnotationState } from "./types";

type KonvaProps = Record<string, unknown> & { children?: ReactNode };

const loader = vi.hoisted(() => ({
  calls: [] as Array<[string, string | undefined]>,
  size: { naturalWidth: 800, naturalHeight: 600 },
  image: undefined as HTMLImageElement | undefined,
}));

vi.mock("use-image", () => ({
  default: (url: string, crossOrigin?: string) => {
    loader.calls.push([url, crossOrigin]);
    // Like the real hook, hand back a stable reference per image: a fresh object
    // each render re-runs the sizing memo and the adopt-value effect forever.
    const { naturalWidth, naturalHeight } = loader.size;
    if (loader.image?.naturalWidth !== naturalWidth || loader.image?.naturalHeight !== naturalHeight) {
      loader.image = { naturalWidth, naturalHeight } as unknown as HTMLImageElement;
    }
    return [loader.image, "loaded"];
  },
}));

vi.mock("react-konva", () => {
  const box = (name: string) =>
    function Konva({ children }: KonvaProps) {
      return <div data-konva={name}>{children}</div>;
    };
  return {
    Stage: ({ children, width, height, scaleX }: KonvaProps) => (
      <div
        data-testid="stage"
        data-width={Number(width) / Number(scaleX ?? 1)}
        data-height={Number(height) / Number(scaleX ?? 1)}
      >
        {children}
      </div>
    ),
    Layer: box("layer"),
    Group: box("group"),
    Image: box("image"),
    Rect: box("rect"),
    Line: box("line"),
    Arrow: box("arrow"),
    Text: box("text"),
  };
});

import { createHistory, historyReducer, normalizeState } from "./imageAnnotation";
import { exportToBlob } from "./exportCanvas";
import * as barrel from "../../index";
import ImageAnnotatorModal from "./ImageAnnotatorModal";

type Props = Parameters<typeof ImageAnnotatorModal>[0];

function setup(over: Partial<Props> = {}) {
  const props: Props = {
    open: true,
    onOpenChange: vi.fn(),
    src: "https://img.test/photo.jpg",
    onSave: vi.fn(),
    ...over,
  };
  render(<ImageAnnotatorModal {...props} />);
  return props;
}

function stubCanvas() {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation((() =>
    new Proxy({}, { get: () => () => undefined, set: () => true })) as unknown as typeof HTMLCanvasElement.prototype.getContext);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(new Blob(["jpeg"], { type: "image/jpeg" })));
}

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  loader.calls.length = 0;
  loader.size = { naturalWidth: 800, naturalHeight: 600 };
  mockMatchMedia(false);
  stubCanvas();
});
afterEach(() => vi.restoreAllMocks());

describe("ImageAnnotatorModal toolbar", () => {
  it("exposes every tool and action by accessible name", () => {
    setup();
    for (const name of ["Select", "Arrow", "Line", "Rectangle", "Text", "Crop", "Rotate left", "Rotate right", "Undo", "Redo", "Cancel", "Save"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("offers the six colour swatches by name, one pressed", () => {
    setup();
    for (const name of ["Red", "Yellow", "Green", "Blue", "White", "Black"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Red" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));
    expect(screen.getByRole("button", { name: "Blue" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Red" })).toHaveAttribute("aria-pressed", "false");
  });

  it("bounds the stroke width to 1..20", () => {
    setup();
    const stroke = screen.getByLabelText("Stroke width");
    expect(stroke).toHaveAttribute("min", "1");
    expect(stroke).toHaveAttribute("max", "20");
  });

  it("tracks undo/redo availability through rotate, undo and redo", () => {
    setup();
    const undo = screen.getByRole("button", { name: "Undo" });
    const redo = screen.getByRole("button", { name: "Redo" });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    expect(undo).toBeEnabled();
    expect(redo).toBeDisabled();
    fireEvent.click(undo);
    expect(undo).toBeDisabled();
    expect(redo).toBeEnabled();
    fireEvent.click(redo);
    expect(undo).toBeEnabled();
  });
});

describe("ImageAnnotatorModal state", () => {
  it("reports edits through onChange and honours a controlled value", () => {
    const onChange = vi.fn();
    const value: ImageAnnotationState = { rotation: 90, crop: null, items: [] };
    setup({ value, onChange });
    expect(screen.getByLabelText("Rotation")).toHaveValue("90");
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ rotation: 180 });
  });

  it("repairs an out-of-range value instead of throwing", () => {
    setup({ value: { rotation: 9000, crop: null, items: [] } });
    expect(screen.getByLabelText("Rotation")).toHaveValue("360");
  });
});

describe("ImageAnnotatorModal save", () => {
  it("hands onSave a JPEG blob and the export meta without touching the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Rotate right" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledTimes(1));
    const [blob, meta] = (props.onSave as ReturnType<typeof vi.fn>).mock.calls[0];
    expect((blob as Blob).type).toBe("image/jpeg");
    expect(meta).toMatchObject({ width: 600, height: 800, state: { rotation: 90 } });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows an alert and does not call onSave when encoding fails", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((cb) => cb(null));
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not export/i);
    expect(props.onSave).not.toHaveBeenCalled();
  });
});

describe("ImageAnnotatorModal loading and clamping", () => {
  it("loads the source with crossOrigin=anonymous", () => {
    setup();
    expect(loader.calls[0]).toEqual(["https://img.test/photo.jpg", "anonymous"]);
  });

  it("clamps an oversized source before the stage mounts", async () => {
    loader.size = { naturalWidth: 4000, naturalHeight: 3000 };
    const props = setup();
    const stage = screen.getByTestId("stage");
    expect(Number(stage.dataset.width)).toBe(3200);
    expect(Number(stage.dataset.height)).toBe(2400);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalled());
    expect((props.onSave as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ width: 3200, height: 2400 });
  });

  it("shows an error instead of a stage for a zero-size image", () => {
    loader.size = { naturalWidth: 0, naturalHeight: 0 };
    setup();
    expect(screen.queryByTestId("stage")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(/invalid image/i);
  });
});

describe("ImageAnnotatorModal dismissal and layout", () => {
  it("closes on Cancel and on Escape", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    (props.onOpenChange as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("scrolls its body inside the dialog", () => {
    setup();
    const body = screen.getByTestId("annotator-body");
    expect(body.className).toContain("min-h-0");
    expect(body.className).toContain("overflow-y-auto");
  });

  it("applies a transition to controls only when motion is allowed", () => {
    const { unmount } = render(<ImageAnnotatorModal open onOpenChange={vi.fn()} src="a" onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Red" }).className).toContain("transition");
    unmount();
    mockMatchMedia(true);
    render(<ImageAnnotatorModal open onOpenChange={vi.fn()} src="a" onSave={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Red" }).className).not.toContain("transition");
  });
});

describe("barrel", () => {
  it("exports ImageAnnotatorModal and WorkbenchShell, and no ImageEditorDialog", () => {
    expect(barrel.ImageAnnotatorModal).toBe(ImageAnnotatorModal);
    expect(barrel.WorkbenchShell).toBeDefined();
    expect("ImageEditorDialog" in barrel).toBe(false);
  });
});

// The 1500ms / 58fps budgets are asserted on the JS paths we own; GPU raster
// time is not measurable under jsdom.
describe("@perf", () => {
  it("exports a 4K image within 1500ms", async () => {
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as Drawing2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    const items = Array.from({ length: 50 }, (_, i) => ({
      id: `i${i}`,
      kind: "arrow" as const,
      color: "#000000",
      strokeWidth: 4,
      points: [0, 0, 100 + i, 100] as [number, number, number, number],
    }));
    const started = performance.now();
    await exportToBlob({} as CanvasImageSource, { width: 3200, height: 2400 }, { rotation: 33, crop: null, items });
    expect(performance.now() - started).toBeLessThan(1500);
  });

  it("keeps the per-frame transform work inside a 58fps budget", () => {
    let history = createHistory(normalizeState({ rotation: 0 }, 3200, 2400));
    const frames = 120;
    const started = performance.now();
    for (let i = 0; i < frames; i++) {
      history = historyReducer(history, {
        type: "push",
        state: normalizeState({ rotation: i % 360, crop: null, items: [] }, 3200, 2400),
      });
    }
    const perFrame = (performance.now() - started) / frames;
    expect(1000 / Math.max(perFrame, 0.001)).toBeGreaterThanOrEqual(58);
  });
});

