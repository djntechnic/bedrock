function unchanged(next, original) {
  return next === original || next == null && original == null;
}
function applyDraft(prev, write) {
  const { rowKey, columnId, nextValue, originalValue } = write;
  const rowDrafts = { ...prev[rowKey] ?? {} };
  if (unchanged(nextValue, originalValue)) {
    delete rowDrafts[columnId];
  } else {
    rowDrafts[columnId] = nextValue;
  }
  const next = { ...prev };
  if (Object.keys(rowDrafts).length === 0) {
    delete next[rowKey];
  } else {
    next[rowKey] = rowDrafts;
  }
  return next;
}
function applyDrafts(prev, writes) {
  return writes.reduce(applyDraft, prev);
}
function isDirty(drafts) {
  return Object.keys(drafts).length > 0;
}
export {
  applyDraft,
  applyDrafts,
  isDirty
};
//# sourceMappingURL=bulkDraftStore.js.map
