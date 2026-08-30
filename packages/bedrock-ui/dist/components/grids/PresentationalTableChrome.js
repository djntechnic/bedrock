import { jsxs, jsx } from "react/jsx-runtime";
import { cn } from "../../lib/utils.js";
import { GridStatusContent } from "../GridStatus.js";
const chromeClasses = {
  /** Outer container — rounded border + horizontal scroll fallback. */
  container: "rounded border overflow-auto bg-background",
  /** `<table>` — full width, border-collapse, text-sm baseline. */
  table: "w-full border-collapse text-sm",
  /** `<tr>` inside `<thead>` — sticky, border-bottom, muted background. */
  headerRow: "border-b bg-muted/50 sticky top-0 z-10",
  /** `<th>` — uppercase casing, muted foreground. Add `text-center`/`text-right` as needed. */
  headerCell: "px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap",
  /** `<tbody>` — zebra striping via `nth-child` selector. */
  body: "[&>tr:nth-child(even)]:bg-muted/20",
  /** `<tr>` inside `<tbody>` — border + hover. */
  row: "border-b border-border/40 hover:bg-muted/30 transition-colors",
  /** `<td>` — consistent padding + vertical align. */
  cell: "px-3 py-1.5 align-middle"
};
function PresentationalTableChrome({
  className,
  tableClassName,
  rowCount,
  countLabel,
  isLoading,
  isEmpty,
  emptyMessage,
  colSpan,
  toolbar,
  children
}) {
  const showCaption = rowCount != null || toolbar != null;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
    showCaption && /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-2", children: [
      rowCount != null ? /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground", children: [
        rowCount.toLocaleString(),
        " ",
        countLabel ?? (rowCount === 1 ? "row" : "rows")
      ] }) : /* @__PURE__ */ jsx("span", {}),
      toolbar
    ] }),
    /* @__PURE__ */ jsx("div", { className: cn(chromeClasses.container, className), children: /* @__PURE__ */ jsx("table", { className: cn(chromeClasses.table, tableClassName), children: isLoading ? /* @__PURE__ */ jsx("tbody", { children: /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: colSpan ?? 1, className: "p-0", children: /* @__PURE__ */ jsx(GridStatusContent, { type: "loading" }) }) }) }) : isEmpty ? /* @__PURE__ */ jsx("tbody", { children: /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", { colSpan: colSpan ?? 1, className: "p-0", children: /* @__PURE__ */ jsx(GridStatusContent, { type: "empty", message: emptyMessage }) }) }) }) : children }) })
  ] });
}
export {
  PresentationalTableChrome,
  chromeClasses
};
//# sourceMappingURL=PresentationalTableChrome.js.map
