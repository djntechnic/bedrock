import { jsx } from "react/jsx-runtime";
import { Medal } from "lucide-react";
function getRankRowClass(rank) {
  if (rank === 1) return "bg-amber-500/8 border-l-2 border-amber-400";
  if (rank === 2) return "bg-slate-400/8 border-l-2 border-slate-400";
  if (rank === 3) return "bg-orange-400/8 border-l-2 border-orange-400/70";
  return "";
}
function getRankIcon(rank) {
  if (rank === 1)
    return /* @__PURE__ */ jsx(Medal, { className: "h-3 w-3 text-amber-500 inline-block shrink-0" });
  if (rank === 2)
    return /* @__PURE__ */ jsx(Medal, { className: "h-3 w-3 text-slate-400 inline-block shrink-0" });
  if (rank === 3)
    return /* @__PURE__ */ jsx(Medal, { className: "h-3 w-3 text-orange-400 inline-block shrink-0" });
  return null;
}
export {
  getRankIcon,
  getRankRowClass
};
//# sourceMappingURL=rankStyle.js.map
