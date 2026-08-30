import { jsx } from "react/jsx-runtime";
import { cn } from "../../lib/utils.js";
function SegmentedControl({
  options,
  value,
  onChange,
  size = "default",
  className
}) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: cn(
        "inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 gap-0.5",
        className
      ),
      children: options.map((opt) => {
        const active = opt.value === value;
        return /* @__PURE__ */ jsx(
          "button",
          {
            type: "button",
            onClick: () => onChange(opt.value),
            className: cn(
              "rounded-md font-medium transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
              active ? "bg-background text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            ),
            children: opt.label
          },
          opt.value
        );
      })
    }
  );
}
export {
  SegmentedControl
};
//# sourceMappingURL=segmented-control.js.map
