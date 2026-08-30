import { jsxs, jsx } from "react/jsx-runtime";
import "lucide-react";
import { cn } from "../lib/utils.js";
function EmptyState({ icon: Icon, title, description, action, className }) {
  return /* @__PURE__ */ jsxs("div", { className: cn("flex flex-col items-center justify-center py-12 text-center gap-2 px-4", className), children: [
    Icon && /* @__PURE__ */ jsx("div", { className: "h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-1", children: /* @__PURE__ */ jsx(Icon, { className: "h-5 w-5 text-muted-foreground" }) }),
    /* @__PURE__ */ jsx("p", { className: "text-sm font-medium text-foreground", children: title }),
    description && /* @__PURE__ */ jsx("p", { className: "text-xs text-muted-foreground max-w-xs", children: description }),
    action && /* @__PURE__ */ jsx("div", { className: "mt-2", children: action })
  ] });
}
export {
  EmptyState as default
};
//# sourceMappingURL=EmptyState.js.map
