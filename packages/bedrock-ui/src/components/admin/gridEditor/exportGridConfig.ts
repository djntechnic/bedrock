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
import { log } from "../../../utils/logger";

export interface GridConfigExport {
  exportedAt: string;
  exportVersion: 1;
  grid: GridSetting;
  columns: GridColumnSetting[];
}

/** Sanitize the grid_id to a filesystem-safe basename. */
export function safeExportFilename(gridId: string): string {
  const base = gridId.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${base || "grid"}-config.json`;
}

/** Build the JSON payload — kept pure so tests can assert shape without a DOM. */
export function buildExportPayload(
  grid: GridSetting,
  columns: GridColumnSetting[],
): GridConfigExport {
  return {
    exportedAt: new Date().toISOString(),
    exportVersion: 1,
    grid,
    columns: [...columns].sort((a, b) => a.column_order - b.column_order),
  };
}

/**
 * Triggers a browser download of the current draft config as JSON. Silently
 * no-ops in non-browser environments; every path emits a structured log entry.
 */
export function downloadGridConfigJson(
  grid: GridSetting,
  columns: GridColumnSetting[],
): void {
  const payload = buildExportPayload(grid, columns);
  const filename = safeExportFilename(grid.grid_id);

  if (typeof window === "undefined" || typeof document === "undefined") {
    log.warn(
      { gridId: grid.grid_id, action: "export.json.skipped", reason: "no-window" },
      "exportGridConfig: skipped — no DOM",
    );
    return;
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  log.info(
    {
      gridId: grid.grid_id,
      action: "export.json",
      filename,
      columnCount: columns.length,
    },
    "exportGridConfig: download triggered",
  );
}
