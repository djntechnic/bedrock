const mediaRenderers = /* @__PURE__ */ new Map();
const columnRenderers = /* @__PURE__ */ new Map();
function registerMediaRenderer(cellType, render) {
  mediaRenderers.set(cellType, render);
}
function registerColumnRenderer(columnId, render) {
  columnRenderers.set(columnId, render);
}
function registerColumnRenderers(columnIds, render) {
  for (const id of columnIds) registerColumnRenderer(id, render);
}
function resolveMediaRenderer(cellType) {
  if (!cellType) return void 0;
  return mediaRenderers.get(cellType);
}
function resolveColumnRenderer(columnId) {
  if (!columnId) return void 0;
  return columnRenderers.get(columnId);
}
function getMediaCellTypes() {
  return new Set(mediaRenderers.keys());
}
function isMediaCellType(cellType) {
  return resolveMediaRenderer(cellType) !== void 0;
}
function __clearCellRegistry() {
  mediaRenderers.clear();
  columnRenderers.clear();
}
export {
  __clearCellRegistry,
  getMediaCellTypes,
  isMediaCellType,
  registerColumnRenderer,
  registerColumnRenderers,
  registerMediaRenderer,
  resolveColumnRenderer,
  resolveMediaRenderer
};
//# sourceMappingURL=cellRegistry.js.map
