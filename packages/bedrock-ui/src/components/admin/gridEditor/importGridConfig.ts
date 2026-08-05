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
import { unknownColumnsFor } from "./datasetSchemas";
import type { GridConfigExport } from "./exportGridConfig";
import { log } from "../../../utils/logger";

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

/** Fields that must never be carried over from an import — the import
 *  targets the *currently open* grid, never rebrands it. */
const GRID_IDENTITY_FIELDS = new Set<keyof GridSetting>([
  "grid_setting_id" as keyof GridSetting,
  "grid_id" as keyof GridSetting,
  "grid_label" as keyof GridSetting,
]);

const COLUMN_IDENTITY_FIELDS = new Set<keyof GridColumnSetting>([
  "column_setting_id" as keyof GridColumnSetting,
  "grid_setting_id" as keyof GridColumnSetting,
]);

/** Type-guard-ish shape check on the parsed payload. */
function looksLikeGridConfigExport(x: unknown): x is GridConfigExport {
  if (!x || typeof x !== "object") return false;
  const rec = x as Record<string, unknown>;
  if (rec.exportVersion !== 1) return false;
  if (typeof rec.exportedAt !== "string") return false;
  if (!rec.grid || typeof rec.grid !== "object") return false;
  if (!Array.isArray(rec.columns)) return false;
  const grid = rec.grid as Record<string, unknown>;
  if (typeof grid.grid_id !== "string") return false;
  for (const col of rec.columns) {
    if (!col || typeof col !== "object") return false;
    if (typeof (col as Record<string, unknown>).column_id !== "string") return false;
  }
  return true;
}

/**
 * Parse a JSON string as a GridConfigExport payload. Throws with a
 * descriptive error whenever the shape doesn't match — the caller
 * surfaces the message in the import dialog.
 */
export function parseGridConfigJson(raw: string): GridConfigExport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Import payload is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (!looksLikeGridConfigExport(parsed)) {
    throw new Error(
      "Import payload is missing required fields — expected exportVersion=1, exportedAt, grid, columns[].",
    );
  }
  return parsed;
}

/**
 * Compute a summary of what applying `next` on top of `base` would change.
 * Pure — the caller owns state mutation. `schemaGridId` is the *current*
 * grid whose dataset schema (from Phase 6B) informs the warning list.
 */
export function planImport(
  base: { grid: GridSetting; columns: GridColumnSetting[] },
  next: GridConfigExport,
  schemaGridId?: string | null,
): ImportSummary {
  const currentIds = new Set(base.columns.map((c) => c.column_id));
  const importedIds = new Set(next.columns.map((c) => c.column_id));

  const added = next.columns.filter((c) => !currentIds.has(c.column_id));
  const removed = base.columns.filter((c) => !importedIds.has(c.column_id));

  const changed: ChangedColumnDiff[] = [];
  for (const importedCol of next.columns) {
    const draftCol = base.columns.find(
      (c) => c.column_id === importedCol.column_id,
    );
    if (!draftCol) continue; // handled by `added`
    const fields: (keyof GridColumnSetting)[] = [];
    for (const key of Object.keys(importedCol) as (keyof GridColumnSetting)[]) {
      if (COLUMN_IDENTITY_FIELDS.has(key)) continue;
      if (key === ("column_id" as keyof GridColumnSetting)) continue;
      if (
        (importedCol[key] as unknown) !==
        (draftCol[key] as unknown)
      ) {
        fields.push(key);
      }
    }
    if (fields.length > 0) {
      changed.push({ columnId: importedCol.column_id, fields });
    }
  }

  const gridFieldsChanged: (keyof GridSetting)[] = [];
  for (const key of Object.keys(next.grid) as (keyof GridSetting)[]) {
    if (GRID_IDENTITY_FIELDS.has(key)) continue;
    if ((next.grid[key] as unknown) !== (base.grid[key] as unknown)) {
      gridFieldsChanged.push(key);
    }
  }

  const warnings: string[] = [];
  const stray = unknownColumnsFor(
    schemaGridId ?? base.grid.grid_id,
    next.columns.map((c) => c.column_id),
  );
  for (const columnId of stray) {
    warnings.push(
      `'${columnId}' isn't a known column on this dataset — cells will render empty unless the endpoint emits a '${columnId}' field.`,
    );
  }
  if (next.grid.grid_id && next.grid.grid_id !== base.grid.grid_id) {
    warnings.push(
      `Import file was exported from '${next.grid.grid_id}'; applying to the currently-open grid '${base.grid.grid_id}' (identity fields ignored).`,
    );
  }

  log.debug(
    {
      gridId: base.grid.grid_id,
      action: "import.plan",
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      gridFieldsChanged: gridFieldsChanged.length,
      warnings: warnings.length,
    },
    "importGridConfig: plan built",
  );

  return { added, removed, changed, gridFieldsChanged, warnings };
}

/** Read a File instance as text (browser only). Rejects on FileReader error. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error ?? new Error("FileReader failed"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}
