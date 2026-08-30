import { jsx, jsxs } from "react/jsx-runtime";
import { getRankIcon } from "./rankStyle.js";
function parseHexColor(hex) {
  const h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16)
    };
  }
  if (h.length === 6) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }
  return null;
}
function getGradientCellStyle(value, colMin, colMax, fromColor, toColor) {
  if (colMin === colMax) return {};
  const from = parseHexColor(fromColor);
  const to = parseHexColor(toColor);
  if (!from || !to) return {};
  const t = Math.max(0, Math.min(1, (value - colMin) / (colMax - colMin)));
  const r = Math.round(from.r + t * (to.r - from.r));
  const g = Math.round(from.g + t * (to.g - from.g));
  const b = Math.round(from.b + t * (to.b - from.b));
  return { backgroundColor: `rgb(${r},${g},${b})` };
}
function computeColumnMinMax(rows, columnId) {
  const vals = rows.map((r) => r[columnId]).filter((v) => typeof v === "number");
  if (vals.length === 0) return null;
  return { min: Math.min(...vals), max: Math.max(...vals) };
}
function applyColumnSizing(col, gridMinColumnWidth = 60) {
  return {
    size: col.width ?? void 0,
    minSize: Math.max(col.min_width || 0, gridMinColumnWidth),
    maxSize: col.max_width ?? void 0
  };
}
function prependRankColumn(cols, showRanking, colHelper, showRankIcon = false, position = "end") {
  if (!showRanking) return cols;
  const rankCell = (info) => {
    const rank = info.table.getRowModel().rows.findIndex((r) => r.id === info.row.id) + 1;
    const icon = showRankIcon ? getRankIcon(rank) : null;
    return /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1 text-muted-foreground tabular-nums", children: [
      icon,
      rank
    ] });
  };
  const existingIdx = cols.findIndex((c) => c.id === "ranking");
  if (existingIdx !== -1) {
    const existing = cols[existingIdx];
    const updated = {
      ...existing,
      enableSorting: false,
      cell: rankCell
    };
    const nextCols = [...cols];
    nextCols[existingIdx] = updated;
    return nextCols;
  }
  const rankCol = colHelper.display({
    id: "ranking",
    header: () => /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: "#" }),
    size: 50,
    enableSorting: false,
    enableHiding: false,
    cell: rankCell
  });
  return position === "start" ? [rankCol, ...cols] : [...cols, rankCol];
}
function prependSelectionColumn(cols, allowSelection, selectedIds, onSelectionChange, idField = "mlb_id", position = "end", options = {}) {
  if (!allowSelection) return cols;
  const {
    maxSelected,
    headerLabel = "Sel",
    headerTitle = "Select rows",
    cellTitle = "Select row",
    cellTitleAtLimit = "Selection limit reached"
  } = options;
  const checkCell = ({ row }) => {
    const id = row.original[idField];
    if (id == null) return null;
    const checked = selectedIds.includes(id);
    const disabled = !checked && maxSelected !== void 0 && selectedIds.length >= maxSelected;
    return /* @__PURE__ */ jsx(
      "input",
      {
        type: "checkbox",
        checked,
        disabled,
        title: disabled ? cellTitleAtLimit : cellTitle,
        onClick: (e) => e.stopPropagation(),
        onChange: (e) => {
          e.stopPropagation();
          if (e.target.checked) {
            onSelectionChange([...selectedIds, id]);
          } else {
            onSelectionChange(selectedIds.filter((x) => x !== id));
          }
        },
        className: "h-4 w-4 cursor-pointer disabled:opacity-30"
      }
    );
  };
  const existingIdx = cols.findIndex((c) => c.id === "_compare");
  if (existingIdx !== -1) {
    const existing = cols[existingIdx];
    const updated = {
      ...existing,
      enableSorting: false,
      cell: checkCell
    };
    const nextCols = [...cols];
    nextCols[existingIdx] = updated;
    return nextCols;
  }
  const checkCol = {
    id: "_compare",
    header: () => /* @__PURE__ */ jsx(
      "span",
      {
        className: "text-xs font-medium text-muted-foreground",
        title: headerTitle,
        children: headerLabel
      }
    ),
    size: 36,
    enableSorting: false,
    enableHiding: false,
    cell: checkCell
  };
  return position === "start" ? [checkCol, ...cols] : [...cols, checkCol];
}
function computeAggValue(rows, columnId, aggFn) {
  const vals = rows.map((r) => r[columnId]).filter((v) => typeof v === "number");
  if (vals.length === 0) return null;
  switch (aggFn) {
    case "sum":
      return vals.reduce((a, b) => a + b, 0);
    case "avg":
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "min":
      return Math.min(...vals);
    case "max":
      return Math.max(...vals);
    case "count":
      return vals.length;
  }
}
function formatAggValue(value, formatString) {
  if (value == null) return "—";
  const fmt = formatString ?? "";
  if (fmt.includes(".3f")) return value.toFixed(3);
  if (fmt.includes(".2f")) return value.toFixed(2);
  if (fmt.includes(".1f")) return value.toFixed(1);
  return Math.round(value).toLocaleString();
}
function hasAggregates(colConfigs) {
  return Object.values(colConfigs).some(
    (c) => c.aggregate_function && !!c.default_visible
  );
}
export {
  applyColumnSizing,
  computeAggValue,
  computeColumnMinMax,
  formatAggValue,
  getGradientCellStyle,
  hasAggregates,
  prependRankColumn,
  prependSelectionColumn
};
//# sourceMappingURL=gridUtils.js.map
