import { jsx } from "react/jsx-runtime";
import "react";
function PageToolbar({ children, className, noWrap }) {
  const flexClass = noWrap ? "flex flex-nowrap items-end overflow-x-auto" : "flex flex-wrap items-center";
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: `page-toolbar ${flexClass} gap-2 p-3 rounded-lg border border-border bg-card/60 backdrop-blur-sm ${className ?? ""}`,
      children
    }
  );
}
export {
  PageToolbar as default
};
//# sourceMappingURL=PageToolbar.js.map
