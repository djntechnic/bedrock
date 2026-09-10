import { jsxs, jsx } from "react/jsx-runtime";
import { HelpCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "./ui/button.js";
import { Popover, PopoverTrigger, PopoverContent, PopoverHeader, PopoverTitle } from "./ui/popover.js";
import { useHelpConfig } from "../hooks/useHelpConfig.js";
import { cn } from "../lib/utils.js";
function SimpleMarkdown({ content }) {
  const paragraphs = content.split(/\n\n+/);
  return /* @__PURE__ */ jsx("div", { className: "space-y-2 text-xs leading-relaxed text-muted-foreground", children: paragraphs.map((p, idx) => {
    const parts = p.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return /* @__PURE__ */ jsx("p", { children: parts.map((part, partIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return /* @__PURE__ */ jsx("strong", { className: "font-semibold text-foreground", children: part.slice(2, -2) }, partIdx);
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return /* @__PURE__ */ jsx("em", { children: part.slice(1, -1) }, partIdx);
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return /* @__PURE__ */ jsx(
          "code",
          {
            className: "rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground",
            children: part.slice(1, -1)
          },
          partIdx
        );
      }
      return part;
    }) }, idx);
  }) });
}
function HelpPopover({
  topic,
  variant = "icon",
  align = "end",
  side = "bottom",
  className,
  triggerClassName
}) {
  const { helpEntry, isLoading, isError } = useHelpConfig(topic);
  return /* @__PURE__ */ jsxs(Popover, { children: [
    /* @__PURE__ */ jsx(PopoverTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(
      Button,
      {
        variant: variant === "subtle" ? "ghost" : variant === "button" ? "outline" : "ghost",
        size: "sm",
        className: cn(
          variant === "icon" && "h-6 w-6 p-0",
          "text-muted-foreground hover:text-foreground",
          triggerClassName
        ),
        "aria-label": `Help: ${topic}`,
        title: `Help: ${topic}`,
        children: [
          /* @__PURE__ */ jsx(HelpCircle, { className: "h-3.5 w-3.5" }),
          variant === "button" && /* @__PURE__ */ jsx("span", { className: "ml-1.5 text-xs", children: "Help" })
        ]
      }
    ) }),
    /* @__PURE__ */ jsx(
      PopoverContent,
      {
        align,
        side,
        className: cn("w-80 p-3.5 shadow-lg", className),
        children: isLoading ? /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-center py-4 text-xs text-muted-foreground", children: [
          /* @__PURE__ */ jsx(Loader2, { className: "mr-2 h-4 w-4 animate-spin" }),
          "Loading help topic..."
        ] }) : isError || !helpEntry ? /* @__PURE__ */ jsxs("div", { className: "py-2 text-xs text-muted-foreground", children: [
          /* @__PURE__ */ jsx("p", { className: "font-medium text-foreground mb-1", children: "Help topic unavailable" }),
          /* @__PURE__ */ jsxs("p", { className: "text-[11px]", children: [
            "No content is configured for topic ",
            /* @__PURE__ */ jsx("code", { className: "font-mono text-foreground", children: topic }),
            "."
          ] })
        ] }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2.5", children: [
          /* @__PURE__ */ jsx(PopoverHeader, { children: /* @__PURE__ */ jsx(PopoverTitle, { className: "text-xs font-semibold text-foreground tracking-tight", children: helpEntry.title }) }),
          /* @__PURE__ */ jsx(SimpleMarkdown, { content: helpEntry.body_markdown }),
          helpEntry.doc_url && /* @__PURE__ */ jsx("div", { className: "pt-1 mt-1 border-t border-border/50 flex justify-end", children: /* @__PURE__ */ jsx(
            Button,
            {
              variant: "outline",
              size: "sm",
              asChild: true,
              className: "h-7 text-xs gap-1.5 text-primary hover:text-primary",
              children: /* @__PURE__ */ jsxs(
                "a",
                {
                  href: helpEntry.doc_url,
                  target: "_blank",
                  rel: "noreferrer",
                  children: [
                    /* @__PURE__ */ jsx("span", { children: helpEntry.doc_label || "Documentation" }),
                    /* @__PURE__ */ jsx(ExternalLink, { className: "h-3 w-3" })
                  ]
                }
              )
            }
          ) })
        ] })
      }
    )
  ] });
}
export {
  HelpPopover as default
};
//# sourceMappingURL=HelpPopover.js.map
