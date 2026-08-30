import { jsx, jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils.js";
function Breadcrumb({ items, separator, className }) {
  const defaultSeparator = /* @__PURE__ */ jsx(ChevronRight, { className: "h-3 w-3 text-muted-foreground/60 shrink-0 select-none" });
  return /* @__PURE__ */ jsx("nav", { "aria-label": "Breadcrumb", className: cn(className), children: /* @__PURE__ */ jsx("ol", { className: "flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap", children: items.map((item, index) => {
    const isLast = index === items.length - 1;
    return /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-1.5", children: [
      index > 0 && /* @__PURE__ */ jsx("span", { "aria-hidden": "true", className: "select-none flex items-center", children: separator ?? defaultSeparator }),
      isLast || !item.href ? /* @__PURE__ */ jsx("span", { className: isLast ? "text-foreground font-medium" : void 0, children: item.label }) : /* @__PURE__ */ jsx(
        Link,
        {
          to: item.href,
          className: "hover:text-foreground transition-colors",
          children: item.label
        }
      )
    ] }, index);
  }) }) });
}
export {
  Breadcrumb as default
};
//# sourceMappingURL=Breadcrumb.js.map
