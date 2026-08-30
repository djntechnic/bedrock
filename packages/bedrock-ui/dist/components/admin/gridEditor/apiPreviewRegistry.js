const registry = {};
function registerApiPreviewEndpoints(endpoints) {
  Object.assign(registry, endpoints);
}
function __clearApiPreviewEndpoints() {
  for (const k of Object.keys(registry)) delete registry[k];
}
function getApiBindingsForGrid(gridId) {
  if (!gridId) return [];
  return registry[gridId] ?? [];
}
function getDefaultParamsForBinding(binding) {
  const result = {};
  for (const param of binding.params) {
    result[param.name] = param.defaultValue;
  }
  return result;
}
export {
  __clearApiPreviewEndpoints,
  getApiBindingsForGrid,
  getDefaultParamsForBinding,
  registerApiPreviewEndpoints
};
//# sourceMappingURL=apiPreviewRegistry.js.map
