import { jsx } from "react/jsx-runtime";
import "react";
import { Collapsible as Collapsible$1 } from "radix-ui";
function Collapsible({
  ...props
}) {
  return /* @__PURE__ */ jsx(Collapsible$1.Root, { "data-slot": "collapsible", ...props });
}
function CollapsibleTrigger({
  ...props
}) {
  return /* @__PURE__ */ jsx(Collapsible$1.Trigger, { "data-slot": "collapsible-trigger", ...props });
}
function CollapsibleContent({
  ...props
}) {
  return /* @__PURE__ */ jsx(Collapsible$1.Content, { "data-slot": "collapsible-content", ...props });
}
export {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
};
//# sourceMappingURL=collapsible.js.map
