/**
 * @file importGridConfig.ts
 * @module frontend/src/components/admin/gridEditor
 * @description Phase 6C — reverse of `exportGridConfig.ts`. Parses a
 *              GridConfigExport v1 JSON payload, produces a summary diff
 *              (added / removed / changed columns + grid-level field diffs
 *              + dataset-alignment warnings), and hands the payload back so
 *              the caller can route it through `useGridDraft.applyImportedConfig`.
 *
 *              Never touches the network directly. Never mutates state.
 *              The admin always sees the diff summary and hits Save before
 *              anything persists — the import path just stages changes into
 *              the existing draft lifecycle.
 */
import type { GridSetting, GridColumnSetting } from "../../../hooks/useAdminPlatform";
import type { GridConfigExport } from "./exportGridConfig";
export interface ChangedColumnDiff {
    columnId: string;
    fields: (keyof GridColumnSetting)[];
}
export interface ImportSummary {
    /** Columns present in the import but missing from the current draft. */
    added: GridColumnSetting[];
    /** Columns present in the current draft but omitted from the import. */
    removed: GridColumnSetting[];
    /** Columns present in both but with at least one differing field. */
    changed: ChangedColumnDiff[];
    /** Grid-level fields whose value differs between draft and import. */
    gridFieldsChanged: (keyof GridSetting)[];
    /** Human-readable messages (e.g. dataset-alignment gotchas). */
    warnings: string[];
}
/**
 * Parse a JSON string as a GridConfigExport payload. Throws with a
 * descriptive error whenever the shape doesn't match — the caller
 * surfaces the message in the import dialog.
 */
export declare function parseGridConfigJson(raw: string): GridConfigExport;
/**
 * Compute a summary of what applying `next` on top of `base` would change.
 * Pure — the caller owns state mutation. `schemaGridId` is the *current*
 * grid whose dataset schema (from Phase 6B) informs the warning list.
 */
export declare function planImport(base: {
    grid: GridSetting;
    columns: GridColumnSetting[];
}, next: GridConfigExport, schemaGridId?: string | null): ImportSummary;
/** Read a File instance as text (browser only). Rejects on FileReader error. */
export declare function readFileAsText(file: File): Promise<string>;
