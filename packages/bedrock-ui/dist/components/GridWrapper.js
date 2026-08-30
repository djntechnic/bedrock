import { jsxs, jsx } from "react/jsx-runtime";
import { useState, useCallback, useEffect, useMemo } from "react";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { Button } from "./ui/button.js";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select.js";
function GridWrapper({
  rows,
  // Fallback used only when the consuming grid doesn't pass a value.
  // All wired grids pass config.defaultPageSize from useGridConfig.
  // If useGridConfig hasn't loaded yet, this value is shown briefly
  // before the config-driven value replaces it.
  defaultPageSize = 50,
  pageSizeOptions = [25, 50, 100, 250],
  paginationEnabled = true,
  showRowCount = true,
  totalOverride,
  pagination,
  children
}) {
  const manual = pagination?.manual === true;
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [internalPage, setInternalPage] = useState(1);
  const page = pagination?.page ?? internalPage;
  const totalRows = manual ? pagination.totalRows : rows.length;
  const totalPages = Math.max(
    1,
    manual && pagination.pageCount != null ? pagination.pageCount : Math.ceil(totalRows / pageSize)
  );
  const currentPage = Math.min(page, totalPages);
  const notify = pagination?.onPageChange;
  const goToPage = useCallback(
    (next) => {
      const clamped = Math.min(Math.max(1, next), totalPages);
      setInternalPage(clamped);
      notify?.(clamped, pageSize);
    },
    [totalPages, pageSize, notify]
  );
  const changePageSize = useCallback(
    (next) => {
      setPageSize(next);
      setInternalPage(1);
      notify?.(1, next);
    },
    [notify]
  );
  useEffect(() => {
    if (!manual) return;
    setPageSize(defaultPageSize);
    setInternalPage(1);
    notify?.(1, defaultPageSize);
  }, [defaultPageSize, manual]);
  const visibleRows = useMemo(() => {
    if (manual || !paginationEnabled) return rows;
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize, paginationEnabled, manual]);
  const displayTotal = manual ? totalRows : totalOverride ?? totalRows;
  const controlsDisabled = pagination?.isFetching === true;
  return /* @__PURE__ */ jsxs("div", { className: "space-y-2", children: [
    showRowCount && /* @__PURE__ */ jsxs("p", { className: "text-xs text-muted-foreground", children: [
      displayTotal.toLocaleString(),
      " row",
      displayTotal !== 1 ? "s" : "",
      paginationEnabled && totalPages > 1 ? ` — page ${currentPage} of ${totalPages}` : ""
    ] }),
    children(visibleRows, totalRows),
    paginationEnabled && totalPages > 1 && /* @__PURE__ */ jsxs("div", { className: "grid-pagination flex items-center justify-between pt-1", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1", children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "outline",
            size: "icon",
            className: "h-7 w-7",
            "aria-label": "First page",
            onClick: () => goToPage(1),
            disabled: controlsDisabled || currentPage === 1,
            children: /* @__PURE__ */ jsx(ChevronsLeft, { className: "h-3.5 w-3.5" })
          }
        ),
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "outline",
            size: "icon",
            className: "h-7 w-7",
            "aria-label": "Previous page",
            onClick: () => goToPage(currentPage - 1),
            disabled: controlsDisabled || currentPage === 1,
            children: /* @__PURE__ */ jsx(ChevronLeft, { className: "h-3.5 w-3.5" })
          }
        ),
        /* @__PURE__ */ jsxs("span", { className: "text-xs text-muted-foreground px-2 tabular-nums", children: [
          currentPage,
          " / ",
          totalPages
        ] }),
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "outline",
            size: "icon",
            className: "h-7 w-7",
            "aria-label": "Next page",
            onClick: () => goToPage(currentPage + 1),
            disabled: controlsDisabled || currentPage === totalPages,
            children: /* @__PURE__ */ jsx(ChevronRight, { className: "h-3.5 w-3.5" })
          }
        ),
        /* @__PURE__ */ jsx(
          Button,
          {
            variant: "outline",
            size: "icon",
            className: "h-7 w-7",
            "aria-label": "Last page",
            onClick: () => goToPage(totalPages),
            disabled: controlsDisabled || currentPage === totalPages,
            children: /* @__PURE__ */ jsx(ChevronsRight, { className: "h-3.5 w-3.5" })
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(
        Select,
        {
          value: String(pageSize),
          onValueChange: (v) => changePageSize(Number(v)),
          disabled: controlsDisabled,
          children: [
            /* @__PURE__ */ jsx(SelectTrigger, { className: "h-7 w-24 text-xs", children: /* @__PURE__ */ jsx(SelectValue, {}) }),
            /* @__PURE__ */ jsx(SelectContent, { children: pageSizeOptions.map((n) => /* @__PURE__ */ jsxs(SelectItem, { value: String(n), className: "text-xs", children: [
              n,
              " / page"
            ] }, n)) })
          ]
        }
      )
    ] })
  ] });
}
export {
  GridWrapper as default
};
//# sourceMappingURL=GridWrapper.js.map
