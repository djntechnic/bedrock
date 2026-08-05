/**
 * @file apiPreviewRegistry.ts
 * @module frontend/src/components/admin/gridEditor
 * @description Registry mapping grid IDs to associated backend API endpoints
 *              and query parameter definitions for live preview data in the Grid Editor.
 */

export interface ApiParamDef {
  name: string;
  label: string;
  type: "string" | "number" | "boolean" | "select";
  defaultValue: string | number | boolean;
  options?: { label: string; value: string | number | boolean }[];
}

export interface ApiEndpointBinding {
  id: string;
  label: string;
  path: string;
  method: "GET";
  responsePath?: string; // e.g. "data" for response envelope { data: [...] }
  params: ApiParamDef[];
}

const registry: Record<string, ApiEndpointBinding[]> = {};

/**
 * Registers the host application's live-preview endpoint bindings.
 *
 * Called as a boot-time side-effect from the app's registration module; the
 * editor ships no bindings of its own, since every path is app-specific.
 *
 * @param endpoints - Bindings keyed by `grid_id`.
 */
export function registerApiPreviewEndpoints(
  endpoints: Record<string, ApiEndpointBinding[]>,
): void {
  Object.assign(registry, endpoints);
}

/** Test helper: drops every registration. Not used by application code. */
export function __clearApiPreviewEndpoints(): void {
  for (const k of Object.keys(registry)) delete registry[k];
}

/**
 * Returns available API endpoint bindings for a given grid_id.
 */
export function getApiBindingsForGrid(gridId: string | null): ApiEndpointBinding[] {
  if (!gridId) return [];
  return registry[gridId] ?? [];
}

/**
 * Helper to build default parameter values record for an endpoint binding.
 */
export function getDefaultParamsForBinding(binding: ApiEndpointBinding): Record<string, any> {
  const result: Record<string, any> = {};
  for (const param of binding.params) {
    result[param.name] = param.defaultValue;
  }
  return result;
}
