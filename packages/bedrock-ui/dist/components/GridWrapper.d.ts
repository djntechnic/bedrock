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
export default function GridWrapper<T>({ rows, defaultPageSize, pageSizeOptions, paginationEnabled, showRowCount, totalOverride, pagination, children, }: GridWrapperProps<T>): import("react").JSX.Element;
export {};
