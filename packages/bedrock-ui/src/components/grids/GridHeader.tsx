/**
 * @file GridHeader.tsx
 * @module frontend/src/components/grids
 * @description Standardized, configuration-driven grid header. Deprecates the
 * ad-hoc per-grid toolbar blocks by deriving every control (search, density,
 * column visibility, export) from the merged {@link GridConfig} feature flags
 * exposed by useGridConfig().
 *
 * Design contracts:
 *  - Record counts are read straight from the live TanStack Table instance via
 *    `table.getFilteredRowModel().rows.length` so the displayed total always
 *    tracks active filters with zero drift.
 *  - The single TooltipProvider consumes `config.tooltipDelayDuration` — no
 *    hardcoded latency lives in this component.
 *  - Lifecycle + interaction events (mount, search, density, column toggle,
 *    export) emit structured Pino traces carrying { gridId, action, recordCount }.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { Download, AlignJustify, Search, X, Printer, Save, Undo2, Pin, PinOff } from "lucide-react";
import type { Table } from "@tanstack/react-table";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import ColumnToggle from "../ColumnToggle";
import type { GridConfig } from "../../hooks/useGridConfig";
import type { Density } from "../../hooks/useDensity";
import { DENSITY_LABEL } from "../../hooks/useDensity";
import { DEFAULT_TOOLTIP_DELAY } from "../../types/grid";
import { log } from "../../utils/logger";

interface GridHeaderProps<TData> {
  /** Live TanStack Table instance — the sole source of truth for record counts. */
  table: Table<TData>;
  /** Merged grid configuration from useGridConfig(). */
  config: GridConfig;
  /** Current row density (enables the density toggle when paired with onDensityChange). */
  density?: Density;
  /** Cycles the row density. */
  onDensityChange?: () => void;
  /** Triggers a CSV export of the current view. */
  onExport?: () => void;
  /** Controlled value for the inline search input (requires config.showSearch). */
  search?: string;
  /** Called when the inline search input changes. */
  onSearchChange?: (value: string) => void;
  /** Placeholder text for the inline search input. */
  searchPlaceholder?: string;
  /**
   * Optional inline filter controls (status pills, date pickers, category
   * dropdowns) rendered in the left cluster after the search input. Lets
   * migrated grids surface per-grid filters without dropping to ad-hoc
   * toolbar markup — every consumer still routes through the unified header.
   */
  filtersSlot?: ReactNode;
  /**
   * Phase 10 B3: bulk-save primitive. When `bulkDirty=true`, the header
   * renders Save + Discard buttons in the right cluster. Both fire the
   * corresponding callback; the DataGrid owns the draft-store state.
   */
  bulkDirty?: boolean;
  bulkSaving?: boolean;
  onBulkSave?: () => void | Promise<void>;
  onBulkDiscard?: () => void;
  /**
   * Per-user customization: whether the caller has pinned this grid as a
   * dashboard source. `undefined` (not `false`) hides the button entirely —
   * DataGrid passes `undefined` for anonymous visitors and the synthetic
   * 'dashboard'/'player_pins' grid_ids, which can't pin themselves.
   */
  dashboardPin?: boolean;
  onDashboardPinToggle?: () => void;
}

/**
 * Resolves the authoritative record count from the table instance. Prefers the
 * filtered row model (matching the Success Criteria); falls back to the core row
 * model for tables that do not register client-side filtering.
 */
function useRecordCount<TData>(table: Table<TData>): number {
  return table.options.getFilteredRowModel
    ? table.getFilteredRowModel().rows.length
    : table.getRowModel().rows.length;
}

