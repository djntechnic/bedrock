/**
 * @file rowAccentRegistry.ts
 * @module frontend/src/components/grids
 * @description Extension point for per-row accent tinting (§S9 Phase 3).
 *
 * The grid engine owns the *mechanism*: when `config.rowAccentReactive` is
 * on, each non-grouped data row may carry an inline style plus a
 * `border-l-2 border-l-[color:var(--team-accent)]` class. It does not own the
 * *policy* — deciding a row's color requires domain knowledge (MLBTracker maps
 * `row.mlb_team_id` through the teams registry to a contrast-clamped team
 * color), so the host application supplies that via
 * `registerRowAccentResolver()`.
 *
 * The registered value is a **React hook factory**, not a plain function,
 * because resolving an accent generally needs data the app fetches through a
 * hook (`useTeams()` here). The engine calls it once per component render and
 * gets back a pure `(row) => CSSProperties | undefined` mapper it can apply
 * per row without breaking the rules of hooks.
 *
 * Registration is a boot-time side-effect (see `main.tsx`), so the hook
 * identity is stable for the lifetime of every mounted grid — which is what
 * keeps the conditional call below rules-of-hooks safe. Registering after a
 * grid has mounted is not supported.
 */
import type { CSSProperties } from "react";
/** Maps a data row to its accent style, or `undefined` for no accent. */
export type RowAccentResolver = (row: Record<string, unknown>) => CSSProperties | undefined;
/**
 * A hook returning a {@link RowAccentResolver}. May call other hooks — the
 * engine invokes it unconditionally at the top level of its render.
 */
export type RowAccentHook = () => RowAccentResolver;
/**
 * Registers the application's row-accent resolver hook.
 *
 * @param hook - Hook returning a row → style mapper. Called once per grid render.
 */
export declare function registerRowAccentResolver(hook: RowAccentHook): void;
/**
 * Resolves the active row-accent mapper for this render.
 *
 * Always invokes exactly one hook, so the engine's hook sequence is stable.
 *
 * @param enabled - Whether the grid's config enables accent tinting. When
 *                  false the app hook still runs (keeping the hook order
 *                  identical and the underlying query warm), but the returned
 *                  mapper is inert — flipping the admin flag then needs no
 *                  extra fetch waterfall, matching the pre-registry behaviour.
 * @returns A pure mapper safe to call per row.
 */
export declare function useRowAccentResolver(enabled: boolean): RowAccentResolver;
/** Test helper: removes any registration. Not used by application code. */
export declare function __clearRowAccentResolver(): void;
