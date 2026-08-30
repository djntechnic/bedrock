import { useState, useEffect, useCallback } from "react";
import "@tanstack/react-query";
import "../api/client.js";
import "../context/AppConfigContext.js";
import "../types/grid.js";
import { useUserGridConfig } from "./useUserGridConfig.js";
function useTableState(gridId) {
  const {
    adminConfig: config,
    merged,
    isReady,
    persistSorting,
    persistColumnVisible,
    persistColumnOrder,
    persistFilters,
    dashboardPin,
    setDashboardPin
  } = useUserGridConfig(gridId);
  const [sorting, setSortingState] = useState([]);
  const [columnVisibility, setColumnVisibilityState] = useState({});
  useEffect(() => {
    if (!isReady) return;
    setSortingState(merged.sorting);
    setColumnVisibilityState(merged.columnVisibility);
  }, [isReady, gridId]);
  const setSorting = useCallback(
    (update) => {
      setSortingState((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        persistSorting(next);
        return next;
      });
    },
    [persistSorting]
  );
  const setColumnVisibility = useCallback(
    (update) => {
      setColumnVisibilityState((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        for (const [columnId, visible] of Object.entries(next)) {
          if (prev[columnId] !== visible) persistColumnVisible(columnId, !!visible);
        }
        return next;
      });
    },
    [persistColumnVisible]
  );
  const cellPad = config.denseMode ? "px-2 py-1" : "px-3 py-2";
  const headerClassName = config.stickyHeader ? "sticky top-0 z-10" : "";
  const bodyClassName = config.rowStriping ? "[&>tr:nth-child(even)]:bg-muted/20" : "";
  const rowClassName = !config.wrapText ? "whitespace-nowrap" : "";
  return {
    config,
    sorting,
    setSorting,
    columnVisibility,
    setColumnVisibility,
    cellPad,
    headerClassName,
    bodyClassName,
    rowClassName,
    isLoaded: isReady,
    pinnedFilters: merged.pinnedFilters,
    columnOrder: merged.columnOrder,
    persistFilters,
    persistColumnOrder,
    dashboardPin,
    setDashboardPin
  };
}
export {
  useTableState
};
//# sourceMappingURL=useTableState.js.map
