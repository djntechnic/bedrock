/**
 * @file searchSourceRegistry.ts
 * @module frontend/src/components
 * @description Extension point for the command palette's entity search.
 *
 * The palette owns the dialog, the keyboard shortcut, fuzzy matching over
 * static routes, and the recent/pinned registry — all of which are generic.
 * It owned one thing that is not: knowing that this app searches *players*
 * and *teams*, which pulled the baseball search hook and two MLB image
 * components into a shell component.
 *
 * A source contributes one result group. `useResults` is a hook, so a source
 * is free to fetch however it likes; the palette renders each source in its
 * own child component precisely so those hooks are isolated per source and
 * cannot shift each other's hook order.
 *
 * Registration is import-time (see components/domain/searchSources.tsx), and
 * the palette snapshots the list on first render, so the set is fixed for the
 * lifetime of a palette instance.
 */
import type { ReactNode } from "react";
/** One row in a source's result group. */
export interface SearchSourceResult {
    /** Unique within the source; used as the React key and the item value. */
    id: string | number;
    /** Primary text. */
    label: string;
    /** Leading icon or image. */
    icon?: ReactNode;
    /** Trailing hint — an abbreviation, a badge, a secondary logo. */
    hint?: ReactNode;
    /** Route to navigate to on select. */
    to: string;
}
/** What a source's hook returns each render. */
export interface SearchSourceState {
    results: SearchSourceResult[];
    /** Drives the "Searching…" placeholder while a first page is in flight. */
    isFetching?: boolean;
}
export interface SearchSource {
    /** Stable identifier, also used in navigation logs. */
    id: string;
    /** Group heading shown above the results. */
    heading: string;
    /** When set, the source is skipped unless the module is enabled. */
    module?: string;
    /** Sort key fixing group order below the static routes. Ties break on
     *  registration order. */
    order?: number;
    /**
     * Hook returning the current results for `query`.
     *
     * @param query - The raw palette query, untrimmed.
     * @param enabled - False when the palette is closed or the query is too
     *                  short; a source should skip fetching when false.
     */
    useResults: (query: string, enabled: boolean) => SearchSourceState;
}
/** Where "See all results" navigates. Optional — with none registered the
 *  palette simply omits that row. */
export interface SearchAllTarget {
    module?: string;
    to: (query: string) => string;
}
/** Register a result group. Re-registering an id overwrites, so repeated
 *  imports stay idempotent. */
export declare function registerSearchSource(source: SearchSource): void;
/** :returns: Registered sources in display order. */
export declare function getSearchSources(): SearchSource[];
/** Register the "See all results" destination. */
export declare function registerSearchAllTarget(target: SearchAllTarget): void;
/** :returns: The registered "see all" destination, or null. */
export declare function getSearchAllTarget(): SearchAllTarget | null;
/** Test helper: drops every registration. Not used by application code. */
export declare function __clearSearchSources(): void;
