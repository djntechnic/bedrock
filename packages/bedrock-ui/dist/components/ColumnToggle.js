import { jsxs, jsx } from "react/jsx-runtime";
import "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { Button } from "./ui/button.js";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover.js";
import { log } from "../utils/logger.js";
function ColumnToggle({ table, gridId }) {
  const toggleableColumns = table.getAllColumns().filter((col) => col.getCanHide());
  const visibleCount = toggleableColumns.filter((col) => col.getIsVisible()).length;
  const setAll = (next) => {
    log.info(
      { gridId, action: "column_toggle_all", visible: next },
      "ColumnToggle: all columns toggled"
    );
    toggleableColumns.forEach((col) => col.toggleVisibility(next));
  };
  return /* @__PURE__ */ jsxs(Popover, { children: [
    /* @__PURE__ */ jsx(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
      Button,
      {
        variant: "outline",
        size: "sm",
        className: "gap-1.5",
        "aria-label": "Toggle column visibility",
        children: [
          /* @__PURE__ */ jsx(Settings2, { className: "h-3.5 w-3.5" }),
          "Columns"
        ]
      }
    ) }),
    /* @__PURE__ */ jsxs(PopoverContent, { align: "end", collisionPadding: 12, className: "w-56 p-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2 px-2 pb-1.5 text-xs text-muted-foreground", children: [
        /* @__PURE__ */ jsxs("span", { children: [
          visibleCount,
          " of ",
          toggleableColumns.length,
          " shown"
        ] }),
        /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setAll(true),
              className: "rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground",
              children: "All"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              onClick: () => setAll(false),
              className: "rounded px-1.5 py-0.5 hover:bg-muted hover:text-foreground",
              children: "None"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "max-h-[min(60vh,20rem)] space-y-1 overflow-y-auto", children: toggleableColumns.map((col) => {
        const meta = col.columnDef.meta;
        const label = meta?.label ?? (typeof col.columnDef.header === "string" ? col.columnDef.header : null) ?? col.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return /* @__PURE__ */ jsxs(
          "label",
          {
            className: "flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm",
            children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  type: "checkbox",
                  checked: col.getIsVisible(),
                  onChange: (e) => {
                    log.info(
                      {
                        gridId,
                        action: "column_toggle",
                        columnId: col.id,
                        visible: e.target.checked
                      },
                      "ColumnToggle: visibility changed"
                    );
                    col.getToggleVisibilityHandler()(e);
                  },
                  className: "rounded"
                }
              ),
              label
            ]
          },
          col.id
        );
      }) })
    ] })
  ] });
}
export {
  ColumnToggle as default
};
//# sourceMappingURL=ColumnToggle.js.map
