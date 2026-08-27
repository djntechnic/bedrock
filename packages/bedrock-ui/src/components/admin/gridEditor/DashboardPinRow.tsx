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

import { SwitchRow } from "./editorFields";
import CollapsibleSection from "./CollapsibleSection";
import { useUserGridConfig } from "../../../hooks/useUserGridConfig";
import { hasDashboardPinHost } from "../../grids/dashboardPinRegistry";

interface DashboardPinRowProps {
  /** The grid being edited. */
  gridId: string;
}

export default function DashboardPinRow({ gridId }: DashboardPinRowProps) {
  const { dashboardPin, setDashboardPin, isReady } = useUserGridConfig(gridId);

  // #36 — the whole section goes, not just the switch: "My Preferences" with
  // nothing in it reads as a panel that failed to load. The preference itself
  // is untouched, so an app that registers a host later finds its operators'
  // pins exactly as they left them.
  if (!hasDashboardPinHost()) return null;

  return (
    <CollapsibleSection storageKey="grid.personal" title="My Preferences">
      <SwitchRow
        label="Pin to Dashboard"
        checked={dashboardPin}
        disabled={!isReady}
        onChange={setDashboardPin}
      />
      <p className="px-1 pt-1 text-xs text-muted-foreground">
        Yours alone, and saved as soon as you toggle it — it is not part of the
        grid configuration the Save button writes.
      </p>
    </CollapsibleSection>
  );
}
