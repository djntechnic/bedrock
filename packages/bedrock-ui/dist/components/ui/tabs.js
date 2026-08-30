import { jsx } from "react/jsx-runtime";
import "react";
import { Tabs as Tabs$1 } from "radix-ui";
import { cn } from "../../lib/utils.js";
function Tabs({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    Tabs$1.Root,
    {
      "data-slot": "tabs",
      className: cn("flex flex-col gap-2", className),
      ...props
    }
  );
}
function TabsList({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    Tabs$1.List,
    {
      "data-slot": "tabs-list",
      className: cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className
      ),
      ...props
    }
  );
}
function TabsTrigger({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    Tabs$1.Trigger,
    {
      "data-slot": "tabs-trigger",
      className: cn(
        "inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
        className
      ),
      ...props
    }
  );
}
function TabsContent({
  className,
  ...props
}) {
  return /* @__PURE__ */ jsx(
    Tabs$1.Content,
    {
      "data-slot": "tabs-content",
      className: cn(
        "flex-1 outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      ),
      ...props
    }
  );
}
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
};
//# sourceMappingURL=tabs.js.map
