import { jsx, jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils.js";
const TONE_CLASSES = {
  default: "bg-muted text-muted-foreground",
  success: "bg-primary/10 text-primary",
  destructive: "bg-destructive/10 text-destructive"
};
function AuthFlowCard({
  icon: Icon,
  title,
  description,
  children,
  tone = "default",
  iconClassName
}) {
  return /* @__PURE__ */ jsx("div", { className: "min-h-[60vh] flex items-center justify-center", children: /* @__PURE__ */ jsxs("div", { className: "w-full max-w-md space-y-5 p-6", children: [
    /* @__PURE__ */ jsxs("div", { className: "text-center space-y-3", children: [
      /* @__PURE__ */ jsx(
        "div",
        {
          className: cn(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-full",
            TONE_CLASSES[tone]
          ),
          children: /* @__PURE__ */ jsx(Icon, { className: cn("h-7 w-7", iconClassName), "aria-hidden": true })
        }
      ),
      /* @__PURE__ */ jsx("h1", { className: "text-2xl font-semibold", children: title }),
      description ? /* @__PURE__ */ jsx("p", { className: "text-muted-foreground text-sm", children: description }) : null
    ] }),
    children
  ] }) });
}
export {
  AuthFlowCard as default
};
//# sourceMappingURL=AuthFlowCard.js.map
