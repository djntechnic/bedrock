export interface DocumentHeadOptions {
    /** Page title. Combined with `titleTemplate` when both are given. */
    title?: string;
    /**
     * How the title is framed, with `%s` standing for `title` — usually
     * `"%s · My Site"`. Passing the site name here rather than concatenating at
     * every call site is what keeps one page from being the odd one out.
     */
    titleTemplate?: string;
    /** Meta description. Search results show roughly 155 characters of it. */
    description?: string;
    /**
     * Canonical URL for this page. Absolute.
     *
     * Worth setting on anything reachable at more than one URL — a filtered list
     * whose query string does not change the content, most obviously — because
     * otherwise search engines pick a winner themselves and split the ranking of
     * the ones they do not pick.
     */
    canonical?: string;
    /** Preview image, absolute. Relative URLs are ignored by most scrapers. */
    image?: string;
    /** `website`, `article`, `profile`. Defaults to `website`. */
    type?: string;
    /** Site name in the preview card, distinct from the page title. */
    siteName?: string;
    /**
     * Keeps the page out of search results while leaving it reachable. For a
     * staging deployment, or a page that is public but not worth indexing.
     */
    noIndex?: boolean;
}
/** Build the tag set for a page. Exported for testing and for a future SSR path. */
export declare function documentHeadTags(options: DocumentHeadOptions): {
    title: string | null;
    meta: Array<{
        attr: "name" | "property";
        key: string;
        value: string;
    }>;
    links: Array<{
        rel: string;
        href: string;
    }>;
};
/**
 * Set the document head for the current page.
 *
 * ```tsx
 * useDocumentHead({
 *   title: set.name,
 *   titleTemplate: "%s · RynoGuy",
 *   description: `Every card in ${set.name}.`,
 *   canonical: `https://rynoguy.com/sets/${set.id}`,
 *   image: set.coverUrl,
 * });
 * ```
 *
 * Values are applied on change and left in place on unmount. That is
 * deliberate: restoring the previous title as a route unmounts makes the
 * browser tab flicker back to the old page during the transition, and the next
 * route sets its own title a moment later anyway. A route that wants a page to
 * *not* be indexed sets `noIndex` rather than relying on teardown.
 */
export declare function useDocumentHead(options: DocumentHeadOptions): void;
/**
 * Remove every tag this module added. For tests, and for an application that
 * genuinely needs a clean head between routes.
 */
export declare function clearDocumentHead(): void;
