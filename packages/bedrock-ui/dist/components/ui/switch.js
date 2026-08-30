import { jsx } from "react/jsx-runtime";
import * as React from "react";
import { Switch as Switch$1 } from "radix-ui";
import { cn } from "../../lib/utils.js";
const Switch = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  Switch$1.Root,
  {
    ref,
    "data-slot": "switch",
    className: cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      className
    ),
    ...props,
    children: /* @__PURE__ */ jsx(
      Switch$1.Thumb,
      {
        "data-slot": "switch-thumb",
        className: cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
        )
      }
    )
  }
));
Switch.displayName = Switch$1.Root.displayName;
export {
  Switch
};
//# sourceMappingURL=switch.js.map
