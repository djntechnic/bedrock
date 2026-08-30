import { jsxs, jsx } from "react/jsx-runtime";
import { SwitchRow } from "./editorFields.js";
import CollapsibleSection from "./CollapsibleSection.js";
import { useUserGridConfig } from "../../../hooks/useUserGridConfig.js";
import { hasDashboardPinHost } from "../../grids/dashboardPinRegistry.js";
function DashboardPinRow({ gridId }) {
  const { dashboardPin, setDashboardPin, isReady } = useUserGridConfig(gridId);
  if (!hasDashboardPinHost()) return null;
  return /* @__PURE__ */ jsxs(CollapsibleSection, { storageKey: "grid.personal", title: "My Preferences", children: [
    /* @__PURE__ */ jsx(
      SwitchRow,
      {
        label: "Pin to Dashboard",
        checked: dashboardPin,
        disabled: !isReady,
        onChange: setDashboardPin
      }
    ),
    /* @__PURE__ */ jsx("p", { className: "px-1 pt-1 text-xs text-muted-foreground", children: "Yours alone, and saved as soon as you toggle it — it is not part of the grid configuration the Save button writes." })
  ] });
}
export {
  DashboardPinRow as default
};
//# sourceMappingURL=DashboardPinRow.js.map
