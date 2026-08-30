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
import { type ReactNode } from "react";
import type { Table } from "@tanstack/react-table";
import type { GridConfig } from "../../hooks/useGridConfig";
import type { Density } from "../../hooks/useDensity";
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
export default function GridHeader<TData>({ table, config, density, onDensityChange, onExport, search, onSearchChange, searchPlaceholder, filtersSlot, bulkDirty, bulkSaving, onBulkSave, onBulkDiscard, dashboardPin, onDashboardPinToggle, }: GridHeaderProps<TData>): import("react").JSX.Element;
export {};