export default function GridHeader<TData>({
  table,
  config,
  density,
  onDensityChange,
  onExport,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filtersSlot,
  bulkDirty = false,
  bulkSaving = false,
  onBulkSave,
  onBulkDiscard,
  dashboardPin,
  onDashboardPinToggle,
}: GridHeaderProps<TData>) {
  const recordCount = useRecordCount(table);
  const tipDelay = config.tooltipDelayDuration ?? DEFAULT_TOOLTIP_DELAY;

  const showDensity =
    config.showDensityToggle && density !== undefined && !!onDensityChange;
  const showSearch = config.showSearch && !!onSearchChange;

  // Emit a single structured mount trace per grid instance so layout timings and
  // the initial matched-row bounds are captured for downstream ingestion.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    log.info(
      { gridId: config.gridId, action: "mount", recordCount },
      "GridHeader: mounted",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.gridId]);

  function handleSearchChange(value: string) {
    log.info(
      { gridId: config.gridId, action: "search", query: value, recordCount },
      "GridHeader: search filter changed",
    );
    onSearchChange?.(value);
  }

  function handleDensityChange() {
    log.info(
      { gridId: config.gridId, action: "density", recordCount },
      "GridHeader: density changed",
    );
    onDensityChange?.();
  }

  function handleExport() {
    log.info(
      { gridId: config.gridId, action: "export", recordCount },
      "GridHeader: export requested",
    );
    onExport?.();
  }

  // Config-driven print trigger. Emits a structured trace carrying the active
  // grid + record dimensions before handing off to the browser print pipeline,
  // which @media print rules reflow into a clean, shell-free layout.
  function handlePrint() {
    log.info(
      { gridId: config.gridId, action: "print", recordCount },
      "GridHeader: print layout requested",
    );
    if (typeof window !== "undefined" && typeof window.print === "function") {
      window.print();
    }
  }

  const hasTitleBlock = !!config.title || !!config.subHeader;

  return (
    <TooltipProvider delayDuration={tipDelay}>
      {hasTitleBlock && (
        <div className="mb-2 space-y-0.5">
          {config.title && (
            <h2 className="text-base font-semibold leading-tight">
              {config.title}
            </h2>
          )}
          {config.subHeader && (
            <p className="text-xs text-muted-foreground leading-snug">
              {config.subHeader}
            </p>
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        {/* Left cluster: record count + optional inline search */}
        <div className="flex items-center gap-3">
          {config.showRowCount ? (
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {recordCount.toLocaleString()} row{recordCount !== 1 ? "s" : ""}
            </p>
          ) : (
            <span />
          )}
          {showSearch && (
            <div className="relative min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search ?? ""}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label="Search grid rows"
                className="pl-9 h-[34px] text-sm"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
                  onClick={() => handleSearchChange("")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          {filtersSlot && (
            <div data-slot="grid-header-filters" className="flex items-center gap-2">
              {filtersSlot}
            </div>
          )}
        </div>

        {/* Right cluster: bulk save (Phase 10 B3) / density / column toggle / export */}
        <div className="flex items-center gap-2">
          {bulkDirty && (onBulkSave || onBulkDiscard) && (
            <div className="flex items-center gap-1.5">
              {onBulkDiscard && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  aria-label="Discard unsaved edits"
                  disabled={bulkSaving}
                  onClick={() => {
                    log.info(
                      { gridId: config.gridId, action: "bulk-discard", recordCount },
                      "GridHeader: bulk discard",
                    );
                    onBulkDiscard();
                  }}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Discard
                </Button>
              )}
              {onBulkSave && (
                <Button
                  size="sm"
                  className="gap-1.5"
                  aria-label="Save unsaved edits"
                  disabled={bulkSaving}
                  onClick={() => {
                    log.info(
                      { gridId: config.gridId, action: "bulk-save", recordCount },
                      "GridHeader: bulk save",
                    );
                    void onBulkSave();
                  }}
                >
                  <Save className="h-3.5 w-3.5" />
                  {bulkSaving ? "Saving…" : "Save"}
                </Button>
              )}
            </div>
          )}
          {showDensity && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={density !== "standard" ? "secondary" : "outline"}
                  size="sm"
                  aria-label={`Row density · ${DENSITY_LABEL[density!]}`}
                  onClick={handleDensityChange}
                >
                  <AlignJustify className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Row density · {DENSITY_LABEL[density!]}
              </TooltipContent>
            </Tooltip>
          )}
          {config.allowColumnToggle && (
            <ColumnToggle table={table} gridId={config.gridId} />
          )}
          {dashboardPin !== undefined && onDashboardPinToggle && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={dashboardPin ? "secondary" : "outline"}
                  size="sm"
                  aria-label={
                    dashboardPin ? "Unpin from dashboard" : "Pin to dashboard"
                  }
                  aria-pressed={dashboardPin}
                  onClick={() => {
                    log.info(
                      { gridId: config.gridId, action: "dashboard_pin", pinned: !dashboardPin },
                      "GridHeader: dashboard pin toggled",
                    );
                    onDashboardPinToggle();
                  }}
                >
                  {dashboardPin ? (
                    <Pin className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <PinOff className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {dashboardPin ? "Unpin from dashboard" : "Pin to dashboard"}
              </TooltipContent>
            </Tooltip>
          )}
          {config.allowExport && onExport && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-label="Export grid to CSV"
              onClick={handleExport}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          )}
          {config.allowPrintView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 print:hidden"
                  aria-label="Trigger page print layout"
                  onClick={handlePrint}
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only">Print</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Print / save as PDF
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
