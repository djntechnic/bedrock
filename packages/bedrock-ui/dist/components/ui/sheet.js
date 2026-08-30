import { jsx, jsxs } from "react/jsx-runtime";
import * as React from "react";
import { Dialog } from "radix-ui";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import { XIcon } from "lucide-react";
const Sheet = Dialog.Root;
const SheetTrigger = Dialog.Trigger;
const SheetClose = Dialog.Close;
const SheetPortal = Dialog.Portal;
const SheetOverlay = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  Dialog.Overlay,
  {
    "data-slot": "sheet-overlay",
    className: cn(
      "fixed inset-0 z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
      className
    ),
    ...props,
    ref
  }
));
SheetOverlay.displayName = Dialog.Overlay.displayName;
const SheetContent = React.forwardRef(({ className, children, side = "right", showCloseButton = true, showOverlay = true, ...props }, ref) => /* @__PURE__ */ jsxs(SheetPortal, { children: [
  showOverlay && /* @__PURE__ */ jsx(SheetOverlay, {}),
  /* @__PURE__ */ jsxs(
    Dialog.Content,
    {
      ref,
      "data-slot": "sheet-content",
      "data-side": side,
      className: cn(
        "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-[side=bottom]:data-open:slide-in-from-bottom-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:animate-out data-closed:fade-out-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=right]:data-closed:slide-out-to-right-10 data-[side=top]:data-closed:slide-out-to-top-10",
        className
      ),
      ...props,
      children: [
        children,
        showCloseButton && /* @__PURE__ */ jsx(Dialog.Close, { "data-slot": "sheet-close", asChild: true, children: /* @__PURE__ */ jsxs(
          Button,
          {
            variant: "ghost",
            className: "absolute top-3 right-3",
            size: "icon-sm",
            children: [
              /* @__PURE__ */ jsx(XIcon, {}),
              /* @__PURE__ */ jsx("span", { className: "sr-only", children: "Close" })
            ]
          }
        ) })
      ]
    }
  )
] }));
SheetContent.displayName = Dialog.Content.displayName;
const SheetHeader = ({ className, ...props }) => /* @__PURE__ */ jsx(
  "div",
  {
    "data-slot": "sheet-header",
    className: cn("flex flex-col gap-0.5 p-4", className),
    ...props
  }
);
SheetHeader.displayName = "SheetHeader";
const SheetFooter = ({ className, ...props }) => /* @__PURE__ */ jsx(
  "div",
  {
    "data-slot": "sheet-footer",
    className: cn("mt-auto flex flex-col gap-2 p-4", className),
    ...props
  }
);
SheetFooter.displayName = "SheetFooter";
const SheetTitle = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  Dialog.Title,
  {
    ref,
    "data-slot": "sheet-title",
    className: cn(
      "font-heading text-base font-medium text-foreground",
      className
    ),
    ...props
  }
));
SheetTitle.displayName = Dialog.Title.displayName;
const SheetDescription = React.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsx(
  Dialog.Description,
  {
    ref,
    "data-slot": "sheet-description",
    className: cn("text-sm text-muted-foreground", className),
    ...props
  }
));
SheetDescription.displayName = Dialog.Description.displayName;
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
};
//# sourceMappingURL=sheet.js.map
