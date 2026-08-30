import { jsxs, jsx } from "react/jsx-runtime";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Download, Maximize2, RotateCcw, Save, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, Star, Columns3 } from "lucide-react";
import { Button } from "../../ui/button.js";
import { Label } from "../../ui/label.js";
import { Badge } from "../../ui/badge.js";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../ui/select.js";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs.js";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "../../ui/alert-dialog.js";
import { cn } from "../../../lib/utils.js";
import { useGridPages, useGridSettings } from "../../../hooks/useAdminPlatform.js";
import { usePersistedDisclosure } from "../../../hooks/usePersistedDisclosure.js";
import { log } from "../../../utils/logger.js";
import { useGridDraft } from "./useGridDraft.js";
import GridPreview from "./GridPreview.js";
import GridSettingsPanel from "./GridSettingsPanel.js";
import GridColumnsPanel from "./GridColumnsPanel.js";
import CustomColumnsPanel from "./CustomColumnsPanel.js";
import GridFocusMode from "./GridFocusMode.js";
import { downloadGridConfigJson } from "./exportGridConfig.js";
import ImportGridConfigDialog from "./ImportGridConfigDialog.js";
const ALL_SCREENS = "__all__";
function GridEditor({ initialGridId = null } = {}) {
  const { data: pagesData } = useGridPages();
  const { data: gridsData } = useGridSettings();
  const pages = pagesData?.data ?? [];
  const grids = useMemo(() => gridsData?.data ?? [], [gridsData]);
  const [selectedPage, setSelectedPage] = useState(ALL_SCREENS);
  const [selectedGridId, setSelectedGridId] = useState(initialGridId);
  const [activeTab, setActiveTab] = useState("grid");
  const [leftPanelOpen, setLeftPanelOpen] = usePersistedDisclosure(
    "leftPanelOpen",
    true
  );
  const [focusOpen, setFocusOpen] = useState(false);
  const [pendingScreen, setPendingScreen] = useState(null);
  const [gridSelectOpen, setGridSelectOpen] = useState(false);
  const gridSelectTriggerRef = useRef(null);
  useEffect(() => {
    log.info({ component: "GridEditor", action: "mount" }, "GridEditor: mounted");
    return () => {
      log.info({ component: "GridEditor", action: "unmount" }, "GridEditor: unmounted");
    };
  }, []);
  const visibleGrids = useMemo(
    () => selectedPage === ALL_SCREENS ? grids : grids.filter((g) => (g.page ?? null) === selectedPage),
    [grids, selectedPage]
  );
  useEffect(() => {
    if (selectedGridId && !visibleGrids.some((g) => g.grid_id === selectedGridId)) {
      setSelectedGridId(null);
    }
  }, [visibleGrids, selectedGridId]);
  const draft = useGridDraft(selectedGridId);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const columnIds = useMemo(
    () => draft.draftColumns.map((c) => c.column_id),
    [draft.draftColumns]
  );
  const gridLabel = useMemo(
    () => grids.find((g) => g.grid_id === selectedGridId)?.grid_label,
    [grids, selectedGridId]
  );
  const handleSave = useCallback(async () => {
    const d = draftRef.current;
    if (!d.isDirty || d.isSaving) return;
    try {
      await d.save();
      toast.success("Grid settings saved");
      log.info(
        { gridId: selectedGridId, action: "save.success" },
        "GridEditor: save complete"
      );
    } catch (error) {
      toast.error("Failed to save grid settings");
      log.error(
        { err: error, gridId: selectedGridId, action: "save.error" },
        "GridEditor: save failed"
      );
    }
  }, [selectedGridId]);
  function commitScreenChange(v) {
    setSelectedPage(v);
    const matchingGrids = v === ALL_SCREENS ? grids : grids.filter((g) => (g.page ?? null) === v);
    if (matchingGrids.length === 1) {
      setSelectedGridId(matchingGrids[0].grid_id);
      setGridSelectOpen(false);
    } else {
      setSelectedGridId(null);
      if (matchingGrids.length > 1) {
        setTimeout(() => {
          gridSelectTriggerRef.current?.focus();
          setGridSelectOpen(true);
        }, 50);
      }
    }
    log.info(
      { component: "GridEditor", action: "select-screen", page: v },
      "GridEditor: screen selected"
    );
  }
  function handleScreenChange(v) {
    if (draftRef.current.isDirty) {
      setPendingScreen(v);
      log.info(
        { component: "GridEditor", action: "exit-guard.open", intent: "screen-change" },
        "GridEditor: exit guard shown"
      );
    } else {
      commitScreenChange(v);
    }
  }
  function handleGridChange(v) {
    setSelectedGridId(v);
    log.info({ gridId: v, action: "select-grid" }, "GridEditor: grid selected");
  }
  useEffect(() => {
    function onKey(e) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSave();
        return;
      }
      const target = e.target;
      const inField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (!inField && !isMod && (e.key === "f" || e.key === "F")) {
        if (selectedGridId && draftRef.current.isLoaded) {
          e.preventDefault();
          setFocusOpen((v) => !v);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedGridId, handleSave]);
  useEffect(() => {
    function onBeforeUnload(e) {
      if (!draftRef.current.isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
  const emptyBody = !selectedGridId ? "Select a screen and grid to begin editing." : !draft.isLoaded || !draft.draftGrid || !draft.draftConfig ? "Loading grid configuration…" : null;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "flex flex-col bg-background text-foreground border rounded-lg overflow-hidden",
      style: { minHeight: "calc(100vh - 220px)" },
      "data-testid": "grid-editor-shell",
      children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-end gap-3 border-b bg-muted/20 px-3 py-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsx(Label, { className: "text-[11px] text-muted-foreground", children: "Screen" }),
            /* @__PURE__ */ jsxs(Select, { value: selectedPage, onValueChange: handleScreenChange, children: [
              /* @__PURE__ */ jsx(SelectTrigger, { size: "sm", className: "w-52", "aria-label": "Screen", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
              /* @__PURE__ */ jsxs(SelectContent, { children: [
                /* @__PURE__ */ jsx(SelectItem, { value: ALL_SCREENS, children: "All screens" }),
                pages.map((p) => /* @__PURE__ */ jsx(SelectItem, { value: p, children: p }, p))
              ] })
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
            /* @__PURE__ */ jsx(Label, { className: "text-[11px] text-muted-foreground", children: "Grid" }),
            /* @__PURE__ */ jsxs(
              Select,
              {
                value: selectedGridId ?? "",
                onValueChange: (v) => {
                  handleGridChange(v);
                  setGridSelectOpen(false);
                },
                open: gridSelectOpen,
                onOpenChange: setGridSelectOpen,
                children: [
                  /* @__PURE__ */ jsx(SelectTrigger, { ref: gridSelectTriggerRef, size: "sm", className: "w-64", "aria-label": "Grid", children: /* @__PURE__ */ jsx(SelectValue, { placeholder: "Select a grid…" }) }),
                  /* @__PURE__ */ jsx(SelectContent, { children: visibleGrids.map((g) => /* @__PURE__ */ jsx(SelectItem, { value: g.grid_id, children: g.grid_label }, g.grid_id)) })
                ]
              }
            )
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "ml-auto flex items-center gap-2", children: [
            draft.isDirty && /* @__PURE__ */ jsxs(Badge, { variant: "outline", className: "gap-1.5 text-amber-600 dark:text-amber-400 border-amber-400/50", children: [
              /* @__PURE__ */ jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-amber-500" }),
              "Unsaved changes"
            ] }),
            /* @__PURE__ */ jsxs(
              Button,
              {
                type: "button",
                variant: "outline",
                size: "sm",
                className: "gap-1.5",
                disabled: !selectedGridId || !draft.isLoaded || !draft.draftGrid,
                onClick: () => {
                  if (!draft.draftGrid) return;
                  try {
                    downloadGridConfigJson(draft.draftGrid, draft.draftColumns);
                    toast.success("Grid config exported");
                  } catch (error) {
                    log.error(
                      { err: error, gridId: selectedGridId, action: "export.json.error" },
                      "GridEditor: export failed"
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
                gridId: selectedGridId,
                draftGrid: draft.draftGrid,
                draftColumns: draft.draftColumns,
                onApply: draft.applyImportedConfig,
                disabled: !selectedGridId || !draft.isLoaded || !draft.draftGrid
              }
            ),
            /* @__PURE__ */ jsxs(
              Button,
              {
                type: "button",
                variant: "outline",
                size: "sm",
                className: "gap-1.5",
                disabled: !selectedGridId || !draft.isLoaded,
                onClick: () => {
                  log.info(
                    { gridId: selectedGridId, action: "focus.enter" },
                    "GridEditor: focus mode requested"
                  );
                  setFocusOpen(true);
                },
                "aria-label": "Enter focus mode",
                children: [
                  /* @__PURE__ */ jsx(Maximize2, { className: "h-3.5 w-3.5" }),
                  " Focus"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              Button,
              {
                variant: "outline",
                size: "sm",
                disabled: !draft.isDirty || draft.isSaving,
                onClick: draft.reset,
                className: "gap-1.5",
                children: [
                  /* @__PURE__ */ jsx(RotateCcw, { className: "h-3.5 w-3.5" }),
                  " Cancel"
                ]
              }
            ),
            /* @__PURE__ */ jsxs(
              Button,
              {
                size: "sm",
                disabled: !draft.isDirty || draft.isSaving,
                onClick: handleSave,
                className: "gap-1.5",
                children: [
                  /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
                  draft.isSaving ? "Saving…" : "Save"
                ]
              }
            )
          ] })
        ] }),
        emptyBody ? /* @__PURE__ */ jsx("div", { className: "flex-1 flex items-center justify-center p-8", children: /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: emptyBody }) }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-1 overflow-hidden", children: [
          /* @__PURE__ */ jsxs(
            "div",
            {
              className: cn(
                "flex flex-col border-r bg-background transition-all duration-200 overflow-hidden",
                leftPanelOpen ? "w-[360px]" : "w-12"
              ),
              "data-testid": "grid-editor-left-panel",
              "data-open": leftPanelOpen,
              children: [
                /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between border-b px-2 py-1.5", children: [
                  /* @__PURE__ */ jsx(
                    Button,
                    {
                      type: "button",
                      variant: "ghost",
                      size: "icon-sm",
                      onClick: () => setLeftPanelOpen(!leftPanelOpen),
                      "aria-label": leftPanelOpen ? "Collapse left panel" : "Expand left panel",
                      "data-testid": "left-panel-toggle",
                      children: leftPanelOpen ? /* @__PURE__ */ jsx(PanelLeftClose, { className: "h-4 w-4" }) : /* @__PURE__ */ jsx(PanelLeftOpen, { className: "h-4 w-4" })
                    }
                  ),
                  leftPanelOpen && /* @__PURE__ */ jsx("span", { className: "text-[11px] uppercase tracking-wide text-muted-foreground", children: "Configuration" })
                ] }),
                leftPanelOpen ? /* @__PURE__ */ jsxs(
                  Tabs,
                  {
                    value: activeTab,
                    onValueChange: (v) => {
                      setActiveTab(v);
                      log.info(
                        { component: "GridEditor", action: "tab.change", tab: v },
                        "GridEditor: tab changed"
                      );
                    },
                    className: "flex-1 flex flex-col overflow-hidden",
                    children: [
                      /* @__PURE__ */ jsx("div", { className: "px-2 pt-2", children: /* @__PURE__ */ jsxs(TabsList, { className: "grid w-full grid-cols-3", children: [
                        /* @__PURE__ */ jsxs(TabsTrigger, { value: "grid", className: "gap-1", children: [
                          /* @__PURE__ */ jsx(SlidersHorizontal, { className: "h-3.5 w-3.5" }),
                          " Grid"
                        ] }),
                        /* @__PURE__ */ jsxs(TabsTrigger, { value: "custom", className: "gap-1", children: [
                          /* @__PURE__ */ jsx(Star, { className: "h-3.5 w-3.5" }),
                          " Custom"
                        ] }),
                        /* @__PURE__ */ jsxs(TabsTrigger, { value: "columns", className: "gap-1", children: [
                          /* @__PURE__ */ jsx(Columns3, { className: "h-3.5 w-3.5" }),
                          " Columns"
                        ] })
                      ] }) }),
                      /* @__PURE__ */ jsxs("div", { className: "flex-1 overflow-auto p-2", children: [
                        /* @__PURE__ */ jsx(TabsContent, { value: "grid", className: "mt-0", children: draft.draftGrid && /* @__PURE__ */ jsx(
                          GridSettingsPanel,
                          {
                            draftGrid: draft.draftGrid,
                            columnIds,
                            setGridField: draft.setGridField
                          }
                        ) }),
                        /* @__PURE__ */ jsx(TabsContent, { value: "custom", className: "mt-0", children: draft.draftGrid && /* @__PURE__ */ jsx(
                          CustomColumnsPanel,
                          {
                            draftGrid: draft.draftGrid,
                            setGridField: draft.setGridField
                          }
                        ) }),
                        /* @__PURE__ */ jsx(TabsContent, { value: "columns", className: "mt-0", children: /* @__PURE__ */ jsx(
                          GridColumnsPanel,
                          {
                            draftColumns: draft.draftColumns,
                            draftGrid: draft.draftGrid,
                            setColumnField: draft.setColumnField,
                            gridId: selectedGridId,
                            insertColumn: draft.insertColumn,
                            removeColumn: draft.removeColumn,
                            columnLifecycle: draft.columnLifecycle
                          }
                        ) })
                      ] })
                    ]
                  }
                ) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center gap-2 py-2", children: [
                  /* @__PURE__ */ jsx(
                    IconRibbonButton,
                    {
                      active: activeTab === "grid",
                      onClick: () => {
                        setActiveTab("grid");
                        setLeftPanelOpen(true);
                      },
                      label: "Grid settings",
                      children: /* @__PURE__ */ jsx(SlidersHorizontal, { className: "h-4 w-4" })
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    IconRibbonButton,
                    {
                      active: activeTab === "custom",
                      onClick: () => {
                        setActiveTab("custom");
                        setLeftPanelOpen(true);
                      },
                      label: "Custom columns",
                      children: /* @__PURE__ */ jsx(Star, { className: "h-4 w-4" })
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    IconRibbonButton,
                    {
                      active: activeTab === "columns",
                      onClick: () => {
                        setActiveTab("columns");
                        setLeftPanelOpen(true);
                      },
                      label: "Column settings",
                      children: /* @__PURE__ */ jsx(Columns3, { className: "h-4 w-4" })
                    }
                  )
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsx("div", { className: "flex-1 flex flex-col h-full min-h-0 overflow-hidden p-4", children: draft.draftConfig && /* @__PURE__ */ jsx(
            GridPreview,
            {
              config: draft.draftConfig,
              onEnterFocus: () => setFocusOpen(true),
              onColumnReorder: draft.reorderColumns
            }
          ) })
        ] }),
        selectedGridId && draft.isLoaded && /* @__PURE__ */ jsx(
          GridFocusMode,
          {
            open: focusOpen,
            onOpenChange: setFocusOpen,
            draft,
            gridId: selectedGridId,
            gridLabel
          }
        ),
        /* @__PURE__ */ jsx(
          AlertDialog,
          {
            open: pendingScreen !== null,
            onOpenChange: (v) => {
              if (!v) setPendingScreen(null);
            },
            children: /* @__PURE__ */ jsxs(AlertDialogContent, { children: [
              /* @__PURE__ */ jsxs(AlertDialogHeader, { children: [
                /* @__PURE__ */ jsx(AlertDialogTitle, { children: "Discard unsaved changes?" }),
                /* @__PURE__ */ jsx(AlertDialogDescription, { children: "Changing the screen filter will drop the edits you've made to this grid." })
              ] }),
              /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [
                /* @__PURE__ */ jsx(
                  AlertDialogCancel,
                  {
                    onClick: () => {
                      log.info(
                        { component: "GridEditor", action: "exit-guard.cancel" },
                        "GridEditor: exit guard cancelled"
                      );
                      setPendingScreen(null);
                    },
                    children: "Keep editing"
                  }
                ),
                /* @__PURE__ */ jsx(
                  AlertDialogAction,
                  {
                    variant: "destructive",
                    onClick: () => {
                      if (pendingScreen !== null) {
                        log.info(
                          { component: "GridEditor", action: "exit-guard.discard" },
                          "GridEditor: discarding draft on screen change"
                        );
                        draftRef.current.reset();
                        commitScreenChange(pendingScreen);
                      }
                      setPendingScreen(null);
                    },
                    children: "Discard"
                  }
                )
              ] })
            ] })
          }
        )
      ]
    }
  );
}
function IconRibbonButton({ active, onClick, label, children }) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick,
      "aria-label": label,
      title: label,
      className: cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-muted text-foreground"
      ),
      children
    }
  );
}
export {
  GridEditor as default
};
//# sourceMappingURL=GridEditor.js.map
