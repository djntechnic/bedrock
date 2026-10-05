import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { useId, useState, useRef, useEffect } from "react";
import { PanelLeftOpen, PanelLeftClose, Plus } from "lucide-react";
import { cn } from "../../lib/utils.js";
import { PermissionButton } from "../../hooks/useSecurity.js";
import EmptyState from "../EmptyState.js";
import PageHeader from "../PageHeader.js";
import { Button, buttonVariants } from "../ui/button.js";
import { Input } from "../ui/input.js";
import { SegmentedControl } from "../ui/segmented-control.js";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs.js";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip.js";
import { useWorkbenchRail } from "./useWorkbenchRail.js";
const FILTER_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" }
];
function isOverflowing(root) {
  if (root.scrollWidth > root.clientWidth) return true;
  return Array.from(root.querySelectorAll("*")).some((el) => el.scrollWidth > el.clientWidth);
}
function RailCardTip({ children }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const openIfClipped = () => {
    const root = rootRef.current;
    if (!root || !isOverflowing(root)) return;
    setText((root.textContent ?? "").trim());
    setOpen(true);
  };
  return (
    // Self-provided so every workbench page and test mounts the rail without wiring one.
    /* @__PURE__ */ jsx(TooltipProvider, { children: /* @__PURE__ */ jsxs(Tooltip, { open, onOpenChange: (next) => !next && setOpen(false), children: [
      /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsx(
        "div",
        {
          ref: rootRef,
          onPointerEnter: openIfClipped,
          onPointerLeave: () => setOpen(false),
          onFocus: openIfClipped,
          onBlur: () => setOpen(false),
          children
        }
      ) }),
      /* @__PURE__ */ jsx(TooltipContent, { side: "right", children: text })
    ] }) })
  );
}
function WorkbenchShell({
  title,
  railLabel,
  items,
  renderCard,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  railHeader,
  search,
  onSearchChange,
  onCreate,
  createPermission,
  createDisabledReason,
  tabs,
  activeTab,
  onTabChange,
  dirty,
  onDiscard,
  detailHeader,
  footer,
  headerActions,
  bodyOverride,
  children
}) {
  const baseId = useId();
  const guardLabelId = `${baseId}-guard`;
  const createReasonId = `${baseId}-create-reason`;
  const railId = `${baseId}-rail`;
  const optionId = (id) => `${baseId}-option-${id}`;
  const rail = useWorkbenchRail();
  const RailIcon = rail.collapsed ? PanelLeftOpen : PanelLeftClose;
  const [pending, setPending] = useState(null);
  const keepEditingRef = useRef(null);
  const listRef = useRef(null);
  const returnFocusRef = useRef(null);
  const [activeId, setActiveId] = useState(selectedId);
  useEffect(() => setActiveId(selectedId), [selectedId]);
  const activeFound = items.findIndex((item) => item.id === activeId);
  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const activeIndex = activeFound >= 0 ? activeFound : Math.max(selectedIndex, 0);
  const activeItem = items[activeIndex];
  useEffect(() => {
    if (activeItem) document.getElementById(optionId(activeItem.id))?.scrollIntoView({ block: "nearest" });
  }, [activeItem?.id]);
  useEffect(() => {
    if (pending) keepEditingRef.current?.focus();
  }, [pending]);
  useEffect(() => {
    if (!dirty) setPending(null);
  }, [dirty]);
  const guard = (action) => {
    if (dirty) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPending(() => action);
    } else action();
  };
  const keepEditing = () => {
    setPending(null);
    (returnFocusRef.current ?? listRef.current)?.focus();
  };
  const discard = () => {
    const action = pending;
    setPending(null);
    onDiscard?.();
    action?.();
  };
  const select = (index) => {
    const item = items[index];
    if (!item) return;
    setActiveId(item.id);
    if (item.id !== selectedId) guard(() => onSelect(item.id));
  };
  const onListKeyDown = (event) => {
    if (items.length === 0) return;
    const moves = {
      ArrowDown: Math.min(activeIndex + 1, items.length - 1),
      ArrowUp: Math.max(activeIndex - 1, 0),
      Home: 0,
      End: items.length - 1
    };
    if (event.key in moves) {
      event.preventDefault();
      setActiveId(items[moves[event.key]].id);
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(activeIndex);
    }
  };
  const guardGroup = pending && /* @__PURE__ */ jsxs(
    "div",
    {
      role: "group",
      "aria-labelledby": guardLabelId,
      onKeyDown: (event) => {
        if (event.key === "Escape") keepEditing();
      },
      className: "shrink-0 mx-6 mt-3 flex items-center justify-between gap-3 rounded-md border border-warning bg-warning/10 px-4 py-2",
      children: [
        /* @__PURE__ */ jsx("p", { id: guardLabelId, className: "text-sm font-medium text-foreground", children: "Discard unsaved changes?" }),
        /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
          /* @__PURE__ */ jsx(Button, { ref: keepEditingRef, variant: "outline", size: "sm", onClick: keepEditing, children: "Keep editing" }),
          /* @__PURE__ */ jsx(Button, { variant: "destructive", size: "sm", onClick: discard, children: "Discard" })
        ] })
      ]
    }
  );
  return /* @__PURE__ */ jsxs("div", { className: "flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-background", children: [
    /* @__PURE__ */ jsxs("div", { className: "shrink-0 flex items-start justify-between gap-4 px-6 pt-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        !bodyOverride && /* @__PURE__ */ jsx(
          Button,
          {
            variant: "ghost",
            size: "icon",
            "aria-label": `${rail.collapsed ? "Show" : "Hide"} ${railLabel}`,
            "aria-expanded": !rail.collapsed,
            "aria-controls": railId,
            onClick: rail.toggle,
            children: /* @__PURE__ */ jsx(RailIcon, { className: "size-4", "aria-hidden": "true" })
          }
        ),
        /* @__PURE__ */ jsx(PageHeader, { title })
      ] }),
      headerActions
    ] }),
    bodyOverride ? /* @__PURE__ */ jsx("div", { "data-testid": "workbench-override", className: "flex-1 min-h-0 overflow-y-auto px-6 py-4", children: bodyOverride }) : /* @__PURE__ */ jsxs("div", { className: "flex-1 min-h-0 flex", children: [
      /* @__PURE__ */ jsxs(
        "aside",
        {
          id: railId,
          "data-testid": "workbench-rail",
          ...rail.collapsed ? { inert: "" } : {},
          className: cn(
            "shrink-0 flex flex-col min-h-0 bg-card",
            rail.collapsed ? "w-0 border-r-0 overflow-hidden" : "w-80 border-r border-border",
            rail.animate && "transition-[width] duration-200"
          ),
          children: [
            /* @__PURE__ */ jsxs("div", { className: "shrink-0 flex flex-col gap-2 p-3 border-b border-border", children: [
              railHeader ?? (filter !== void 0 && onFilterChange && /* @__PURE__ */ jsx(
                SegmentedControl,
                {
                  options: FILTER_OPTIONS,
                  value: filter,
                  onChange: (next) => {
                    if (next !== filter) guard(() => onFilterChange(next));
                  },
                  size: "sm"
                }
              )),
              /* @__PURE__ */ jsx(
                Input,
                {
                  type: "search",
                  "aria-label": `Search ${railLabel}`,
                  placeholder: `Search ${railLabel.toLowerCase()}`,
                  value: search,
                  onChange: (event) => onSearchChange(event.target.value)
                }
              )
            ] }),
            items.length === 0 ? /* @__PURE__ */ jsx("div", { "data-testid": "workbench-empty", className: "flex-1 min-h-0", children: /* @__PURE__ */ jsx(
              EmptyState,
              {
                title: `No ${railLabel.toLowerCase()}`,
                description: search ? "Nothing matches this search." : void 0
              }
            ) }) : /* @__PURE__ */ jsx(
              "div",
              {
                ref: listRef,
                role: "listbox",
                "aria-label": railLabel,
                "aria-activedescendant": activeItem ? optionId(activeItem.id) : void 0,
                tabIndex: 0,
                onKeyDown: onListKeyDown,
                className: "flex-1 min-h-0 overflow-y-auto scroll-thin p-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                children: items.map((item, index) => {
                  const isSelected = item.id === selectedId;
                  return /* @__PURE__ */ jsx(
                    "div",
                    {
                      id: optionId(item.id),
                      role: "option",
                      "aria-selected": isSelected,
                      onClick: () => select(index),
                      className: cn(
                        "cursor-pointer rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-foreground",
                        !isSelected && "hover:bg-accent/50",
                        index === activeIndex && "bg-muted",
                        isSelected && "border-primary bg-secondary text-foreground-strong font-medium"
                      ),
                      children: /* @__PURE__ */ jsx(RailCardTip, { children: renderCard(item) })
                    },
                    item.id
                  );
                })
              }
            ),
            onCreate && createPermission && /* @__PURE__ */ jsxs("div", { className: "shrink-0 p-3 border-t border-border", children: [
              /* @__PURE__ */ jsxs(
                PermissionButton,
                {
                  module: createPermission.module,
                  action: createPermission.action,
                  disabled: Boolean(createDisabledReason),
                  title: createDisabledReason,
                  tooltipWhenDisabled: createDisabledReason ?? "You do not have permission to create here",
                  "aria-describedby": createDisabledReason ? createReasonId : void 0,
                  onClick: () => guard(onCreate),
                  className: cn(buttonVariants({ size: "sm" }), "w-full"),
                  children: [
                    /* @__PURE__ */ jsx(Plus, { className: "size-4", "aria-hidden": "true" }),
                    "New"
                  ]
                }
              ),
              createDisabledReason && /* @__PURE__ */ jsx("span", { id: createReasonId, className: "sr-only", children: createDisabledReason })
            ] })
          ]
        }
      ),
      /* @__PURE__ */ jsxs("section", { "data-testid": "workbench-detail", className: "flex-1 min-h-0 min-w-0 flex flex-col", children: [
        tabs ? /* @__PURE__ */ jsxs(
          Tabs,
          {
            value: activeTab,
            onValueChange: (next) => {
              if (next !== activeTab) guard(() => onTabChange?.(next));
            },
            className: "flex-1 min-h-0 flex flex-col gap-0",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "shrink-0 flex flex-col gap-3 border-b border-border bg-background px-6 pt-4 pb-2", children: [
                detailHeader,
                /* @__PURE__ */ jsx(TabsList, { children: tabs.map((tab) => /* @__PURE__ */ jsx(TabsTrigger, { value: tab.value, children: tab.label }, tab.value)) })
              ] }),
              guardGroup,
              /* @__PURE__ */ jsx(
                TabsContent,
                {
                  value: activeTab ?? "",
                  "data-testid": "workbench-body",
                  className: "flex-1 min-h-0 overflow-y-auto scroll-thin px-6 py-4 mt-0",
                  children
                }
              )
            ]
          }
        ) : /* @__PURE__ */ jsxs(Fragment, { children: [
          detailHeader && /* @__PURE__ */ jsx("div", { className: "shrink-0 border-b border-border bg-background px-6 pt-4 pb-2", children: detailHeader }),
          guardGroup,
          /* @__PURE__ */ jsx("div", { "data-testid": "workbench-body", className: "flex-1 min-h-0 flex flex-col px-6 py-4", children })
        ] }),
        footer && /* @__PURE__ */ jsx("div", { className: "shrink-0 border-t border-border bg-card px-6 py-3", children: footer })
      ] })
    ] })
  ] });
}
export {
  WorkbenchShell as default
};
//# sourceMappingURL=WorkbenchShell.js.map
