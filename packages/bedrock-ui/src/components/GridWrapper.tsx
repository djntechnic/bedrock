/**
 * @file GridWrapper.tsx
 * @module frontend/src/components
 * @description Standardized container for grids with pagination and row count logic.
 */

import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "./ui/select";

interface GridWrapperProps<T> {
  /** The full set of data rows to be paginated. */
  rows: T[];
  /** Number of rows per page by default. */
  defaultPageSize?: number;
  /** Options available in the page size selector. */
  pageSizeOptions?: number[];
  /** Whether pagination controls should be displayed and logic applied. */
  paginationEnabled?: boolean;
  /** Whether to show the total row count and current page info. */
  showRowCount?: boolean;
  /** Override the displayed row count (e.g. server-side total). */
  totalOverride?: number;
  /** Render prop that receives the paginated slice of rows. */
  children: (paginatedRows: T[], totalRows: number) => React.ReactNode;
}

/**
 * Standardized container for grids that provides shared pagination and 
 * row count UI. Uses a render prop pattern to inject paginated data 
 * into the child grid component.
 */
export default function GridWrapper<T>({
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
  children,
}: GridWrapperProps<T>) {
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(1);

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  // Reset to page 1 when rows or pageSize changes.
  // Ensures the current page is always within the valid range.
  const safeRow = Math.min(page, totalPages);
  const currentPage = safeRow;

  const paginatedRows = useMemo(() => {
    if (!paginationEnabled) return rows;
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize, paginationEnabled]);

  return (
    <div className="space-y-2">
      {/* Row count display */}
      {showRowCount && (
        <p className="text-xs text-muted-foreground">
          {(totalOverride ?? totalRows).toLocaleString()} row{(totalOverride ?? totalRows) !== 1 ? "s" : ""}
          {paginationEnabled && totalPages > 1
            ? ` — page ${currentPage} of ${totalPages}`
            : ""}
        </p>
      )}

      {/* Grid content injected via render prop */}
      {children(paginatedRows, totalRows)}

      {/* Pagination controls */}
      {paginationEnabled && totalPages > 1 && (
        <div className="grid-pagination flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon"
              className="h-7 w-7"
              onClick={() => setPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline" size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2 tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline" size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline" size="icon"
              className="h-7 w-7"
              onClick={() => setPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-xs">
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
