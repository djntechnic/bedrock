/**
 * @file exportGridConfig.ts
 * @module frontend/src/components/admin/gridEditor
 * @description Client-side serializer for the current draft grid configuration.
 *              Produces a pretty-printed JSON snapshot of `app_grid_settings` +
 *              `app_grid_column_settings` and triggers a browser download.
 *
 *              Read-only surface — never mutates state, never hits the network.
 *              Support / QA use this to attach the exact config of a repro grid
 *              to an issue.
 */
import type { GridSetting, GridColumnSetting } from "../../../hooks/useAdminPlatform";
export interface GridConfigExport {
    exportedAt: string;
    exportVersion: 1;
    grid: GridSetting;
    columns: GridColumnSetting[];
}
/** Sanitize the grid_id to a filesystem-safe basename. */
export declare function safeExportFilename(gridId: string): string;
/** Build the JSON payload — kept pure so tests can assert shape without a DOM. */
export declare function buildExportPayload(grid: GridSetting, columns: GridColumnSetting[]): GridConfigExport;
/**
 * Triggers a browser download of the current draft config as JSON. Silently
 * no-ops in non-browser environments; every path emits a structured log entry.
 */
export declare function downloadGridConfigJson(grid: GridSetting, columns: GridColumnSetting[]): void;
