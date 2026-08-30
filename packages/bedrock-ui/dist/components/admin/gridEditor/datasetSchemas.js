import { useMemo } from "react";
function assertKeys(keys) {
  return keys;
}
const registry = {};
function registerDatasetSchemas(schemas) {
  Object.assign(registry, schemas);
}
function getDatasetSchemas() {
  return { ...registry };
}
function __clearDatasetSchemas() {
  for (const k of Object.keys(registry)) delete registry[k];
}
function getDatasetSchema(gridId) {
  if (!gridId) return null;
  return registry[gridId] ?? null;
}
function useDatasetSchema(gridId) {
  return useMemo(() => getDatasetSchema(gridId), [gridId]);
}
function unknownColumnsFor(gridId, configuredIds) {
  const schema = getDatasetSchema(gridId);
  if (!schema) return [];
  const known = new Set(schema.columns);
  return configuredIds.filter((id) => !known.has(id));
}
export {
  __clearDatasetSchemas,
  assertKeys,
  getDatasetSchema,
  getDatasetSchemas,
  registerDatasetSchemas,
  unknownColumnsFor,
  useDatasetSchema
};
//# sourceMappingURL=datasetSchemas.js.map
