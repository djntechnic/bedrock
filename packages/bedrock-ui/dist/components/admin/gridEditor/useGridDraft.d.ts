/**
 * @file useGridDraft.ts
 * @module frontend/src/components/admin/gridEditor
 * @description Draft-state engine for the admin Grid Editor. Loads the server
 *              grid + column settings, holds an editable working copy, exposes
 *              field setters, dirty tracking, reset, and a diffed save that fires
 *              the existing PATCH mutations. A live GridConfig is derived from the
 *              draft via the shared buildGridConfig() so the preview renders the
 *              exact runtime mapping — no drift from production grids.
 *
 *              Phase 6A: the draft tracks a `columnLifecycle` map so the
 *              editor can insert and remove columns in the draft and reconcile
 *              them on Save via POST/DELETE mutations alongside the existing
 *              PATCH path. Phase 6C adds `applyImportedConfig` — a bulk setter
 *              that routes an imported JSON snapshot through the same
 *              insert/update/remove primitives so the diff summary the admin
 *              approves in the import dialog matches what save() actually
 *              writes.
 */
import { type GridSetting, type GridColumnSetting } from "../../../hooks/useAdminPlatform";
import { type GridConfig } from "../../../hooks/useGridConfig";
import type { GridConfigExport } from "./exportGridConfig";
/** Lifecycle state a draft column carries across insert/update/delete flows. */
export type ColumnLifecycle = "existing" | "insert" | "delete";
export interface GridDraft {
    /** The editable grid-level settings, or null before a grid is selected/loaded. */
    draftGrid: GridSetting | null;
    /** The editable column-level settings. */
    draftColumns: GridColumnSetting[];
    /** Live GridConfig derived from the draft, for the preview. */
    draftConfig: GridConfig | null;
    /** Whether the draft differs from the last-loaded server state. */
    isDirty: boolean;
    /** Whether the server data has resolved. */
    isLoaded: boolean;
    /** Mutate a single grid-level field. */
    setGridField: <K extends keyof GridSetting>(field: K, value: GridSetting[K]) => void;
    /** Mutate a single column-level field. */
    setColumnField: <K extends keyof GridColumnSetting>(columnId: string, field: K, value: GridColumnSetting[K]) => void;
    /**
     * Phase 5: renumber every draft column's `column_order` to its index in
     * `nextOrder`. Columns not named in `nextOrder` retain their existing
     * order relative to each other, appended after the reordered set — a
     * safety net for when the caller only reorders the visible subset.
     */
    reorderColumns: (nextOrder: string[]) => void;
    /**
     * Phase 6A: append a new column to the draft with sensible defaults. The
     * lifecycle map flags it as `"insert"` so `save()` fires a POST rather
     * than a PATCH. A caller may pre-fill any writable field via `seed`.
     */
    insertColumn: (seed: Partial<GridColumnSetting> & {
        column_id: string;
    }) => void;
    /**
     * Phase 6A: retire a column from the draft. Existing rows are marked
     * `"delete"` and remain visible in the draft (so the diff summary still
     * shows them until save clears them); rows still in `"insert"` state
     * are dropped outright since they never hit the server.
     */
    removeColumn: (columnId: string) => void;
    /** Read the current lifecycle state for a column (defaults to "existing"). */
    columnLifecycle: (columnId: string) => ColumnLifecycle;
    /**
     * Phase 6C: apply an imported JSON snapshot on top of the current draft.
     * Grid-identity fields (`grid_id`, `grid_setting_id`, `grid_label`) and
     * per-column identity (`column_setting_id`, `grid_setting_id`) are
     * ignored so imports never rebrand the open grid.
     */
    applyImportedConfig: (payload: GridConfigExport) => void;
    /** Revert the draft to the last-loaded server state. */
    reset: () => void;
    /** Persist only changed fields via PATCH. Resolves when all writes complete. */
    save: () => Promise<void>;
    /** True while a save is in flight. */
    isSaving: boolean;
}
export declare function useGridDraft(gridId: string | null): GridDraft;
