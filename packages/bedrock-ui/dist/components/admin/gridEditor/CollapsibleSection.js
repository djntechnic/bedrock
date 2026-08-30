import { jsxs, jsx } from "react/jsx-runtime";
import "react";
import { ChevronDown } from "lucide-react";
import { Card } from "../../ui/card.js";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "../../ui/collapsible.js";
import { cn } from "../../../lib/utils.js";
import { usePersistedDisclosure } from "../../../hooks/usePersistedDisclosure.js";
function CollapsibleSection({
  storageKey,
  title,
  subtitle,
  badge,
  defaultOpen = true,
  boxed = true,
  className,
  contentClassName,
  children
}) {
  const [open, setOpen] = usePersistedDisclosure(storageKey, defaultOpen);
  const inner = /* @__PURE__ */ jsxs(Collapsible, { open, onOpenChange: setOpen, children: [
    /* @__PURE__ */ jsxs(
      CollapsibleTrigger,
      {
        className: cn(
          "flex w-full items-center gap-2 rounded-t-md px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          !boxed && "px-0"
        ),
        "aria-expanded": open,
        "data-testid": `collapsible-trigger-${storageKey}`,
        children: [
          /* @__PURE__ */ jsx(
            ChevronDown,
            {
              className: cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                !open && "-rotate-90"
              )
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "flex-1 min-w-0", children: [
            /* @__PURE__ */ jsx("div", { className: "text-sm font-semibold text-foreground", children: title }),
            subtitle && /* @__PURE__ */ jsx("div", { className: "text-xs text-muted-foreground truncate", children: subtitle })
          ] }),
          badge && /* @__PURE__ */ jsx("div", { className: "shrink-0", children: badge })
        ]
      }
    ),
    /* @__PURE__ */ jsx(
      CollapsibleContent,
      {
        className: cn(
          "overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        ),
        children: /* @__PURE__ */ jsx("div", { className: cn("px-3 pb-3 space-y-3", !boxed && "px-0", contentClassName), children })
      }
    )
  ] });
  if (!boxed) return /* @__PURE__ */ jsx("div", { className, children: inner });
  return /* @__PURE__ */ jsx(Card, { className: cn("py-0 overflow-hidden", className), children: inner });
}
export {
  CollapsibleSection as default
};
//# sourceMappingURL=CollapsibleSection.js.map
