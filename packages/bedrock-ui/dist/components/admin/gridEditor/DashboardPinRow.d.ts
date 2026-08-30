/**
 * @file DashboardPinRow.tsx
 * @module frontend/src/components/admin/gridEditor
 * @description The Grid Editor's "Pin to Dashboard" control.
 *
 * Its own component, and its own section on the panel, because it is the one
 * setting there that is **not** a grid setting. `dashboard_pin` lives in
 * `user_grid_preferences` — it is per-operator, saves immediately, and is not
 * part of the draft the Save button writes. Folding it into
 * `GridSettingsPanel`'s `setGridField` flow would have written it to
 * `app_grid_settings`, where nothing reads it, and the pin would have appeared
 * to work until the admin reloaded.
 *
 * It renders at all only for a host that has called
 * `registerDashboardPinHost()` — see `components/grids/dashboardPinRegistry`.
 */
interface DashboardPinRowProps {
    /** The grid being edited. */
    gridId: string;
}
export default function DashboardPinRow({ gridId }: DashboardPinRowProps): import("react").JSX.Element | null;
export {};
