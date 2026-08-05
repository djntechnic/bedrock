/**
 * @file GridFocusMode.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Full-viewport focus mode. Wraps <GridPreview> in a shadcn Dialog
 *              (size-full override) and exposes an INLINE right-side settings
 *              panel that is collapsible, pinnable and resizeable — replacing
 *              the older modal Sheet drawer that dimmed/blurred the live
 *              preview whenever an admin opened it.
 *
 *              Panel state (open/pinned/width) is persisted to localStorage so
 *              opening focus mode restores the admin's last layout. Every
 *              transition emits a structured Pino log so support can
 *              reconstruct the admin's session from the log stream.
 *
 *              Keyboard: `Esc` exits focus mode when the panel is pinned; when
 *              unpinned it collapses the panel first, then a second `Esc` exits.
 */

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Settings, X, Pin, PinOff, GripVertical, Save, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../../ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs";
import { cn } from "../../../lib/utils";
import {
  DISCLOSURE_KEY_PREFIX,
  usePersistedDisclosure,
} from "../../../hooks/usePersistedDisclosure";
import { log } from "../../../utils/logger";
import type { GridDraft } from "./useGridDraft";
import GridPreview from "./GridPreview";
import GridSettingsPanel from "./GridSettingsPanel";
import CustomColumnsPanel from "./CustomColumnsPanel";
import GridColumnsPanel from "./GridColumnsPanel";
import { downloadGridConfigJson } from "./exportGridConfig";
import ImportGridConfigDialog from "./ImportGridConfigDialog";

interface GridFocusModeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: GridDraft;
  gridId: string;
  gridLabel?: string;
}

const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 900;
const PANEL_DEFAULT_WIDTH = 440;
const WIDTH_STORAGE_KEY = `${DISCLOSURE_KEY_PREFIX}focus.settingsPanel.width`;

function readPanelWidth(): number {
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed)) {
      return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, parsed));
    }
  } catch {
    /* private mode / SSR */
  }
  return PANEL_DEFAULT_WIDTH;
}

function writePanelWidth(width: number) {
  try {
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(width)));
  } catch {
    /* private mode / SSR */
  }
}

