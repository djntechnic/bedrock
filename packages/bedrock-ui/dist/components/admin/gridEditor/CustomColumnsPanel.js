import { jsxs, jsx } from "react/jsx-runtime";
import { Badge } from "../../ui/badge.js";
import { SwitchRow } from "./editorFields.js";
import CollapsibleSection from "./CollapsibleSection.js";
const bool = (v) => typeof v === "boolean" ? v : v === 1;
function CustomColumnsPanel({
  draftGrid,
  setGridField
}) {
  const g = draftGrid;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground px-1", children: [
      "These columns are ",
      /* @__PURE__ */ jsx("em", { children: "injected" }),
      " by the grid runtime — they don't have a row in ",
      /* @__PURE__ */ jsx("code", { children: "app_grid_column_settings" }),
      ". Toggling any of them updates the live preview."
    ] }),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        storageKey: "custom.selection",
        title: "Selection column",
        subtitle: "Prepends checkboxes so admins can pick rows for comparison.",
        badge: /* @__PURE__ */ jsx(Badge, { variant: bool(g.allow_selection) ? "default" : "outline", className: "text-[10px]", children: bool(g.allow_selection) ? "On" : "Off" }),
        children: [
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Enable selection column",
              checked: bool(g.allow_selection),
              onChange: (v) => setGridField("allow_selection", v)
            }
          ),
          /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-muted-foreground", children: [
            "Wired via ",
            /* @__PURE__ */ jsx("code", { children: "prependSelectionColumn()" }),
            " in",
            " ",
            /* @__PURE__ */ jsx("code", { children: "lib/gridUtils" }),
            ". Not a React prop — this flag is the source of truth for every consumer."
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        storageKey: "custom.ranking",
        title: "Ranking column",
        subtitle: "Numeric rank based on the current sort order.",
        badge: /* @__PURE__ */ jsx(Badge, { variant: bool(g.show_ranking) ? "default" : "outline", className: "text-[10px]", children: bool(g.show_ranking) ? "On" : "Off" }),
        children: [
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Show ranking column",
              checked: bool(g.show_ranking),
              onChange: (v) => setGridField("show_ranking", v)
            }
          ),
          /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-muted-foreground", children: [
            "Wired via ",
            /* @__PURE__ */ jsx("code", { children: "prependRankColumn()" }),
            " in",
            " ",
            /* @__PURE__ */ jsx("code", { children: "utils/gridUtils" }),
            ". Shows numeric row rank. Enable Rank highlight below to add rank icons for top 3 positions."
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        storageKey: "custom.rankHighlight",
        title: "Rank highlight",
        subtitle: "Highlights the top three rows with gold / silver / bronze accents.",
        badge: /* @__PURE__ */ jsx(Badge, { variant: bool(g.show_rank_highlight) ? "default" : "outline", className: "text-[10px]", children: bool(g.show_rank_highlight) ? "On" : "Off" }),
        children: [
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Show rank highlight",
              checked: bool(g.show_rank_highlight),
              onChange: (v) => setGridField("show_rank_highlight", v)
            }
          ),
          /* @__PURE__ */ jsxs("p", { className: "text-[11px] text-muted-foreground", children: [
            "Drives both the row-styling via ",
            /* @__PURE__ */ jsx("code", { children: "getRankRowClass()" }),
            " and the rank-highlight toggle in ",
            /* @__PURE__ */ jsx("code", { children: "GridHeader" }),
            "."
          ] })
        ]
      }
    )
  ] });
}
export {
  CustomColumnsPanel as default
};
//# sourceMappingURL=CustomColumnsPanel.js.map
