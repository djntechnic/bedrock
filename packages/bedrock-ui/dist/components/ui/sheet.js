import { jsx, jsxs } from "react/jsx-runtime";
import { Dialog } from "radix-ui";
import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
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
const sheetVariants = {
  top: "inset-x-0 top-0 border-b data-open:slide-in-from-top-10 data-closed:slide-out-to-top-10",
  bottom: "inset-x-0 bottom-0 border-t data-open:slide-in-from-bottom-10 data-closed:slide-out-to-bottom-10",
  left: "inset-y-0 left-0 h-full w-3/4 sm:max-w-sm border-r data-open:slide-in-from-left-10 data-closed:slide-out-to-left-10",
  right: "inset-y-0 right-0 h-full w-3/4 sm:max-w-sm border-l data-open:slide-in-from-right-10 data-closed:slide-out-to-right-10"
};
const SheetContent = React.forwardRef(
  ({
    className,
    children,
    side = "right",
    showCloseButton = true,
    showOverlay = true,
    ...props
  }, ref) => /* @__PURE__ */ jsxs(SheetPortal, { children: [
    showOverlay && /* @__PURE__ */ jsx(SheetOverlay, {}),
    /* @__PURE__ */ jsxs(
      Dialog.Content,
      {
        ref,
        "data-slot": "sheet-content",
        "data-side": side,
        className: cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          sheetVariants[side],
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
  ] })
);
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
