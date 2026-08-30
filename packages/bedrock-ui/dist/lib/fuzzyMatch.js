function fuzzyScore(text, query) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();
  const substringIndex = t.indexOf(q);
  if (substringIndex !== -1) return 1e4 - substringIndex;
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
function fuzzyFilter(items, query, getText) {
  if (!query.trim()) return items;
  return items.map((item) => ({ item, score: fuzzyScore(getText(item), query) })).filter((r) => r.score !== null).sort((a, b) => b.score - a.score).map((r) => r.item);
}
export {
  fuzzyFilter,
  fuzzyScore
};
//# sourceMappingURL=fuzzyMatch.js.map
