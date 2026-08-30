import { jsx } from "react/jsx-runtime";
import { cn } from "../../lib/utils.js";
const VARIANT_STYLE = {
  positive: { backgroundColor: "hsl(var(--positive) / 0.15)", color: "hsl(var(--positive))" },
  negative: { backgroundColor: "hsl(var(--negative) / 0.15)", color: "hsl(var(--negative))" },
  warning: { backgroundColor: "hsl(var(--warning)  / 0.15)", color: "hsl(var(--warning))" },
  neutral: { backgroundColor: "hsl(var(--neutral)  / 0.15)", color: "hsl(var(--neutral))" }
};
function StatBadge({ value, variant, className }) {
  return /* @__PURE__ */ jsx(
    "span",
    {
      className: cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5",
        "text-[11px] font-semibold tabular-nums leading-none whitespace-nowrap",
        className
      ),
      style: VARIANT_STYLE[variant],
      children: value
    }
  );
}
export {
  StatBadge
};
//# sourceMappingURL=stat-badge.js.map
