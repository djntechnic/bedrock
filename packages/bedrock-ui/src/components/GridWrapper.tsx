/**
 * @file GridWrapper.tsx
 * @module @djntechnic/bedrock-ui/components
 * @description Standardized container for grids: pagination controls, page
 *              size selector, and the row count line.
 *
 * Two modes, and the default is unchanged from every existing call site.
 *
 * **Client-side (default).** `rows` is the whole dataset; this component
 * slices it. Correct right up until "the whole dataset" stops being something
 * you want to send to a browser.
 *
 * **Server-side.** Pass `pagination={{ manual: true, totalRows, onPageChange }}`
 * and `rows` becomes *one page*, already sliced by the server. Nothing here
 * slices it again, the row count and page arithmetic come from `totalRows`,
 * and every page or page-size change is handed to `onPageChange` to refetch
 * with.
 *
 * Additive prop rather than a second component because the two modes differ in
 * where the slicing happens and in nothing else — same controls, same layout,
 * same row-count line. A `ServerGridWrapper` would be this file copied with
 * four lines changed, and the copy would drift.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "./ui/select";

/** Server-side pagination. Supply this and the caller owns the slicing. */
export interface ManualPagination {
  /** Marks the mode. Literal `true` so the shape reads at the call site. */
  manual: true;
  /**
   * Total rows matching the query across every page, from the server.
   *
   * Required, because it is the one number this component cannot derive once
   * `rows` is a single page — and without it the pager cannot know whether
   * there is a next page at all.
   */
  totalRows: number;
  /**
   * Page count, when the server reports one. Derived from `totalRows` and the
   * page size otherwise.
   *
   * Worth passing when the row count is approximate — a large Postgres table
   * often uses an estimate rather than a `COUNT(*)` that scans — because then
   * the page count is authoritative and the total is not.
   */
  pageCount?: number;
  /**
   * Current page (1-based) when the caller owns the state, for a page number
   * in the URL. Omit to let this component hold it.
   */
  page?: number;
  /**
   * Called on every page or page-size change, including the resets this
   * component performs itself. Refetch with these values.
   */
  onPageChange: (page: number, pageSize: number) => void;
  /** Disables the controls during a refetch, so a double-click cannot skip a page. */
  isFetching?: boolean;
}

interface GridWrapperProps<T> {
  /** The rows to render: the whole dataset, or one page when `pagination.manual`. */
  rows: T[];
  /** Number of rows per page by default. */
  defaultPageSize?: number;
  /** Options available in the page size selector. */
  pageSizeOptions?: number[];
  /** Whether pagination controls should be displayed and logic applied. */
  paginationEnabled?: boolean;
  /** Whether to show the total row count and current page info. */
  showRowCount?: boolean;
  /**
   * Override the displayed row count.
   *
   * Superseded by `pagination.totalRows`, which drives the arithmetic as well
   * as the label. Kept working for the call sites that already pass it.
   */
  totalOverride?: number;
  /** Server-side pagination. Omit for the client-side default. */
  pagination?: ManualPagination;
  /** Render prop that receives the rows to display and the total row count. */
  children: (paginatedRows: T[], totalRows: number) => React.ReactNode;
}

/**
 * Standardized container for grids that provides shared pagination and
 * row count UI. Uses a render prop pattern to inject the visible rows
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
  pagination,
  children,
}: GridWrapperProps<T>) {
  const manual = pagination?.manual === true;

  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [internalPage, setInternalPage] = useState(1);

  // Controlled when the caller passes `page`, uncontrolled otherwise. Both,
  // because a page number in the URL is a normal thing to want and impossible
  // if this component insists on owning the state.
  const page = pagination?.page ?? internalPage;

  // In manual mode `rows` is one page, so its length says nothing about the
  // size of the result — the server's count is the only source for that.
  const totalRows = manual ? pagination!.totalRows : rows.length;
  const totalPages = Math.max(
    1,
    manual && pagination!.pageCount != null
      ? pagination!.pageCount
      : Math.ceil(totalRows / pageSize),
  );

  // Clamp for display. This deliberately does *not* reset the stored page:
  // staying put and clamping when the row set shrinks is the existing
  // client-side behaviour, and changing it would move every grid already
  // shipped.
  const currentPage = Math.min(page, totalPages);

  const notify = pagination?.onPageChange;

  const goToPage = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(1, next), totalPages);
      setInternalPage(clamped);
      notify?.(clamped, pageSize);
    },
    [totalPages, pageSize, notify],
  );

  const changePageSize = useCallback(
    (next: number) => {
      setPageSize(next);
      // Page 1, always. Page 4 of 50-row pages is a different set of rows than
      // page 4 of 100-row pages, so keeping the number shows something else
      // without saying so.
      setInternalPage(1);
      notify?.(1, next);
    },
    [notify],
  );

  // Tell the caller which size to fetch once the configured default arrives.
  // `useGridConfig` resolves after first paint, so without this a
  // server-paginated grid fetches 50 rows and then renders a pager built for
  // the admin-configured size.
  useEffect(() => {
    if (!manual) return;
    setPageSize(defaultPageSize);
    setInternalPage(1);
    notify?.(1, defaultPageSize);
    // Keyed on the configured size alone: adding `notify` would refetch on
    // every render where the caller passes an inline arrow, which is most of
    // them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPageSize, manual]);

  const visibleRows = useMemo(() => {
    // The server already sliced. Slicing again takes the first `pageSize` rows
    // of a page that is already exactly that long — invisible until the last
    // page, which would then be silently truncated.
    if (manual || !paginationEnabled) return rows;
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize, paginationEnabled, manual]);

  const displayTotal = manual ? totalRows : (totalOverride ?? totalRows);
  const controlsDisabled = pagination?.isFetching === true;

  return (
    <div className="space-y-2">
      {/* Row count display */}
      {showRowCount && (
        <p className="text-xs text-muted-foreground">
          {displayTotal.toLocaleString()} row{displayTotal !== 1 ? "s" : ""}
          {paginationEnabled && totalPages > 1
            ? ` — page ${currentPage} of ${totalPages}`
            : ""}
        </p>
      )}

      {/* Grid content injected via render prop */}
      {children(visibleRows, totalRows)}

      {/* Pagination controls */}
      {paginationEnabled && totalPages > 1 && (
        <div className="grid-pagination flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="icon"
              className="h-7 w-7"
              aria-label="First page"
              onClick={() => goToPage(1)}
              disabled={controlsDisabled || currentPage === 1}
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline" size="icon"
              className="h-7 w-7"
              aria-label="Previous page"
              onClick={() => goToPage(currentPage - 1)}
              disabled={controlsDisabled || currentPage === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2 tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline" size="icon"
              className="h-7 w-7"
              aria-label="Next page"
              onClick={() => goToPage(currentPage + 1)}
              disabled={controlsDisabled || currentPage === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline" size="icon"
              className="h-7 w-7"
              aria-label="Last page"
              onClick={() => goToPage(totalPages)}
              disabled={controlsDisabled || currentPage === totalPages}
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Select
            value={String(pageSize)}
            onValueChange={(v) => changePageSize(Number(v))}
            disabled={controlsDisabled}
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
