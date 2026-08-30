import { jsxs, jsx } from "react/jsx-runtime";
import { cn } from "../lib/utils.js";
function PageHeader({ title, subtitle, actions, badge, meta, breadcrumbs, className, sticky = false }) {
  const hasRight = actions || meta;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: cn(
        "space-y-2.5",
        sticky && // z-20 clears grid headers (z-10) and stays under popovers and
        // dialogs (z-50), so Columns and a confirm still open over it.
        "sticky top-0 z-20 -mx-4 bg-background px-4 pt-4 pb-2 sm:-mx-6 sm:px-6",
        className
      ),
      children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-start justify-between gap-4", children: [
          /* @__PURE__ */ jsxs("div", { className: "min-w-0 space-y-1", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [
              /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold tracking-tight text-foreground leading-tight", children: title }),
              badge
            ] }),
            subtitle && /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground mt-0.5 leading-snug", children: subtitle }),
            breadcrumbs && /* @__PURE__ */ jsx("div", { className: "pt-0.5", children: breadcrumbs })
          ] }),
          hasRight && /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2 shrink-0 pt-0.5", children: [
            meta && /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: meta }),
            actions
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "h-[2px] bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" })
      ]
    }
  );
}
export {
  PageHeader as default
};
//# sourceMappingURL=PageHeader.js.map
