import { log } from "../../../utils/logger.js";
function safeExportFilename(gridId) {
  const base = gridId.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  return `${base || "grid"}-config.json`;
}
function buildExportPayload(grid, columns) {
  return {
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    exportVersion: 1,
    grid,
    columns: [...columns].sort((a, b) => a.column_order - b.column_order)
  };
}
function downloadGridConfigJson(grid, columns) {
  const payload = buildExportPayload(grid, columns);
  const filename = safeExportFilename(grid.grid_id);
  if (typeof window === "undefined" || typeof document === "undefined") {
    log.warn(
      { gridId: grid.grid_id, action: "export.json.skipped", reason: "no-window" },
      "exportGridConfig: skipped — no DOM"
    );
    return;
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
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
      columnCount: columns.length
    },
    "exportGridConfig: download triggered"
  );
}
export {
  buildExportPayload,
  downloadGridConfigJson,
  safeExportFilename
};
//# sourceMappingURL=exportGridConfig.js.map
