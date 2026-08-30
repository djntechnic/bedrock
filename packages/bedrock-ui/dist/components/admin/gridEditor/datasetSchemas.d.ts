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
/**
 * Compile-time-safe key list. TypeScript enforces every string in `keys`
 * belongs to `T`; the runtime value is just the list of strings.
 *
 * Usage: `const cols = assertKeys<MyRow>(["a", "b", "c"] as const);`
 */
export declare function assertKeys<T>(keys: readonly (keyof T & string)[]): readonly string[];
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
 * Registers dataset schemas for the host application's grids.
 *
 * Called as a boot-time side-effect from the app's registration module — the
 * editor itself ships no schema entries, since every one of them describes a
 * row type only the application knows about. Re-registering a grid id
 * overwrites, keeping repeated test imports and HMR safe.
 *
 * @param schemas - Schemas keyed by `grid_id`.
 */
export declare function registerDatasetSchemas(schemas: Record<string, DatasetSchema>): void;
/** Every registered schema, keyed by `grid_id`. */
export declare function getDatasetSchemas(): Record<string, DatasetSchema>;
/** Test helper: drops every registration. Not used by application code. */
export declare function __clearDatasetSchemas(): void;
/** Look up the dataset schema for a grid; `null` when no entry is registered. */
export declare function getDatasetSchema(gridId: string | null): DatasetSchema | null;
/** React hook wrapper — memoised so referential equality holds. */
export declare function useDatasetSchema(gridId: string | null): DatasetSchema | null;
/**
 * Return the column IDs from `configuredIds` that don't appear in the
 * registered schema. When no schema is registered for the grid, returns
 * an empty array — freeform grids never trigger the warning path.
 */
export declare function unknownColumnsFor(gridId: string | null, configuredIds: readonly string[]): string[];
