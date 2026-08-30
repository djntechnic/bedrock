import { unknownColumnsFor } from "./datasetSchemas.js";
import { log } from "../../../utils/logger.js";
const GRID_IDENTITY_FIELDS = /* @__PURE__ */ new Set([
  "grid_setting_id",
  "grid_id",
  "grid_label"
]);
const COLUMN_IDENTITY_FIELDS = /* @__PURE__ */ new Set([
  "column_setting_id",
  "grid_setting_id"
]);
function looksLikeGridConfigExport(x) {
  if (!x || typeof x !== "object") return false;
  const rec = x;
  if (rec.exportVersion !== 1) return false;
  if (typeof rec.exportedAt !== "string") return false;
  if (!rec.grid || typeof rec.grid !== "object") return false;
  if (!Array.isArray(rec.columns)) return false;
  const grid = rec.grid;
  if (typeof grid.grid_id !== "string") return false;
  for (const col of rec.columns) {
    if (!col || typeof col !== "object") return false;
    if (typeof col.column_id !== "string") return false;
  }
  return true;
}
function parseGridConfigJson(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Import payload is not valid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!looksLikeGridConfigExport(parsed)) {
    throw new Error(
      "Import payload is missing required fields — expected exportVersion=1, exportedAt, grid, columns[]."
    );
  }
  return parsed;
}
function planImport(base, next, schemaGridId) {
  const currentIds = new Set(base.columns.map((c) => c.column_id));
  const importedIds = new Set(next.columns.map((c) => c.column_id));
  const added = next.columns.filter((c) => !currentIds.has(c.column_id));
  const removed = base.columns.filter((c) => !importedIds.has(c.column_id));
  const changed = [];
  for (const importedCol of next.columns) {
    const draftCol = base.columns.find(
      (c) => c.column_id === importedCol.column_id
    );
    if (!draftCol) continue;
    const fields = [];
    for (const key of Object.keys(importedCol)) {
      if (COLUMN_IDENTITY_FIELDS.has(key)) continue;
      if (key === "column_id") continue;
      if (importedCol[key] !== draftCol[key]) {
        fields.push(key);
      }
    }
    if (fields.length > 0) {
      changed.push({ columnId: importedCol.column_id, fields });
    }
  }
  const gridFieldsChanged = [];
  for (const key of Object.keys(next.grid)) {
    if (GRID_IDENTITY_FIELDS.has(key)) continue;
    if (next.grid[key] !== base.grid[key]) {
      gridFieldsChanged.push(key);
    }
  }
  const warnings = [];
  const stray = unknownColumnsFor(
    schemaGridId ?? base.grid.grid_id,
    next.columns.map((c) => c.column_id)
  );
  for (const columnId of stray) {
    warnings.push(
      `'${columnId}' isn't a known column on this dataset — cells will render empty unless the endpoint emits a '${columnId}' field.`
    );
  }
  if (next.grid.grid_id && next.grid.grid_id !== base.grid.grid_id) {
    warnings.push(
      `Import file was exported from '${next.grid.grid_id}'; applying to the currently-open grid '${base.grid.grid_id}' (identity fields ignored).`
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
      warnings: warnings.length
    },
    "importGridConfig: plan built"
  );
  return { added, removed, changed, gridFieldsChanged, warnings };
}
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsText(file);
  });
}
export {
  parseGridConfigJson,
  planImport,
  readFileAsText
};
//# sourceMappingURL=importGridConfig.js.map
