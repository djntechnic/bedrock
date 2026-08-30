import { jsx } from "react/jsx-runtime";
import { cn } from "../../lib/utils.js";
function Skeleton({ className, ...props }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-slot": "skeleton",
      className: cn("animate-pulse rounded-md bg-muted/50", className),
      ...props
    }
  );
}
export {
  Skeleton
};
//# sourceMappingURL=skeleton.js.map
