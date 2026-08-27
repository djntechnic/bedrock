/**
 * @file dashboardPinRegistry.ts
 * @module frontend/src/components/grids
 * @description Extension point declaring that this app honours dashboard pins.
 *
 * `dashboard_pin` is a real, per-operator preference: it round-trips through
 * `user_grid_preferences` and survives a reload. What the platform does *not*
 * have is anything that reads it back — rendering a dashboard means knowing
 * which component and which query stand behind a grid id, and that is host
 * knowledge, not platform knowledge (#36).
 *
 * So the platform stops guessing. Both pin affordances — the Grid Editor's
 * "Pin to Dashboard" switch and the grid header's pin button — render only
 * once a host has called {@link registerDashboardPinHost}, which is the host
 * saying "I have a surface that renders the pinned set." An app that has not
 * built one shows no control, and an operator is never offered a toggle that
 * changes nothing they can see.
 *
 * Registration is a module side-effect at boot (see `main.tsx`), exactly as
 * `navRegistry` and `searchSourceRegistry` are: reads happen during render,
 * after registration, so nothing re-renders to pick it up later.
 *
 * The preference itself is untouched — persistence, the API and the column all
 * stay. An app that registers a host tomorrow finds every pin its operators
 * already set still there.
 */

let hasHost = false;

/**
 * Declares that this application renders the grids an operator has pinned.
 *
 * Call it at boot, from the same module that registers nav items. Until it is
 * called, the platform hides every pin control rather than persisting a
 * preference nothing honours.
 */
export function registerDashboardPinHost(): void {
  hasHost = true;
}

/**
 * @returns True when a host has declared a surface that renders pinned grids —
 * the gate both pin affordances are drawn behind.
 */
export function hasDashboardPinHost(): boolean {
  return hasHost;
}

/** Test helper: drops the registration. Not used by application code. */
export function __clearDashboardPinHost(): void {
  hasHost = false;
}
