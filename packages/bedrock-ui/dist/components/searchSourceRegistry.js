const sources = /* @__PURE__ */ new Map();
let seq = 0;
let allTarget = null;
function registerSearchSource(source) {
  seq += 1;
  sources.set(source.id, { ...source, seq });
}
function getSearchSources() {
  return [...sources.values()].sort(
    (a, b) => (a.order ?? 100) - (b.order ?? 100) || a.seq - b.seq
  );
}
function registerSearchAllTarget(target) {
  allTarget = target;
}
function getSearchAllTarget() {
  return allTarget;
}
function __clearSearchSources() {
  sources.clear();
  allTarget = null;
}
export {
  __clearSearchSources,
  getSearchAllTarget,
  getSearchSources,
  registerSearchAllTarget,
  registerSearchSource
};
//# sourceMappingURL=searchSourceRegistry.js.map
