import { jsx, jsxs } from "react/jsx-runtime";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../ui/dialog.js";
import { Button } from "../ui/button.js";
import { cn } from "../../lib/utils.js";
import { log } from "../../utils/logger.js";
function GridFocusShell({
  open,
  onOpenChange,
  title,
  subtitle,
  toolbar,
  footer,
  children,
  onEscape,
  gridId,
  contentClassName
}) {
  const handleOpenChange = (next) => {
    log.info(
      { gridId, action: next ? "focus.enter" : "focus.exit" },
      `GridFocusShell: ${next ? "entered" : "left"} focus mode`
    );
    onOpenChange(next);
  };
  return /* @__PURE__ */ jsx(Dialog, { open, onOpenChange: handleOpenChange, children: /* @__PURE__ */ jsxs(
    DialogContent,
    {
      showCloseButton: false,
      className: "top-0 left-0 h-screen w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_1fr_auto] gap-0 rounded-none bg-background p-0 text-foreground sm:max-w-none",
      "aria-describedby": "grid-focus-shell-desc",
      onInteractOutside: (event) => event.preventDefault(),
      onPointerDownOutside: (event) => event.preventDefault(),
      onEscapeKeyDown: (event) => {
        if (!onEscape) return;
        event.preventDefault();
        log.info(
          { gridId, action: "focus.escape" },
          "GridFocusShell: Escape handed to the consumer"
        );
        onEscape();
      },
      children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2", children: [
          /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsx(DialogTitle, { className: "truncate", children: title }),
            subtitle ? /* @__PURE__ */ jsx(
              DialogDescription,
              {
                id: "grid-focus-shell-desc",
                className: "truncate text-xs",
                children: subtitle
              }
            ) : /* @__PURE__ */ jsx(DialogDescription, { id: "grid-focus-shell-desc", className: "sr-only", children: "Full-screen grid workspace. Press Escape to leave." })
          ] }),
          toolbar ? /* @__PURE__ */ jsx("div", { className: "flex flex-1 flex-wrap items-center gap-2", children: toolbar }) : null,
          /* @__PURE__ */ jsx(
            Button,
            {
              variant: "ghost",
              size: "icon-sm",
              className: "ml-auto",
              "aria-label": "Leave focus mode",
              onClick: () => onEscape ? onEscape() : handleOpenChange(false),
              children: /* @__PURE__ */ jsx(X, { className: "h-4 w-4" })
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: cn("min-h-0 overflow-auto p-3", contentClassName), children }),
        footer ? /* @__PURE__ */ jsx("div", { className: "border-t bg-card px-4 py-2", children: footer }) : null
      ]
    }
  ) });
}
export {
  GridFocusShell as default
};
//# sourceMappingURL=GridFocusShell.js.map
