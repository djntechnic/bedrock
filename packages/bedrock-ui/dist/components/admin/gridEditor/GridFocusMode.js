import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect } from "react";
import { Download, Save, Settings, X, GripVertical, Pin, PinOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/button.js";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../../ui/dialog.js";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs.js";
import { cn } from "../../../lib/utils.js";
import { usePersistedDisclosure, DISCLOSURE_KEY_PREFIX } from "../../../hooks/usePersistedDisclosure.js";
import { log } from "../../../utils/logger.js";
import GridPreview from "./GridPreview.js";
import GridSettingsPanel from "./GridSettingsPanel.js";
import CustomColumnsPanel from "./CustomColumnsPanel.js";
import GridColumnsPanel from "./GridColumnsPanel.js";
import { downloadGridConfigJson } from "./exportGridConfig.js";
import ImportGridConfigDialog from "./ImportGridConfigDialog.js";
const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 900;
const PANEL_DEFAULT_WIDTH = 440;
const WIDTH_STORAGE_KEY = `${DISCLOSURE_KEY_PREFIX}focus.settingsPanel.width`;
function readPanelWidth() {
  try {
    const raw = window.localStorage.getItem(WIDTH_STORAGE_KEY);
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed)) {
      return Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, parsed));
    }
  } catch {
  }
  return PANEL_DEFAULT_WIDTH;
}
function writePanelWidth(width) {
  try {
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(Math.round(width)));
  } catch {
  }
}
function GridFocusMode({
  open,
  onOpenChange,
  draft,
  gridId,
  gridLabel
}) {
  const [settingsOpen, setSettingsOpen] = usePersistedDisclosure(
    "focus.settingsPanel.open",
    true
  );
  const [settingsPinned, setSettingsPinned] = usePersistedDisclosure(
    "focus.settingsPanel.pinned",
    true
  );
  const [panelWidth, setPanelWidth] = useState(
    () => typeof window === "undefined" ? PANEL_DEFAULT_WIDTH : readPanelWidth()
  );
  const contentRef = useRef(null);
  const resizingPointerRef = useRef(null);
  const commitWidth = useCallback((next) => {
    const clamped = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, next));
    setPanelWidth(clamped);
    writePanelWidth(clamped);
  }, []);
  function handleOpenChange(next) {
    log.info(
      { gridId, action: next ? "focus.enter" : "focus.exit" },
      `GridFocusMode: ${next ? "entered" : "exited"}`
    );
    onOpenChange(next);
  }
  function handleSettingsToggle(next) {
    log.info(
      { gridId, action: "focus.settingsPanel.toggle", open: next },
      "GridFocusMode: settings panel toggled"
    );
    setSettingsOpen(next);
  }
  function handlePinToggle(next) {
    log.info(
      { gridId, action: "focus.settingsPanel.pinToggle", pinned: next },
      "GridFocusMode: settings panel pin toggled"
    );
    setSettingsPinned(next);
  }
  function handleResizePointerDown(event) {
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    resizingPointerRef.current = event.pointerId;
  }
  function handleResizePointerMove(event) {
    if (resizingPointerRef.current !== event.pointerId) return;
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return;
    commitWidth(rect.right - event.clientX);
  }
  function handleResizePointerUp(event) {
    if (resizingPointerRef.current !== event.pointerId) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
    }
    resizingPointerRef.current = null;
    log.info(
      { gridId, action: "focus.settingsPanel.resize", width: panelWidth },
      "GridFocusMode: settings panel resized"
    );
  }
  useEffect(() => {
    if (panelWidth < PANEL_MIN_WIDTH || panelWidth > PANEL_MAX_WIDTH) {
      commitWidth(panelWidth);
    }
  }, [panelWidth, commitWidth]);
  const columnIds = draft.draftColumns.map((c) => c.column_id);
  const showPanel = settingsOpen;
  return /* @__PURE__ */ jsx(Dialog, { open, onOpenChange: handleOpenChange, children: /* @__PURE__ */ jsxs(
    DialogContent,
    {
      showCloseButton: false,
      className: "w-screen h-screen max-w-none sm:max-w-none translate-x-0 translate-y-0 top-0 left-0 rounded-none p-0 gap-0 grid-rows-[auto_1fr] bg-background text-foreground",
      "aria-describedby": "grid-focus-desc",
      onInteractOutside: (e) => e.preventDefault(),
      onPointerDownOutside: (e) => e.preventDefault(),
      onEscapeKeyDown: (e) => {
        if (showPanel && !settingsPinned) {
          e.preventDefault();
          handleSettingsToggle(false);
        }
      },
      children: [
        /* @__PURE__ */ jsxs(DialogTitle, { className: "sr-only", children: [
          "Grid focus mode — ",
          gridLabel ?? gridId
        ] }),
        /* @__PURE__ */ jsx(DialogDescription, { id: "grid-focus-desc", className: "sr-only", children: "Full-viewport preview of the current grid. The settings panel on the right stays inline — resize it by dragging its left edge, collapse with the close button, or unpin so Escape can hide it. Press Escape to close focus mode." }),
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 border-b bg-background px-4 py-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsx("div", { className: "text-xs uppercase tracking-wide text-muted-foreground", children: "Focus mode" }),
            /* @__PURE__ */ jsx("div", { className: "truncate text-sm font-semibold", children: gridLabel ?? gridId })
          ] }),
          draft.isDirty && /* @__PURE__ */ jsx("span", { className: "text-xs text-amber-600 dark:text-amber-400", children: "Unsaved changes" }),
          /* @__PURE__ */ jsxs(
            Button,
            {
              type: "button",
              variant: "outline",
              size: "sm",
              className: "gap-1.5",
              disabled: !draft.draftGrid,
              onClick: () => {
                if (!draft.draftGrid) return;
                try {
                  downloadGridConfigJson(draft.draftGrid, draft.draftColumns);
                  toast.success("Grid config exported");
                } catch (error) {
                  log.error(
                    { err: error, gridId, action: "focus.export.json.error" },
                    "GridFocusMode: export failed"
                  );
                  toast.error("Failed to export grid config");
                }
              },
              "aria-label": "Export grid config as JSON",
              children: [
                /* @__PURE__ */ jsx(Download, { className: "h-3.5 w-3.5" }),
                " Export JSON"
              ]
            }
          ),
          /* @__PURE__ */ jsx(
            ImportGridConfigDialog,
            {
              gridId,
              draftGrid: draft.draftGrid,
              draftColumns: draft.draftColumns,
              onApply: draft.applyImportedConfig,
              disabled: !draft.draftGrid
            }
          ),
          /* @__PURE__ */ jsxs(
            Button,
            {
              type: "button",
              size: "sm",
              className: "gap-1.5",
              disabled: !draft.isDirty || draft.isSaving,
              onClick: async () => {
                if (!draft.isDirty || draft.isSaving) return;
                try {
                  await draft.save();
                  toast.success("Grid settings saved");
                  log.info(
                    { gridId, action: "focus.save.success" },
                    "GridFocusMode: save complete"
                  );
                } catch (error) {
                  toast.error("Failed to save grid settings");
                  log.error(
                    { err: error, gridId, action: "focus.save.error" },
                    "GridFocusMode: save failed"
                  );
                }
              },
              "aria-label": "Save grid settings",
              children: [
                /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
                draft.isSaving ? "Saving…" : "Save"
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            Button,
            {
              type: "button",
              variant: showPanel ? "default" : "outline",
              size: "sm",
              className: "gap-1.5",
              onClick: () => handleSettingsToggle(!showPanel),
              "aria-label": showPanel ? "Hide settings panel" : "Show settings panel",
              "aria-expanded": showPanel,
              "data-testid": "focus-settings-toggle",
              children: [
                /* @__PURE__ */ jsx(Settings, { className: "h-3.5 w-3.5" }),
                showPanel ? "Hide settings" : "Settings"
              ]
            }
          ),
          /* @__PURE__ */ jsxs(
            Button,
            {
              type: "button",
              variant: "ghost",
              size: "sm",
              className: "gap-1.5",
              onClick: () => handleOpenChange(false),
              "aria-label": "Exit focus mode",
              children: [
                /* @__PURE__ */ jsx(X, { className: "h-3.5 w-3.5" }),
                " Exit focus"
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { ref: contentRef, className: "flex min-h-0 flex-1 flex-row overflow-hidden", children: [
          /* @__PURE__ */ jsx("div", { className: "min-w-0 flex-1 flex flex-col h-full min-h-0 overflow-hidden p-4", children: draft.draftConfig && /* @__PURE__ */ jsx(
            GridPreview,
            {
              config: draft.draftConfig,
              onColumnReorder: draft.reorderColumns
            }
          ) }),
          showPanel && /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(
              "div",
              {
                role: "separator",
                "aria-orientation": "vertical",
                "aria-label": "Resize settings panel",
                "aria-valuemin": PANEL_MIN_WIDTH,
                "aria-valuemax": PANEL_MAX_WIDTH,
                "aria-valuenow": Math.round(panelWidth),
                tabIndex: 0,
                onPointerDown: handleResizePointerDown,
                onPointerMove: handleResizePointerMove,
                onPointerUp: handleResizePointerUp,
                onPointerCancel: handleResizePointerUp,
                onKeyDown: (e) => {
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    commitWidth(panelWidth + 24);
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    commitWidth(panelWidth - 24);
                  }
                },
                className: cn(
                  "group relative w-1 shrink-0 cursor-col-resize select-none touch-none bg-border/60 hover:bg-primary/60 focus-visible:bg-primary transition-colors"
                ),
                "data-testid": "focus-settings-resize-handle",
                children: /* @__PURE__ */ jsx(
                  "span",
                  {
                    "aria-hidden": "true",
                    className: "absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity",
                    children: /* @__PURE__ */ jsx(GripVertical, { className: "h-3 w-3 text-muted-foreground" })
                  }
                )
              }
            ),
            /* @__PURE__ */ jsxs(
              "aside",
              {
                className: "flex min-h-0 shrink-0 flex-col border-l bg-background",
                style: { width: `${panelWidth}px` },
                "aria-label": "Grid configuration panel",
                "data-testid": "focus-settings-panel",
                children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2 border-b px-3 py-2", children: [
                    /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold", children: "Grid configuration" }),
                    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
                      /* @__PURE__ */ jsx(
                        Button,
                        {
                          type: "button",
                          variant: "ghost",
                          size: "sm",
                          className: "h-7 w-7 p-0",
                          onClick: () => handlePinToggle(!settingsPinned),
                          "aria-label": settingsPinned ? "Unpin settings panel (Escape will collapse it)" : "Pin settings panel open",
                          "aria-pressed": settingsPinned,
                          "data-testid": "focus-settings-pin",
                          children: settingsPinned ? /* @__PURE__ */ jsx(Pin, { className: "h-3.5 w-3.5" }) : /* @__PURE__ */ jsx(PinOff, { className: "h-3.5 w-3.5" })
                        }
                      ),
                      /* @__PURE__ */ jsx(
                        Button,
                        {
                          type: "button",
                          variant: "ghost",
                          size: "sm",
                          className: "h-7 w-7 p-0",
                          onClick: () => handleSettingsToggle(false),
                          "aria-label": "Collapse settings panel",
                          "data-testid": "focus-settings-close",
                          children: /* @__PURE__ */ jsx(X, { className: "h-3.5 w-3.5" })
                        }
                      )
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-auto p-4", children: draft.draftGrid && /* @__PURE__ */ jsxs(Tabs, { defaultValue: "grid", className: "w-full", children: [
                    /* @__PURE__ */ jsxs(TabsList, { className: "grid w-full grid-cols-3", children: [
                      /* @__PURE__ */ jsx(TabsTrigger, { value: "grid", children: "Grid" }),
                      /* @__PURE__ */ jsx(TabsTrigger, { value: "custom", children: "Custom" }),
                      /* @__PURE__ */ jsx(TabsTrigger, { value: "columns", children: "Columns" })
                    ] }),
                    /* @__PURE__ */ jsx(TabsContent, { value: "grid", className: "mt-3", children: /* @__PURE__ */ jsx(
                      GridSettingsPanel,
                      {
                        draftGrid: draft.draftGrid,
                        columnIds,
                        setGridField: draft.setGridField
                      }
                    ) }),
                    /* @__PURE__ */ jsx(TabsContent, { value: "custom", className: "mt-3", children: /* @__PURE__ */ jsx(
                      CustomColumnsPanel,
                      {
                        draftGrid: draft.draftGrid,
                        setGridField: draft.setGridField
                      }
                    ) }),
                    /* @__PURE__ */ jsx(TabsContent, { value: "columns", className: "mt-3", children: /* @__PURE__ */ jsx(
                      GridColumnsPanel,
                      {
                        draftColumns: draft.draftColumns,
                        draftGrid: draft.draftGrid,
                        setColumnField: draft.setColumnField,
                        gridId,
                        insertColumn: draft.insertColumn,
                        removeColumn: draft.removeColumn,
                        columnLifecycle: draft.columnLifecycle
                      }
                    ) })
                  ] }) })
                ]
              }
            )
          ] })
        ] })
      ]
    }
  ) });
}
export {
  GridFocusMode as default
};
//# sourceMappingURL=GridFocusMode.js.map
