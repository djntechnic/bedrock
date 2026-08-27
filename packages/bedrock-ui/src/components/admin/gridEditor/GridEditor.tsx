/**
 * @file GridEditor.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description Redesigned admin Grid Editor. Two-pane workspace:
 *              • Header — Screen + Grid selects, dirty indicator, Save/Cancel,
 *                Focus-mode toggle.
 *              • Left panel — collapsible (w-[360px] ↔ w-12), three shadcn Tabs:
 *                Grid Settings, Custom Columns (rank/selection/rank highlight),
 *                Column Settings.
 *              • Preview canvas — the live GridPreview.
 *
 *              Focus mode wraps the preview in a full-viewport shadcn Dialog
 *              with a slide-over Sheet for on-demand settings access.
 *
 *              All state transitions are instrumented through @/utils/logger so
 *              a support engineer can retrace an admin's session end-to-end.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Save,
  RotateCcw,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  Columns3,
  Star,
  Download,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Badge } from "../../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { cn } from "../../../lib/utils";
import { useGridPages, useGridSettings } from "../../../hooks/useAdminPlatform";
import { usePersistedDisclosure } from "../../../hooks/usePersistedDisclosure";
import { log } from "../../../utils/logger";
import { useGridDraft } from "./useGridDraft";
import GridPreview from "./GridPreview";
import GridSettingsPanel from "./GridSettingsPanel";
import GridColumnsPanel from "./GridColumnsPanel";
import CustomColumnsPanel from "./CustomColumnsPanel";
import GridFocusMode from "./GridFocusMode";
import { downloadGridConfigJson } from "./exportGridConfig";
import ImportGridConfigDialog from "./ImportGridConfigDialog";

const ALL_SCREENS = "__all__";
type TabId = "grid" | "custom" | "columns";

interface GridEditorProps {
  /** Seed the initial grid selection. Testing/deep-link hook; optional. */
  initialGridId?: string | null;
}

