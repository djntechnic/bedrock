import { jsx, jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils.js";
import { Badge } from "../ui/badge.js";
import { StatBadge } from "../ui/stat-badge.js";
import { getConditionalClass, getConditionalVariant } from "../../utils/conditionalFormat.js";
import { getRankIcon } from "../../utils/rankStyle.js";
import { resolveMediaRenderer, resolveColumnRenderer } from "./cellRegistry.js";
import { getMediaCellTypes } from "./cellRegistry.js";
function isCompositeCellPayload(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v) && "value" in v && "meta" in v && typeof v.meta === "object";
}
function unwrapCellPayload(v) {
  if (isCompositeCellPayload(v)) return { value: v.value, meta: v.meta };
  return { value: v, meta: {} };
}
function resolveLinkPath(linkTarget, ctx) {
  if (!linkTarget) return null;
  const pick = (...keys) => {
    for (const k of keys) {
      if (ctx.meta[k] != null) return ctx.meta[k];
      if (ctx.row[k] != null) return ctx.row[k];
    }
    return null;
  };
  switch (linkTarget) {
    case "player_page": {
      const id = pick("player_id", "mlb_id");
      return id == null ? null : `/players/${id}`;
    }
    case "team_page": {
      const id = pick("team_id", "mlb_team_id");
      return id == null ? null : `/teams/${id}`;
    }
    case "set_page": {
      const id = pick("set_id");
      return id == null ? null : `/inventory/sets/${id}`;
    }
    case "card_page": {
      const id = pick("card_id");
      return id == null ? null : `/inventory/cards/${id}`;
    }
    default:
      return null;
  }
}
function renderRankCell(rank) {
  const icon = getRankIcon(rank);
  return /* @__PURE__ */ jsxs("span", { className: "flex items-center gap-1 text-muted-foreground tabular-nums", children: [
    icon,
    rank
  ] });
}
function renderMediaCell(cellType, value, row) {
  const render = resolveMediaRenderer(cellType);
  return render ? render(value, row) : void 0;
}
function renderCell(value, col, columnId, gradientStyle, navigate, playerId, linkCtx, numeralStyle) {
  if (value == null) return col?.null_display ?? "—";
  const conditionalClass = getConditionalClass(value, col?.conditional_format);
  const conditionalVariant = getConditionalVariant(value, col?.conditional_format);
  const numeralClass = col?.cell_type === "number" && numeralStyle === "tabular" ? "tabular-nums" : void 0;
  let content = value;
  switch (col?.cell_type) {
    case "number": {
      const n = Number(value);
      if (isNaN(n)) {
        content = String(value);
      } else {
        const rateCols = [
          "ba",
          "obp",
          "slg",
          "ops",
          "b_ba",
          "b_obp",
          "b_slg",
          "b_ops",
          "delta_ba",
          "delta_obp",
          "delta_slg",
          "delta_ops"
        ];
        const fmt = col.format_string;
        if (rateCols.includes(columnId)) {
          content = n.toFixed(3);
        } else if (fmt === ".3f" || fmt === "0.000") {
          content = n.toFixed(3);
        } else if (fmt === ".2f" || fmt === "0.00") {
          content = n.toFixed(2);
        } else if (fmt === ".1f" || fmt === "0.0") {
          content = n.toFixed(1);
        } else {
          content = Math.round(n).toLocaleString();
        }
      }
      break;
    }
    case "badge":
      return /* @__PURE__ */ jsx(Badge, { variant: "outline", className: "font-normal", children: String(value) });
    case "boolean": {
      const truthy = value === true || value === 1 || value === "1" || typeof value === "string" && value.toLowerCase() === "true";
      return /* @__PURE__ */ jsx(
        "span",
        {
          "aria-label": truthy ? "true" : "false",
          className: truthy ? "text-positive font-semibold" : "text-muted-foreground",
          children: truthy ? "✓" : "—"
        }
      );
    }
    case "currency": {
      const c = Number(value);
      content = isNaN(c) ? String(value) : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c);
      break;
    }
    case "date":
      try {
        content = new Date(String(value)).toLocaleDateString();
      } catch {
        content = String(value);
      }
      break;
    case "text":
    default:
      content = String(value);
  }
  if (col?.link_target && navigate) {
    let path = null;
    if (linkCtx) {
      path = resolveLinkPath(col.link_target, linkCtx);
    }
    if (!path && col.link_target === "player_page" && playerId) {
      path = `/players/${playerId}`;
    }
    if (path) {
      return /* @__PURE__ */ jsx(
        "button",
        {
          onClick: (e) => {
            e.stopPropagation();
            navigate(path);
          },
          className: cn("text-left hover:underline text-primary font-medium", conditionalClass, numeralClass),
          style: gradientStyle,
          children: content
        }
      );
    }
  }
  if (gradientStyle) {
    return /* @__PURE__ */ jsx("span", { className: numeralClass, style: gradientStyle, children: content });
  }
  if (conditionalVariant) {
    return /* @__PURE__ */ jsx(StatBadge, { value: String(content), variant: conditionalVariant });
  }
  return /* @__PURE__ */ jsx("span", { className: cn(conditionalClass, numeralClass), children: content });
}
function resolveCell(columnId, value, row, options) {
  const render = resolveColumnRenderer(columnId);
  return render ? render(value, row, options) : void 0;
}
export {
  getMediaCellTypes,
  isCompositeCellPayload,
  renderCell,
  renderMediaCell,
  renderRankCell,
  resolveCell,
  resolveLinkPath,
  unwrapCellPayload
};
//# sourceMappingURL=cellRenderers.js.map
