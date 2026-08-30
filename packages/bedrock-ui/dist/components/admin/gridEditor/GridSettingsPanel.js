import { jsxs, jsx } from "react/jsx-runtime";
import { SwitchRow, NumberRow, TextRow, SelectRow, ColorRow } from "./editorFields.js";
import CollapsibleSection from "./CollapsibleSection.js";
import DashboardPinRow from "./DashboardPinRow.js";
function GridSettingsPanel({
  draftGrid,
  columnIds,
  setGridField
}) {
  const g = draftGrid;
  const bool = (v) => typeof v === "boolean" ? v : v === 1;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsxs(CollapsibleSection, { storageKey: "grid.pagination", title: "Pagination", children: [
      /* @__PURE__ */ jsx(
        SwitchRow,
        {
          label: "Pagination enabled",
          checked: bool(g.pagination_enabled),
          onChange: (v) => setGridField("pagination_enabled", v)
        }
      ),
      /* @__PURE__ */ jsx(
        NumberRow,
        {
          label: "Default page size",
          value: g.default_page_size,
          onChange: (v) => setGridField("default_page_size", v)
        }
      ),
      /* @__PURE__ */ jsx(
        TextRow,
        {
          label: "Page size options",
          value: g.page_size_options,
          placeholder: "25,50,100,250",
          onChange: (v) => setGridField("page_size_options", v)
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(CollapsibleSection, { storageKey: "grid.display", title: "Display", children: [
      /* @__PURE__ */ jsx(
        SwitchRow,
        {
          label: "Sticky header",
          checked: bool(g.sticky_header),
          onChange: (v) => setGridField("sticky_header", v)
        }
      ),
      /* @__PURE__ */ jsx(
        SwitchRow,
        {
          label: "Sticky first column",
          checked: bool(g.sticky_first_column),
          onChange: (v) => setGridField("sticky_first_column", v)
        }
      ),
      /* @__PURE__ */ jsx(
        SwitchRow,
        {
          label: "Allow column reorder (drag)",
          checked: bool(g.allow_column_reorder ?? true),
          onChange: (v) => setGridField("allow_column_reorder", v)
        }
      ),
      /* @__PURE__ */ jsx(
        SwitchRow,
        {
          label: "Allow row expansion",
          checked: bool(g.allow_expansion ?? false),
          onChange: (v) => setGridField("allow_expansion", v)
        }
      ),
      /* @__PURE__ */ jsx(
        SwitchRow,
        {
          label: "Row striping",
          checked: bool(g.row_striping),
          onChange: (v) => setGridField("row_striping", v)
        }
      ),
      /* @__PURE__ */ jsx(
        SwitchRow,
        {
          label: "Dense mode",
          checked: bool(g.dense_mode),
          onChange: (v) => setGridField("dense_mode", v)
        }
      ),
      /* @__PURE__ */ jsx(
        SwitchRow,
        {
          label: "Wrap text",
          checked: bool(g.wrap_text),
          onChange: (v) => setGridField("wrap_text", v)
        }
      ),
      /* @__PURE__ */ jsx(
        NumberRow,
        {
          label: "Min column width (px)",
          value: g.min_column_width,
          onChange: (v) => setGridField("min_column_width", v)
        }
      ),
      /* @__PURE__ */ jsx(
        SelectRow,
        {
          label: "Default sort column",
          value: g.default_sort_column ?? "",
          options: [{ value: "", label: "— none —" }, ...columnIds.map((c) => ({ value: c, label: c }))],
          onChange: (v) => setGridField("default_sort_column", v || null)
        }
      ),
      /* @__PURE__ */ jsx(
        SelectRow,
        {
          label: "Default sort direction",
          value: g.default_sort_direction ?? "",
          options: [{ value: "", label: "— none —" }, { value: "asc", label: "Ascending" }, { value: "desc", label: "Descending" }],
          onChange: (v) => setGridField("default_sort_direction", v || null)
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        storageKey: "grid.header",
        title: "Header controls",
        subtitle: "Toolbar affordances at the top of the grid.",
        children: [
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Column toggle",
              checked: bool(g.allow_column_toggle),
              onChange: (v) => setGridField("allow_column_toggle", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "CSV export",
              checked: bool(g.allow_export),
              onChange: (v) => setGridField("allow_export", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Print / PDF",
              checked: bool(g.allow_print),
              onChange: (v) => setGridField("allow_print", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Row count",
              checked: bool(g.show_row_count),
              onChange: (v) => setGridField("show_row_count", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Ranking column",
              checked: bool(g.show_ranking),
              onChange: (v) => setGridField("show_ranking", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Rank highlight",
              checked: bool(g.show_rank_highlight),
              onChange: (v) => setGridField("show_rank_highlight", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Selection checkbox column",
              checked: bool(g.allow_selection),
              onChange: (v) => setGridField("allow_selection", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SelectRow,
            {
              label: "Selection column position",
              value: g.selection_position ?? "end",
              options: [{ value: "end", label: "Right (last column)" }, { value: "start", label: "Left (first column)" }],
              onChange: (v) => setGridField("selection_position", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Inline search",
              checked: bool(g.show_search),
              onChange: (v) => setGridField("show_search", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Density toggle",
              checked: bool(g.show_density_toggle),
              onChange: (v) => setGridField("show_density_toggle", v)
            }
          ),
          /* @__PURE__ */ jsx(
            NumberRow,
            {
              label: "Tooltip delay (ms)",
              value: g.tooltip_delay_duration ?? void 0,
              placeholder: "150",
              onChange: (v) => setGridField("tooltip_delay_duration", Number.isNaN(v) ? null : v)
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs(CollapsibleSection, { storageKey: "grid.colors", title: "Sort & hover colors", children: [
      /* @__PURE__ */ jsx(
        ColorRow,
        {
          label: "Sort ascending",
          value: g.sort_asc_color,
          onChange: (v) => setGridField("sort_asc_color", v)
        }
      ),
      /* @__PURE__ */ jsx(
        ColorRow,
        {
          label: "Sort descending",
          value: g.sort_desc_color,
          onChange: (v) => setGridField("sort_desc_color", v)
        }
      ),
      /* @__PURE__ */ jsx(
        ColorRow,
        {
          label: "Row hover",
          value: g.hover_color,
          onChange: (v) => setGridField("hover_color", v)
        }
      )
    ] }),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        storageKey: "grid.liveStyle",
        title: "Live data & styling",
        subtitle: "§S9 scoreboard tokens — condensed numerals, changed-cell flash, row-accent rows.",
        children: [
          /* @__PURE__ */ jsx(
            SelectRow,
            {
              label: "Numeral style",
              value: g.numeral_style ?? "default",
              options: [{ value: "default", label: "Default" }, { value: "tabular", label: "Tabular (condensed)" }],
              onChange: (v) => setGridField("numeral_style", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Live update highlight",
              checked: bool(g.live_update_highlight ?? false),
              onChange: (v) => setGridField("live_update_highlight", v)
            }
          ),
          /* @__PURE__ */ jsx(
            SwitchRow,
            {
              label: "Row accent reactive",
              checked: bool(g.row_accent_reactive ?? false),
              onChange: (v) => setGridField("row_accent_reactive", v)
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs(
      CollapsibleSection,
      {
        storageKey: "grid.assignment",
        title: "Screen assignment",
        defaultOpen: false,
        children: [
          /* @__PURE__ */ jsx(
            TextRow,
            {
              label: "Page / screen",
              value: g.page ?? "",
              placeholder: "e.g. Rankings",
              onChange: (v) => setGridField("page", v || null)
            }
          ),
          /* @__PURE__ */ jsx(
            TextRow,
            {
              label: "Title",
              value: g.title ?? "",
              onChange: (v) => setGridField("title", v || null)
            }
          ),
          /* @__PURE__ */ jsx(
            TextRow,
            {
              label: "Sub-header",
              value: g.sub_header ?? "",
              onChange: (v) => setGridField("sub_header", v || null)
            }
          ),
          /* @__PURE__ */ jsx(
            TextRow,
            {
              label: "Footer note",
              value: g.footer ?? "",
              onChange: (v) => setGridField("footer", v || null)
            }
          ),
          /* @__PURE__ */ jsx(
            TextRow,
            {
              label: "Caption (a11y)",
              value: g.caption ?? "",
              placeholder: "Semantic <caption> text for screen readers",
              onChange: (v) => setGridField("caption", v || null)
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      CollapsibleSection,
      {
        storageKey: "grid.rowKey",
        title: "Row identity",
        subtitle: "Field that uniquely identifies each row — drives the selection column.",
        children: /* @__PURE__ */ jsx(
          TextRow,
          {
            label: "Row key column",
            value: g.row_key_column ?? "",
            placeholder: "e.g. player_id, mlb_id, card_id",
            onChange: (v) => setGridField("row_key_column", v || null)
          }
        )
      }
    ),
    /* @__PURE__ */ jsx(DashboardPinRow, { gridId: g.grid_id })
  ] });
}
export {
  GridSettingsPanel as default
};
//# sourceMappingURL=GridSettingsPanel.js.map
