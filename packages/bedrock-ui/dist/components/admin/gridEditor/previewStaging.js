function stageValue(row, columnId, cellType) {
  if (columnId in row) return row[columnId];
  if (cellType === "number" || cellType === "currency") {
    let h = 0;
    for (const ch of columnId) h = (h * 31 + ch.charCodeAt(0)) % 997;
    const base = typeof row.rank === "number" ? row.rank : 1;
    return Number((h % 100 / 100 + base).toFixed(3));
  }
  return null;
}
export {
  stageValue
};
//# sourceMappingURL=previewStaging.js.map
