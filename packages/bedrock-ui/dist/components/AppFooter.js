import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { Keyboard } from "lucide-react";
import { Button } from "./ui/button.js";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip.js";
import { useKeyboardShortcuts } from "../context/KeyboardShortcutsContext.js";
import { useAppSettings } from "../hooks/useAppSettings.js";
function AppFooter({ tagline } = {}) {
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const { open } = useKeyboardShortcuts();
  const { system } = useAppSettings();
  return /* @__PURE__ */ jsx("footer", { className: "app-footer border-t border-border bg-card/80 px-6 py-2.5 shrink-0", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between text-xs text-muted-foreground", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
      /* @__PURE__ */ jsx("div", { className: "h-4 w-4 rounded bg-primary/10 flex items-center justify-center", children: /* @__PURE__ */ jsx("div", { className: "h-2 w-2 rounded-full bg-primary/60" }) }),
      /* @__PURE__ */ jsx("span", { className: "font-semibold text-foreground/80", children: system.appName }),
      tagline ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("span", { className: "text-border", children: "·" }),
        /* @__PURE__ */ jsx("span", { children: tagline })
      ] }) : null
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxs(Tooltip, { children: [
        /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
          Button,
          {
            variant: "ghost",
            size: "icon-sm",
            "aria-label": "Open keyboard shortcuts guide",
            onClick: () => open("footer_button"),
            children: /* @__PURE__ */ jsx(Keyboard, { className: "h-3.5 w-3.5" })
          }
        ) }),
        /* @__PURE__ */ jsx(TooltipContent, { children: "Keyboard shortcuts" })
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "text-muted-foreground/60", children: [
        "© ",
        year
      ] })
    ] })
  ] }) });
}
export {
  AppFooter as default
};
//# sourceMappingURL=AppFooter.js.map
