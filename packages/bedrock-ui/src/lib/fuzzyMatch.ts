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
export function fuzzyScore(text: string, query: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();

  const substringIndex = t.indexOf(q);
  if (substringIndex !== -1) return 10000 - substringIndex;

  let ti = 0;
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  while (ti < t.length && qi < q.length) {
    if (t[ti] === q[qi]) {
      consecutive += 1;
      score += consecutive;
      qi += 1;
    } else {
      consecutive = 0;
    }
    ti += 1;
  }
  return qi === q.length ? score : null;
}

/** Filters + sorts `items` by {@link fuzzyScore} against `getText(item)`, descending. */
export function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string): T[] {
  if (!query.trim()) return items;
  return items
    .map((item) => ({ item, score: fuzzyScore(getText(item), query) }))
    .filter((r): r is { item: T; score: number } => r.score !== null)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
}
