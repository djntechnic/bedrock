import { jsxs, jsx } from "react/jsx-runtime";
import { useRef, useEffect } from "react";
import { Search, X, Undo2, Save, AlignJustify, Pin, PinOff, Download, Printer } from "lucide-react";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip.js";
import ColumnToggle from "../ColumnToggle.js";
import { DENSITY_LABEL } from "../../hooks/useDensity.js";
import { DEFAULT_TOOLTIP_DELAY } from "../../types/grid.js";
import { log } from "../../utils/logger.js";
function useRecordCount(table) {
  return table.options.getFilteredRowModel ? table.getFilteredRowModel().rows.length : table.getRowModel().rows.length;
}
function GridHeader({
  table,
  config,
  density,
  onDensityChange,
  onExport,
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filtersSlot,
  bulkDirty = false,
  bulkSaving = false,
  onBulkSave,
  onBulkDiscard,
  dashboardPin,
  onDashboardPinToggle
}) {
  const recordCount = useRecordCount(table);
  const tipDelay = config.tooltipDelayDuration ?? DEFAULT_TOOLTIP_DELAY;
  const showDensity = config.showDensityToggle && density !== void 0 && !!onDensityChange;
  const showSearch = config.showSearch && !!onSearchChange;
  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    log.info(
      { gridId: config.gridId, action: "mount", recordCount },
      "GridHeader: mounted"
    );
  }, [config.gridId]);
  function handleSearchChange(value) {
    log.info(
      { gridId: config.gridId, action: "search", query: value, recordCount },
      "GridHeader: search filter changed"
    );
    onSearchChange?.(value);
  }
  function handleDensityChange() {
    log.info(
      { gridId: config.gridId, action: "density", recordCount },
      "GridHeader: density changed"
    );
    onDensityChange?.();
  }
  function handleExport() {
    log.info(
      { gridId: config.gridId, action: "export", recordCount },
      "GridHeader: export requested"
    );
    onExport?.();
  }
  function handlePrint() {
    log.info(
      { gridId: config.gridId, action: "print", recordCount },
      "GridHeader: print layout requested"
    );
    if (typeof window !== "undefined" && typeof window.print === "function") {
      window.print();
    }
  }
  const hasTitleBlock = !!config.title || !!config.subHeader;
  return /* @__PURE__ */ jsxs(TooltipProvider, { delayDuration: tipDelay, children: [
    hasTitleBlock && /* @__PURE__ */ jsxs("div", { className: "mb-2 space-y-0.5", children: [
      config.title && /* @__PURE__ */ jsx("h2", { className: "text-base font-semibold leading-tight", children: config.title }),
      config.subHeader && /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground leading-snug", children: config.subHeader })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
        config.showRowCount ? /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground whitespace-nowrap", children: [
          recordCount.toLocaleString(),
          " row",
          recordCount !== 1 ? "s" : ""
        ] }) : /* @__PURE__ */ jsx("span", {}),
        showSearch && /* @__PURE__ */ jsxs("div", { className: "relative min-w-[180px] max-w-xs", children: [
          /* @__PURE__ */ jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              value: search ?? "",
              onChange: (e) => handleSearchChange(e.target.value),
              placeholder: searchPlaceholder,
              "aria-label": "Search grid rows",
              className: "pl-9 h-[34px] text-sm"
            }
          ),
          search && /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              "aria-label": "Clear search",
              className: "absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted",
              onClick: () => handleSearchChange(""),
              children: /* @__PURE__ */ jsx(X, { className: "h-3.5 w-3.5" })
            }
          )
        ] }),
        filtersSlot && /* @__PURE__ */ jsx("div", { "data-slot": "grid-header-filters", className: "flex items-center gap-2", children: filtersSlot })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        bulkDirty && (onBulkSave || onBulkDiscard) && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
          onBulkDiscard && /* @__PURE__ */ jsxs(
            Button,
            {
              variant: "ghost",
              size: "sm",
              className: "gap-1.5",
              "aria-label": "Discard unsaved edits",
              disabled: bulkSaving,
              onClick: () => {
                log.info(
                  { gridId: config.gridId, action: "bulk-discard", recordCount },
                  "GridHeader: bulk discard"
                );
                onBulkDiscard();
              },
              children: [
                /* @__PURE__ */ jsx(Undo2, { className: "h-3.5 w-3.5" }),
                "Discard"
              ]
            }
          ),
          onBulkSave && /* @__PURE__ */ jsxs(
            Button,
            {
              size: "sm",
              className: "gap-1.5",
              "aria-label": "Save unsaved edits",
              disabled: bulkSaving,
              onClick: () => {
                log.info(
                  { gridId: config.gridId, action: "bulk-save", recordCount },
                  "GridHeader: bulk save"
                );
                void onBulkSave();
              },
              children: [
                /* @__PURE__ */ jsx(Save, { className: "h-3.5 w-3.5" }),
                bulkSaving ? "Saving…" : "Save"
              ]
            }
          )
        ] }),
        showDensity && /* @__PURE__ */ jsxs(Tooltip, { children: [
          /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
            Button,
            {
              variant: density !== "standard" ? "secondary" : "outline",
              size: "sm",
              "aria-label": `Row density · ${DENSITY_LABEL[density]}`,
              onClick: handleDensityChange,
              children: /* @__PURE__ */ jsx(AlignJustify, { className: "h-3.5 w-3.5" })
            }
          ) }),
          /* @__PURE__ */ jsxs(TooltipContent, { side: "top", className: "text-xs", children: [
            "Row density · ",
            DENSITY_LABEL[density]
          ] })
        ] }),
        config.allowColumnToggle && /* @__PURE__ */ jsx(ColumnToggle, { table, gridId: config.gridId }),
        dashboardPin !== void 0 && onDashboardPinToggle && /* @__PURE__ */ jsxs(Tooltip, { children: [
          /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
            Button,
            {
              variant: dashboardPin ? "secondary" : "outline",
              size: "sm",
              "aria-label": dashboardPin ? "Unpin from dashboard" : "Pin to dashboard",
              "aria-pressed": dashboardPin,
              onClick: () => {
                log.info(
                  { gridId: config.gridId, action: "dashboard_pin", pinned: !dashboardPin },
                  "GridHeader: dashboard pin toggled"
                );
                onDashboardPinToggle();
              },
              children: dashboardPin ? /* @__PURE__ */ jsx(Pin, { className: "h-3.5 w-3.5 fill-current" }) : /* @__PURE__ */ jsx(PinOff, { className: "h-3.5 w-3.5" })
            }
          ) }),
          /* @__PURE__ */ jsx(TooltipContent, { side: "top", className: "text-xs", children: dashboardPin ? "Unpin from dashboard" : "Pin to dashboard" })
        ] }),
        config.allowExport && onExport && /* @__PURE__ */ jsxs(
          Button,
          {
            variant: "outline",
            size: "sm",
            className: "gap-1.5",
            "aria-label": "Export grid to CSV",
            onClick: handleExport,
            children: [
              /* @__PURE__ */ jsx(Download, { className: "h-3.5 w-3.5" }),
              "CSV"
            ]
          }
        ),
        config.allowPrintView && /* @__PURE__ */ jsxs(Tooltip, { children: [
          /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
            Button,
            {
              variant: "outline",
              size: "sm",
              className: "gap-1.5 print:hidden",
              "aria-label": "Trigger page print layout",
              onClick: handlePrint,
              children: [
                /* @__PURE__ */ jsx(Printer, { className: "h-3.5 w-3.5" }),
                /* @__PURE__ */ jsx("span", { className: "sr-only sm:not-sr-only", children: "Print" })
              ]
            }
          ) }),
          /* @__PURE__ */ jsx(TooltipContent, { side: "top", className: "text-xs", children: "Print / save as PDF" })
        ] })
      ] })
    ] })
  ] });
}
export {
  GridHeader as default
};
//# sourceMappingURL=GridHeader.js.map
