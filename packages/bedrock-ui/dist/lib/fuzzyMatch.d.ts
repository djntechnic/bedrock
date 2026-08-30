/**
 * @file fuzzyMatch.ts
 * @module frontend/src/lib
 * @description Lightweight fuzzy scorer for client-side filtering (command
 *              palette static routes + team list). Not a general-purpose
 *              fuzzy-search library — just enough to rank an exact/substring
 *              match above a scattered subsequence match, for lists small
 *              enough (dozens of rows) that scoring cost is irrelevant.
 */
/**
 * Scores `text` against `query`. Returns `null` when `query`'s characters
 * don't appear as a (possibly non-contiguous) subsequence of `text`. Higher
 * scores rank first: an exact substring match always outranks a scattered
 * subsequence match, and among substring matches, an earlier occurrence
 * outranks a later one.
 */
export declare function fuzzyScore(text: string, query: string): number | null;
/** Filters + sorts `items` by {@link fuzzyScore} against `getText(item)`, descending. */
export declare function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string): T[];
