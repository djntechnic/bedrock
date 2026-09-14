import { jsx } from "react/jsx-runtime";
import { Medal } from "lucide-react";
function getRankRowClass(rank) {
  if (rank === 1) return "bg-rank-gold/8 border-l-2 border-rank-gold";
  if (rank === 2) return "bg-rank-silver/8 border-l-2 border-rank-silver";
  if (rank === 3) return "bg-rank-bronze/8 border-l-2 border-rank-bronze/70";
  return "";
}
function getRankIcon(rank) {
  if (rank === 1)
    return /* @__PURE__ */ jsx(Medal, { className: "h-3 w-3 text-rank-gold inline-block shrink-0" });
  if (rank === 2)
    return /* @__PURE__ */ jsx(Medal, { className: "h-3 w-3 text-rank-silver inline-block shrink-0" });
  if (rank === 3)
    return /* @__PURE__ */ jsx(Medal, { className: "h-3 w-3 text-rank-bronze inline-block shrink-0" });
  return null;
}
export {
  getRankIcon,
  getRankRowClass
};
//# sourceMappingURL=rankStyle.js.map
