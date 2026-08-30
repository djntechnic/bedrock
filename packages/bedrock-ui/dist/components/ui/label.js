import { jsx } from "react/jsx-runtime";
import * as React from "react";
import { Label as Label$1 } from "radix-ui";
import { cn } from "../../lib/utils.js";
const Label = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  Label$1.Root,
  {
    ref,
    "data-slot": "label",
    className: cn(
      "flex items-center gap-1.5 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className
    ),
    ...props
  }
));
Label.displayName = Label$1.Root.displayName;
export {
  Label
};
//# sourceMappingURL=label.js.map
