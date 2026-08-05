/**
 * @file datasetSchemas.ts
 * @module frontend/src/components/admin/gridEditor
 * @description Phase 6B — client-side registry mapping each `grid_id` to the
 *              column IDs the underlying data hook actually emits, so the
 *              admin Grid Editor can:
 *
 *                (1) offer a picker of known columns in the "Add column"
 *                    dialog rather than freeform typing (typo → empty cell);
 *                (2) surface a warning banner when an existing column config
 *                    references a field the dataset doesn't provide;
 *                (3) log a runtime tripwire in `GridPreview` when a column
 *                    references an unknown field — an early signal that a
 *                    row-type rename happened without a companion registry
 *                    update.
 *
 *              Because each backend route emits a bespoke dict (there is no
 *              server-side row schema), the source-of-truth is the TypeScript
 *              row interface the frontend data hook already imports. The
 *              `assertKeys<T>()` helper below binds the runtime list to the
 *              compile-time interface — renaming a field on `LeaderboardRow`
 *              without updating this file fails typecheck.
 *
 *              Grids without a registered dataset (`getDatasetSchema(gridId)`
 *              returns `null`) keep today's behaviour: freeform column ids,
 *              no warnings. The registry is strictly additive.
 */

import { useMemo } from "react";

/**
 * Compile-time-safe key list. TypeScript enforces every string in `keys`
 * belongs to `T`; the runtime value is just the list of strings.
 *
 * Usage: `const cols = assertKeys<MyRow>(["a", "b", "c"] as const);`
 */
export function assertKeys<T>(
  keys: readonly (keyof T & string)[],
): readonly string[] {
  return keys;
}

export interface DatasetSchema {
  /** The `grid_id` this schema binds to. */
  gridId: string;
  /**
   * Canonical column IDs the row objects actually carry. Order is
   * irrelevant — the admin editor sorts these alphabetically in the
   * picker.
   */
  columns: readonly string[];
  /** Free-text hint shown under the picker so admins know where the data comes from. */
  source: string;
}

/**
 * Registry keyed by `grid_id`. Add a new entry when introducing a new grid
 * whose row type is known; grids without an entry fall through to freeform
 * behaviour so this file is safe to leave partial.
 */
const registry: Record<string, DatasetSchema> = {};

/**
 * Registers dataset schemas for the host application's grids.
 *
 * Called as a boot-time side-effect from the app's registration module — the
 * editor itself ships no schema entries, since every one of them describes a
 * row type only the application knows about. Re-registering a grid id
 * overwrites, keeping repeated test imports and HMR safe.
 *
 * @param schemas - Schemas keyed by `grid_id`.
 */
export function registerDatasetSchemas(
  schemas: Record<string, DatasetSchema>,
): void {
  Object.assign(registry, schemas);
}

/** Every registered schema, keyed by `grid_id`. */
export function getDatasetSchemas(): Record<string, DatasetSchema> {
  return { ...registry };
}

/** Test helper: drops every registration. Not used by application code. */
export function __clearDatasetSchemas(): void {
  for (const k of Object.keys(registry)) delete registry[k];
}

/** Look up the dataset schema for a grid; `null` when no entry is registered. */
export function getDatasetSchema(gridId: string | null): DatasetSchema | null {
  if (!gridId) return null;
  return registry[gridId] ?? null;
}

/** React hook wrapper — memoised so referential equality holds. */
export function useDatasetSchema(gridId: string | null): DatasetSchema | null {
  return useMemo(() => getDatasetSchema(gridId), [gridId]);
}

/**
 * Return the column IDs from `configuredIds` that don't appear in the
 * registered schema. When no schema is registered for the grid, returns
 * an empty array — freeform grids never trigger the warning path.
 */
export function unknownColumnsFor(
  gridId: string | null,
  configuredIds: readonly string[],
): string[] {
  const schema = getDatasetSchema(gridId);
  if (!schema) return [];
  const known = new Set(schema.columns);
  return configuredIds.filter((id) => !known.has(id));
}