export default function GridFocusMode({
  open,
  onOpenChange,
  draft,
  gridId,
  gridLabel,
}: GridFocusModeProps) {
  const [settingsOpen, setSettingsOpen] = usePersistedDisclosure(
    "focus.settingsPanel.open",
    true,
  );
  const [settingsPinned, setSettingsPinned] = usePersistedDisclosure(
    "focus.settingsPanel.pinned",
    true,
  );
  const [panelWidth, setPanelWidth] = useState<number>(() =>
    typeof window === "undefined" ? PANEL_DEFAULT_WIDTH : readPanelWidth(),
  );

  const contentRef = useRef<HTMLDivElement | null>(null);
  const resizingPointerRef = useRef<number | null>(null);

  const commitWidth = useCallback((next: number) => {
    const clamped = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, next));
    setPanelWidth(clamped);
    writePanelWidth(clamped);
  }, []);

  function handleOpenChange(next: boolean) {
    log.info(
      { gridId, action: next ? "focus.enter" : "focus.exit" },
      `GridFocusMode: ${next ? "entered" : "exited"}`,
    );
    onOpenChange(next);
  }

  function handleSettingsToggle(next: boolean) {
    log.info(
      { gridId, action: "focus.settingsPanel.toggle", open: next },
      "GridFocusMode: settings panel toggled",
    );
    setSettingsOpen(next);
  }

  function handlePinToggle(next: boolean) {
    log.info(
      { gridId, action: "focus.settingsPanel.pinToggle", pinned: next },
      "GridFocusMode: settings panel pin toggled",
    );
    setSettingsPinned(next);
  }

  function handleResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    resizingPointerRef.current = event.pointerId;
  }

  function handleResizePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (resizingPointerRef.current !== event.pointerId) return;
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Panel is anchored to the right — its width equals the horizontal
    // distance from the pointer to the right edge of the focus container.
    commitWidth(rect.right - event.clientX);
  }

  function handleResizePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (resizingPointerRef.current !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* pointer already released */
    }
    resizingPointerRef.current = null;
    log.info(
      { gridId, action: "focus.settingsPanel.resize", width: panelWidth },
      "GridFocusMode: settings panel resized",
    );
  }

  // Snap width back inside bounds if the config-driven min/max change.
  useEffect(() => {
    if (panelWidth < PANEL_MIN_WIDTH || panelWidth > PANEL_MAX_WIDTH) {
      commitWidth(panelWidth);
    }
  }, [panelWidth, commitWidth]);

  const columnIds = draft.draftColumns.map((c) => c.column_id);
  const showPanel = settingsOpen;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-screen h-screen max-w-none sm:max-w-none translate-x-0 translate-y-0 top-0 left-0 rounded-none p-0 gap-0 grid-rows-[auto_1fr] bg-background text-foreground"
        aria-describedby="grid-focus-desc"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          // Unpinned + open panel: Esc collapses the panel first so admins
          // can quickly reclaim the full preview canvas without leaving
          // focus mode. Pinned: Esc always exits focus.
          if (showPanel && !settingsPinned) {
            e.preventDefault();
            handleSettingsToggle(false);
          }
        }}
      >
        <DialogTitle className="sr-only">
          Grid focus mode — {gridLabel ?? gridId}
        </DialogTitle>
        <DialogDescription id="grid-focus-desc" className="sr-only">
          Full-viewport preview of the current grid. The settings panel on the
          right stays inline — resize it by dragging its left edge, collapse
          with the close button, or unpin so Escape can hide it. Press Escape
          to close focus mode.
        </DialogDescription>

        {/* ── Slim toolbar ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 border-b bg-background px-4 py-2">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Focus mode
            </div>
            <div className="truncate text-sm font-semibold">
              {gridLabel ?? gridId}
            </div>
          </div>
          {draft.isDirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Unsaved changes
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!draft.draftGrid}
            onClick={() => {
              if (!draft.draftGrid) return;
              try {
                downloadGridConfigJson(draft.draftGrid, draft.draftColumns);
                toast.success("Grid config exported");
              } catch (error) {
                log.error(
                  { err: error, gridId, action: "focus.export.json.error" },
                  "GridFocusMode: export failed",
                );
                toast.error("Failed to export grid config");
              }
            }}
            aria-label="Export grid config as JSON"
          >
            <Download className="h-3.5 w-3.5" /> Export JSON
          </Button>
          <ImportGridConfigDialog
            gridId={gridId}
            draftGrid={draft.draftGrid}
            draftColumns={draft.draftColumns}
            onApply={draft.applyImportedConfig}
            disabled={!draft.draftGrid}
          />
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={!draft.isDirty || draft.isSaving}
            onClick={async () => {
              if (!draft.isDirty || draft.isSaving) return;
              try {
                await draft.save();
                toast.success("Grid settings saved");
                log.info(
                  { gridId, action: "focus.save.success" },
                  "GridFocusMode: save complete",
                );
              } catch (error) {
                toast.error("Failed to save grid settings");
                log.error(
                  { err: error, gridId, action: "focus.save.error" },
                  "GridFocusMode: save failed",
                );
              }
            }}
            aria-label="Save grid settings"
          >
            <Save className="h-3.5 w-3.5" />
            {draft.isSaving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant={showPanel ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => handleSettingsToggle(!showPanel)}
            aria-label={showPanel ? "Hide settings panel" : "Show settings panel"}
            aria-expanded={showPanel}
            data-testid="focus-settings-toggle"
          >
            <Settings className="h-3.5 w-3.5" />
            {showPanel ? "Hide settings" : "Settings"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => handleOpenChange(false)}
            aria-label="Exit focus mode"
          >
            <X className="h-3.5 w-3.5" /> Exit focus
          </Button>
        </div>

        {/* ── Split canvas: preview + inline settings panel ───────────────── */}
        <div ref={contentRef} className="flex min-h-0 flex-1 flex-row overflow-hidden">
          {/* Preview keeps the flex-grown remainder — never dimmed, never
              hidden behind an overlay. */}
          <div className="min-w-0 flex-1 flex flex-col h-full min-h-0 overflow-hidden p-4">
            {draft.draftConfig && (
              <GridPreview
                config={draft.draftConfig}
                onColumnReorder={draft.reorderColumns}
              />
            )}
          </div>

          {showPanel && (
            <>
              {/* Resize handle — pointer capture keeps the drag alive even
                  when the pointer briefly leaves the 4-px hit target. */}
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize settings panel"
                aria-valuemin={PANEL_MIN_WIDTH}
                aria-valuemax={PANEL_MAX_WIDTH}
                aria-valuenow={Math.round(panelWidth)}
                tabIndex={0}
                onPointerDown={handleResizePointerDown}
                onPointerMove={handleResizePointerMove}
                onPointerUp={handleResizePointerUp}
                onPointerCancel={handleResizePointerUp}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    commitWidth(panelWidth + 24);
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    commitWidth(panelWidth - 24);
                  }
                }}
                className={cn(
                  "group relative w-1 shrink-0 cursor-col-resize select-none touch-none bg-border/60 hover:bg-primary/60 focus-visible:bg-primary transition-colors",
                )}
                data-testid="focus-settings-resize-handle"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                </span>
              </div>

              <aside
                className="flex min-h-0 shrink-0 flex-col border-l bg-background"
                style={{ width: `${panelWidth}px` }}
                aria-label="Grid configuration panel"
                data-testid="focus-settings-panel"
              >
                <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                  <div className="text-sm font-semibold">Grid configuration</div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handlePinToggle(!settingsPinned)}
                      aria-label={
                        settingsPinned
                          ? "Unpin settings panel (Escape will collapse it)"
                          : "Pin settings panel open"
                      }
                      aria-pressed={settingsPinned}
                      data-testid="focus-settings-pin"
                    >
                      {settingsPinned ? (
                        <Pin className="h-3.5 w-3.5" />
                      ) : (
                        <PinOff className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleSettingsToggle(false)}
                      aria-label="Collapse settings panel"
                      data-testid="focus-settings-close"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4">
                  {draft.draftGrid && (
                    <Tabs defaultValue="grid" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="grid">Grid</TabsTrigger>
                        <TabsTrigger value="custom">Custom</TabsTrigger>
                        <TabsTrigger value="columns">Columns</TabsTrigger>
                      </TabsList>
                      <TabsContent value="grid" className="mt-3">
                        <GridSettingsPanel
                          draftGrid={draft.draftGrid}
                          columnIds={columnIds}
                          setGridField={draft.setGridField}
                        />
                      </TabsContent>
                      <TabsContent value="custom" className="mt-3">
                        <CustomColumnsPanel
                          draftGrid={draft.draftGrid}
                          setGridField={draft.setGridField}
                        />
                      </TabsContent>
                      <TabsContent value="columns" className="mt-3">
                        <GridColumnsPanel
                          draftColumns={draft.draftColumns}
                          draftGrid={draft.draftGrid}
                          setColumnField={draft.setColumnField}
                          gridId={gridId}
                          insertColumn={draft.insertColumn}
                          removeColumn={draft.removeColumn}
                          columnLifecycle={draft.columnLifecycle}
                        />
                      </TabsContent>
                    </Tabs>
                  )}
                </div>
              </aside>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