export default function GridEditor({ initialGridId = null }: GridEditorProps = {}) {
  const { data: pagesData } = useGridPages();
  const { data: gridsData } = useGridSettings();
  const pages = pagesData?.data ?? [];
  const grids = useMemo(() => gridsData?.data ?? [], [gridsData]);

  const [selectedPage, setSelectedPage] = useState<string>(ALL_SCREENS);
  const [selectedGridId, setSelectedGridId] = useState<string | null>(initialGridId);
  const [activeTab, setActiveTab] = useState<TabId>("grid");
  const [leftPanelOpen, setLeftPanelOpen] = usePersistedDisclosure(
    "leftPanelOpen",
    true,
  );
  const [focusOpen, setFocusOpen] = useState(false);
  // Exit guard state: pending screen switch when dirty.
  const [pendingScreen, setPendingScreen] = useState<string | null>(null);
  const [gridSelectOpen, setGridSelectOpen] = useState(false);
  const gridSelectTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    log.info({ component: "GridEditor", action: "mount" }, "GridEditor: mounted");
    return () => {
      log.info({ component: "GridEditor", action: "unmount" }, "GridEditor: unmounted");
    };
  }, []);

  const visibleGrids = useMemo(
    () =>
      selectedPage === ALL_SCREENS
        ? grids
        : grids.filter((g) => (g.page ?? null) === selectedPage),
    [grids, selectedPage],
  );

  useEffect(() => {
    if (
      selectedGridId &&
      !visibleGrids.some((g) => g.grid_id === selectedGridId)
    ) {
      setSelectedGridId(null);
    }
  }, [visibleGrids, selectedGridId]);

  const draft = useGridDraft(selectedGridId);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const columnIds = useMemo(
    () => draft.draftColumns.map((c) => c.column_id),
    [draft.draftColumns],
  );

  const gridLabel = useMemo(
    () => grids.find((g) => g.grid_id === selectedGridId)?.grid_label,
    [grids, selectedGridId],
  );

  const handleSave = useCallback(async () => {
    const d = draftRef.current;
    if (!d.isDirty || d.isSaving) return;
    try {
      await d.save();
      toast.success("Grid settings saved");
      log.info(
        { gridId: selectedGridId, action: "save.success" },
        "GridEditor: save complete",
      );
    } catch (error) {
      toast.error("Failed to save grid settings");
      log.error(
        { err: error, gridId: selectedGridId, action: "save.error" },
        "GridEditor: save failed",
      );
    }
  }, [selectedGridId]);

  function commitScreenChange(v: string) {
    setSelectedPage(v);

    const matchingGrids =
      v === ALL_SCREENS
        ? grids
        : grids.filter((g) => (g.page ?? null) === v);

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
      "GridEditor: screen selected",
    );
  }

  function handleScreenChange(v: string) {
    if (draftRef.current.isDirty) {
      setPendingScreen(v);
      log.info(
        { component: "GridEditor", action: "exit-guard.open", intent: "screen-change" },
        "GridEditor: exit guard shown",
      );
    } else {
      commitScreenChange(v);
    }
  }

  function handleGridChange(v: string) {
    setSelectedGridId(v);
    log.info({ gridId: v, action: "select-grid" }, "GridEditor: grid selected");
  }

  // Keyboard shortcuts: ⌘S / Ctrl+S save; F toggle focus mode.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleSave();
        return;
      }
      // Toggle focus mode only when not typing into a form control.
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
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

  // Warn on tab close / navigation if dirty.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!draftRef.current.isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const emptyBody = !selectedGridId
    ? "Select a screen and grid to begin editing."
    : !draft.isLoaded || !draft.draftGrid || !draft.draftConfig
    ? "Loading grid configuration…"
    : null;

  return (
    <div
      className="flex flex-col bg-background text-foreground border rounded-lg overflow-hidden"
      style={{ minHeight: "calc(100vh - 220px)" }}
      data-testid="grid-editor-shell"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 border-b bg-muted/20 px-3 py-2">
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">Screen</Label>
          <Select value={selectedPage} onValueChange={handleScreenChange}>
            <SelectTrigger size="sm" className="w-52" aria-label="Screen">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SCREENS}>All screens</SelectItem>
              {pages.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[11px] text-muted-foreground">Grid</Label>
          <Select
            value={selectedGridId ?? ""}
            onValueChange={(v) => {
              handleGridChange(v);
              setGridSelectOpen(false);
            }}
            open={gridSelectOpen}
            onOpenChange={setGridSelectOpen}
          >
            <SelectTrigger ref={gridSelectTriggerRef} size="sm" className="w-64" aria-label="Grid">
              <SelectValue placeholder="Select a grid…" />
            </SelectTrigger>
            <SelectContent>
              {visibleGrids.map((g) => (
                <SelectItem key={g.grid_id} value={g.grid_id}>
                  {g.grid_label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {draft.isDirty && (
            <Badge variant="outline" className="gap-1.5 text-amber-600 dark:text-amber-400 border-amber-400/50">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!selectedGridId || !draft.isLoaded || !draft.draftGrid}
            onClick={() => {
              if (!draft.draftGrid) return;
              try {
                downloadGridConfigJson(draft.draftGrid, draft.draftColumns);
                toast.success("Grid config exported");
              } catch (error) {
                log.error(
                  { err: error, gridId: selectedGridId, action: "export.json.error" },
                  "GridEditor: export failed",
                );
                toast.error("Failed to export grid config");
              }
            }}
            aria-label="Export grid config as JSON"
          >
            <Download className="h-3.5 w-3.5" /> Export JSON
          </Button>
          <ImportGridConfigDialog
            gridId={selectedGridId}
            draftGrid={draft.draftGrid}
            draftColumns={draft.draftColumns}
            onApply={draft.applyImportedConfig}
            disabled={!selectedGridId || !draft.isLoaded || !draft.draftGrid}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!selectedGridId || !draft.isLoaded}
            onClick={() => {
              log.info(
                { gridId: selectedGridId, action: "focus.enter" },
                "GridEditor: focus mode requested",
              );
              setFocusOpen(true);
            }}
            aria-label="Enter focus mode"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Focus
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!draft.isDirty || draft.isSaving}
            onClick={draft.reset}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            size="sm"
            disabled={!draft.isDirty || draft.isSaving}
            onClick={handleSave}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {draft.isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      {emptyBody ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">{emptyBody}</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* ── Left panel ──────────────────────────────────────────────── */}
          <div
            className={cn(
              "flex flex-col border-r bg-background transition-all duration-200 overflow-hidden",
              leftPanelOpen ? "w-[360px]" : "w-12",
            )}
            data-testid="grid-editor-left-panel"
            data-open={leftPanelOpen}
          >
            <div className="flex items-center justify-between border-b px-2 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                aria-label={leftPanelOpen ? "Collapse left panel" : "Expand left panel"}
                data-testid="left-panel-toggle"
              >
                {leftPanelOpen ? (
                  <PanelLeftClose className="h-4 w-4" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4" />
                )}
              </Button>
              {leftPanelOpen && (
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Configuration
                </span>
              )}
            </div>

            {leftPanelOpen ? (
              <Tabs
                value={activeTab}
                onValueChange={(v) => {
                  setActiveTab(v as TabId);
                  log.info(
                    { component: "GridEditor", action: "tab.change", tab: v },
                    "GridEditor: tab changed",
                  );
                }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="px-2 pt-2">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="grid" className="gap-1">
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Grid
                    </TabsTrigger>
                    <TabsTrigger value="custom" className="gap-1">
                      <Star className="h-3.5 w-3.5" /> Custom
                    </TabsTrigger>
                    <TabsTrigger value="columns" className="gap-1">
                      <Columns3 className="h-3.5 w-3.5" /> Columns
                    </TabsTrigger>
                  </TabsList>
                </div>
                <div className="flex-1 overflow-auto p-2">
                  <TabsContent value="grid" className="mt-0">
                    {draft.draftGrid && (
                      <GridSettingsPanel
                        draftGrid={draft.draftGrid}
                        columnIds={columnIds}
                        setGridField={draft.setGridField}
                      />
                    )}
                  </TabsContent>
                  <TabsContent value="custom" className="mt-0">
                    {draft.draftGrid && (
                      <CustomColumnsPanel
                        draftGrid={draft.draftGrid}
                        setGridField={draft.setGridField}
                      />
                    )}
                  </TabsContent>
                  <TabsContent value="columns" className="mt-0">
                    <GridColumnsPanel
                      draftColumns={draft.draftColumns}
                      draftGrid={draft.draftGrid}
                      setColumnField={draft.setColumnField}
                      gridId={selectedGridId}
                      insertColumn={draft.insertColumn}
                      removeColumn={draft.removeColumn}
                      columnLifecycle={draft.columnLifecycle}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <IconRibbonButton
                  active={activeTab === "grid"}
                  onClick={() => {
                    setActiveTab("grid");
                    setLeftPanelOpen(true);
                  }}
                  label="Grid settings"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </IconRibbonButton>
                <IconRibbonButton
                  active={activeTab === "custom"}
                  onClick={() => {
                    setActiveTab("custom");
                    setLeftPanelOpen(true);
                  }}
                  label="Custom columns"
                >
                  <Star className="h-4 w-4" />
                </IconRibbonButton>
                <IconRibbonButton
                  active={activeTab === "columns"}
                  onClick={() => {
                    setActiveTab("columns");
                    setLeftPanelOpen(true);
                  }}
                  label="Column settings"
                >
                  <Columns3 className="h-4 w-4" />
                </IconRibbonButton>
              </div>
            )}
          </div>

          {/* ── Preview canvas ──────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden p-4">
            {draft.draftConfig && (
              <GridPreview
                config={draft.draftConfig}
                onEnterFocus={() => setFocusOpen(true)}
                onColumnReorder={draft.reorderColumns}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Focus mode ───────────────────────────────────────────────────── */}
      {selectedGridId && draft.isLoaded && (
        <GridFocusMode
          open={focusOpen}
          onOpenChange={setFocusOpen}
          draft={draft}
          gridId={selectedGridId}
          gridLabel={gridLabel}
        />
      )}

      {/* ── Exit guard on screen change ─────────────────────────────────── */}
      <AlertDialog
        open={pendingScreen !== null}
        onOpenChange={(v) => {
          if (!v) setPendingScreen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the screen filter will drop the edits you've made to
              this grid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                log.info(
                  { component: "GridEditor", action: "exit-guard.cancel" },
                  "GridEditor: exit guard cancelled",
                );
                setPendingScreen(null);
              }}
            >
              Keep editing
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingScreen !== null) {
                  log.info(
                    { component: "GridEditor", action: "exit-guard.discard" },
                    "GridEditor: discarding draft on screen change",
                  );
                  draftRef.current.reset();
                  commitScreenChange(pendingScreen);
                }
                setPendingScreen(null);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface IconRibbonButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}

function IconRibbonButton({ active, onClick, label, children }: IconRibbonButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}
