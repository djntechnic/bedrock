import { jsx, jsxs } from "react/jsx-runtime";
import { Fragment } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet.js";
import { useKeyboardShortcuts } from "../context/KeyboardShortcutsContext.js";
function Kbd({ children }) {
  return /* @__PURE__ */ jsx("kbd", { className: "inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground shadow-sm", children });
}
function KeyboardShortcutsSheet() {
  const { isOpen, setOpen, groups, config } = useKeyboardShortcuts();
  return /* @__PURE__ */ jsx(
    Sheet,
    {
      open: isOpen,
      onOpenChange: (next) => setOpen(next, next ? "programmatic" : "escape"),
      children: /* @__PURE__ */ jsxs(
        SheetContent,
        {
          side: "right",
          className: "w-full sm:max-w-md gap-0",
          "aria-label": "Keyboard shortcuts reference",
          children: [
            /* @__PURE__ */ jsxs(SheetHeader, { className: "border-b border-border", children: [
              /* @__PURE__ */ jsx(SheetTitle, { children: "Keyboard Shortcuts" }),
              /* @__PURE__ */ jsxs(SheetDescription, { children: [
                "Press",
                " ",
                /* @__PURE__ */ jsx("kbd", { className: "rounded border border-border bg-muted px-1 font-mono text-[0.7rem]", children: config.helpKey }),
                " ",
                "anytime to open this reference."
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "flex-1 overflow-y-auto p-4 space-y-6", children: groups.map((group) => /* @__PURE__ */ jsxs("section", { "aria-label": group.title, children: [
              /* @__PURE__ */ jsx("h3", { className: "mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", children: group.title }),
              /* @__PURE__ */ jsx("ul", { className: "space-y-1.5", children: group.bindings.map((binding) => /* @__PURE__ */ jsxs(
                "li",
                {
                  "data-shortcut-id": binding.id,
                  className: "flex items-center justify-between gap-4 rounded-md px-2 py-1.5 hover:bg-muted/50",
                  children: [
                    /* @__PURE__ */ jsx("span", { className: "text-sm text-foreground", children: binding.label }),
                    /* @__PURE__ */ jsx("span", { className: "flex items-center gap-1.5", children: binding.keys.map((chord, ci) => /* @__PURE__ */ jsxs(Fragment, { children: [
                      ci > 0 && /* @__PURE__ */ jsx("span", { className: "text-xs text-muted-foreground", children: "/" }),
                      /* @__PURE__ */ jsx("span", { className: "flex items-center gap-0.5", children: (Array.isArray(chord) ? chord : [chord]).map(
                        (k, ki) => /* @__PURE__ */ jsxs(Fragment, { children: [
                          ki > 0 && /* @__PURE__ */ jsx("span", { className: "text-[0.65rem] text-muted-foreground", children: "+" }),
                          /* @__PURE__ */ jsx(Kbd, { children: k })
                        ] }, ki)
                      ) })
                    ] }, ci)) })
                  ]
                },
                binding.id
              )) })
            ] }, group.id)) })
          ]
        }
      )
    }
  );
}
export {
  KeyboardShortcutsSheet as default
};
//# sourceMappingURL=KeyboardShortcutsSheet.js.map
