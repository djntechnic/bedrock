import { jsxs, jsx } from "react/jsx-runtime";
import * as LucideIcons from "lucide-react";
import { RotateCcw, Plus, ArrowUp, ArrowDown, Layers, CornerDownRight, Trash2, FolderPlus } from "lucide-react";
import React__default, { useMemo, useState } from "react";
import { toast } from "sonner";
import { useNavSettingsManager } from "../../hooks/useNavSettings.js";
import { getNavItems } from "../navRegistry.js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select.js";
import { Switch } from "../ui/switch.js";
function extractAllNavItems(baseItems, customSettings) {
  const list = [];
  const registeredKeys = /* @__PURE__ */ new Set();
  let sortIndex = 10;
  for (const item of baseItems) {
    if (!registeredKeys.has(item.to)) {
      registeredKeys.add(item.to);
      list.push({
        nav_key: item.to,
        parent_key: null,
        label: item.label,
        group_label: null,
        icon: item.icon,
        default_sort_order: item.sort_order ?? sortIndex,
        is_sub_item: false,
        is_spacer: false
      });
      sortIndex += 10;
    }
    if (item.children) {
      for (const child of item.children) {
        if (!registeredKeys.has(child.to)) {
          registeredKeys.add(child.to);
          list.push({
            nav_key: child.to,
            parent_key: item.to,
            label: child.label,
            group_label: null,
            icon: void 0,
            default_sort_order: sortIndex,
            is_sub_item: true,
            is_spacer: false
          });
          sortIndex += 10;
        }
      }
    }
    if (item.groups) {
      for (const group of item.groups) {
        const groupKey = `spacer:${item.to}:${group.label.toLowerCase().replace(/\s+/g, "_")}`;
        if (!registeredKeys.has(groupKey)) {
          registeredKeys.add(groupKey);
          list.push({
            nav_key: groupKey,
            parent_key: item.to,
            label: group.label,
            group_label: null,
            icon: void 0,
            default_sort_order: sortIndex,
            is_sub_item: true,
            is_spacer: true
          });
          sortIndex += 10;
        }
        for (const sub of group.items) {
          if (!registeredKeys.has(sub.to)) {
            registeredKeys.add(sub.to);
            list.push({
              nav_key: sub.to,
              parent_key: item.to,
              label: sub.label,
              group_label: group.label,
              icon: void 0,
              default_sort_order: sortIndex,
              is_sub_item: true,
              is_spacer: false
            });
            sortIndex += 10;
          }
        }
      }
    }
  }
  for (const setting of customSettings) {
    if (!registeredKeys.has(setting.nav_key)) {
      const isSpacer = setting.nav_key.startsWith("spacer:");
      list.push({
        nav_key: setting.nav_key,
        parent_key: setting.parent_key ?? null,
        label: setting.label_override || (isSpacer ? "Custom Section Header" : setting.nav_key),
        group_label: null,
        icon: void 0,
        default_sort_order: setting.sort_order ?? sortIndex,
        is_sub_item: Boolean(setting.parent_key),
        is_spacer: isSpacer,
        is_custom: true
      });
      sortIndex += 10;
    }
  }
  return list;
}
function MenuNavEditorPanel() {
  const {
    settings,
    updateSettings,
    resetSettings,
    deleteSetting,
    isUpdating,
    isResetting,
    isDeleting
  } = useNavSettingsManager();
  const baseItems = useMemo(() => getNavItems(), []);
  const allFlatItems = useMemo(() => {
    return extractAllNavItems(baseItems, settings);
  }, [baseItems, settings]);
  const [drafts, setDrafts] = useState({});
  React__default.useEffect(() => {
    const map = {};
    for (const item of allFlatItems) {
      const existing = settings.find((s) => s.nav_key === item.nav_key);
      map[item.nav_key] = {
        nav_key: item.nav_key,
        parent_key: existing?.parent_key ?? item.parent_key ?? null,
        sort_order: existing?.sort_order ?? item.default_sort_order ?? 0,
        label_override: existing?.label_override ?? "",
        icon_override: existing?.icon_override ?? "",
        tooltip_override: existing?.tooltip_override ?? "",
        is_hidden_override: Boolean(existing?.is_hidden_override)
      };
    }
    setDrafts(map);
  }, [allFlatItems, settings]);
  const itemsList = useMemo(() => {
    return allFlatItems.map((item) => {
      const draft = drafts[item.nav_key] || {
        nav_key: item.nav_key,
        parent_key: item.parent_key ?? null,
        sort_order: item.default_sort_order ?? 0,
        label_override: "",
        icon_override: "",
        tooltip_override: "",
        is_hidden_override: false
      };
      return {
        base: item,
        draft
      };
    }).sort((a, b) => a.draft.sort_order - b.draft.sort_order);
  }, [allFlatItems, drafts]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addItemType, setAddItemType] = useState("route");
  const [addNavKey, setAddNavKey] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addParentKey, setAddParentKey] = useState("root");
  const [addIcon, setAddIcon] = useState("");
  const [addTooltip, setAddTooltip] = useState("");
  const handleLocalDraftChange = (navKey, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [navKey]: {
        ...prev[navKey],
        [field]: value
      }
    }));
  };
  const handleSaveField = async (navKey) => {
    const current = drafts[navKey];
    if (!current) return;
    try {
      await updateSettings([
        {
          nav_key: navKey,
          parent_key: current.parent_key ?? null,
          sort_order: current.sort_order,
          label_override: current.label_override || null,
          icon_override: current.icon_override || null,
          tooltip_override: current.tooltip_override || null,
          is_hidden_override: current.is_hidden_override ? 1 : 0
        }
      ]);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to update navigation setting");
    }
  };
  const handleDirectUpdate = async (navKey, field, value) => {
    const current = drafts[navKey];
    if (!current) return;
    const updated = {
      ...current,
      [field]: value
    };
    setDrafts((prev) => ({
      ...prev,
      [navKey]: updated
    }));
    try {
      await updateSettings([
        {
          nav_key: navKey,
          parent_key: updated.parent_key ?? null,
          sort_order: updated.sort_order,
          label_override: updated.label_override || null,
          icon_override: updated.icon_override || null,
          tooltip_override: updated.tooltip_override || null,
          is_hidden_override: updated.is_hidden_override ? 1 : 0
        }
      ]);
    } catch (err) {
      setDrafts((prev) => ({
        ...prev,
        [navKey]: current
      }));
      toast.error(err?.response?.data?.detail || "Failed to update navigation setting");
    }
  };
  const handleMove = async (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= itemsList.length) return;
    const newItems = [...itemsList];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);
    const batchUpdates = [];
    const nextDrafts = { ...drafts };
    newItems.forEach((entry, idx) => {
      const assignedOrder = (idx + 1) * 10;
      const updatedDraft = {
        ...entry.draft,
        sort_order: assignedOrder
      };
      nextDrafts[entry.base.nav_key] = updatedDraft;
      batchUpdates.push({
        nav_key: entry.base.nav_key,
        parent_key: updatedDraft.parent_key ?? null,
        sort_order: assignedOrder,
        label_override: updatedDraft.label_override || null,
        icon_override: updatedDraft.icon_override || null,
        tooltip_override: updatedDraft.tooltip_override || null,
        is_hidden_override: updatedDraft.is_hidden_override ? 1 : 0
      });
    });
    setDrafts(nextDrafts);
    try {
      await updateSettings(batchUpdates);
    } catch (err) {
      toast.error("Failed to update navigation order");
    }
  };
  const handleRestoreDefaults = async () => {
    if (confirm(
      "Are you sure you want to restore all navigation settings to core application defaults? All custom labels, orderings, icon overrides, and custom spacers will be cleared."
    )) {
      try {
        await resetSettings();
        toast.success("Navigation settings restored to defaults");
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Failed to restore defaults");
      }
    }
  };
  const handleDeleteItem = async (navKey, label) => {
    if (confirm(`Delete custom navigation item / spacer '${label}'?`)) {
      try {
        await deleteSetting(navKey);
      } catch (err) {
        toast.error("Failed to delete navigation item");
      }
    }
  };
  const handleCreateItem = async (e) => {
    e.preventDefault();
    if (!addLabel.trim()) {
      toast.error("Label is required");
      return;
    }
    let finalNavKey = addNavKey.trim();
    if (addItemType === "spacer") {
      finalNavKey = `spacer:${addParentKey === "root" ? "main" : addParentKey.replace(/[^a-zA-Z0-9]/g, "_")}:${addLabel.toLowerCase().trim().replace(/\s+/g, "_")}_${Date.now().toString().slice(-4)}`;
    } else if (!finalNavKey) {
      toast.error("Route path is required for navigation items");
      return;
    }
    const parentKey = addParentKey === "root" ? null : addParentKey;
    const maxOrder = itemsList.length > 0 ? Math.max(...itemsList.map((i) => i.draft.sort_order)) + 10 : 10;
    try {
      await updateSettings([
        {
          nav_key: finalNavKey,
          parent_key: parentKey,
          sort_order: maxOrder,
          label_override: addLabel.trim(),
          icon_override: addIcon.trim() || null,
          tooltip_override: addTooltip.trim() || null,
          is_hidden_override: 0
        }
      ]);
      toast.success(`Created ${addItemType === "spacer" ? "section header" : "navigation item"} '${addLabel}'`);
      setIsAddOpen(false);
      setAddNavKey("");
      setAddLabel("");
      setAddIcon("");
      setAddTooltip("");
      setAddParentKey("root");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to create item");
    }
  };
  const parentOptions = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const b of baseItems) {
      if (!map.has(b.to)) {
        map.set(b.to, `${b.label} (${b.to})`);
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [baseItems]);
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-6", "data-testid": "menu-nav-editor-panel", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold tracking-tight", children: "Menu Navigation & Submenu Editor" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Configure dynamic ordering, custom display labels, Lucide icons, tooltips, and section spacers across top-level menus and submenus." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxs(
          Button,
          {
            variant: "outline",
            size: "sm",
            onClick: handleRestoreDefaults,
            disabled: isResetting || isUpdating,
            className: "text-xs text-muted-foreground hover:text-destructive",
            children: [
              /* @__PURE__ */ jsx(RotateCcw, { className: "h-3.5 w-3.5 mr-1" }),
              "Restore Defaults"
            ]
          }
        ),
        /* @__PURE__ */ jsxs(
          Button,
          {
            size: "sm",
            onClick: () => setIsAddOpen(true),
            disabled: isUpdating,
            children: [
              /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4 mr-1" }),
              "Add Navigation Item"
            ]
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-border overflow-x-auto bg-card shadow-xs", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/30", children: [
        /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-center w-14", children: "Order" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-left min-w-[240px]", children: "Menu Item / Section" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-left min-w-[140px]", children: "Parent Menu" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-left min-w-[180px]", children: "Display Label Override" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-left min-w-[140px]", children: "Icon Override" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-left min-w-[180px]", children: "Tooltip Override" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-center w-16", children: "Hidden" }),
        /* @__PURE__ */ jsx("th", { className: "px-3 py-3 text-center w-12", children: "Actions" })
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: itemsList.map(({ base, draft }, idx) => {
        let PreviewIcon = base.icon;
        if (draft.icon_override && draft.icon_override in LucideIcons) {
          PreviewIcon = LucideIcons[draft.icon_override];
        }
        const isSpacer = base.is_spacer;
        return /* @__PURE__ */ jsxs(
          "tr",
          {
            className: `border-b border-border last:border-0 hover:bg-muted/15 transition-colors ${isSpacer ? "bg-muted/25 font-semibold" : base.is_sub_item ? "bg-muted/5" : "bg-card"}`,
            children: [
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-center", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-center gap-1", children: [
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => handleMove(idx, "up"),
                    disabled: idx === 0 || isUpdating,
                    className: "p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30",
                    title: "Move Up",
                    children: /* @__PURE__ */ jsx(ArrowUp, { className: "h-3.5 w-3.5" })
                  }
                ),
                /* @__PURE__ */ jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => handleMove(idx, "down"),
                    disabled: idx === itemsList.length - 1 || isUpdating,
                    className: "p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30",
                    title: "Move Down",
                    children: /* @__PURE__ */ jsx(ArrowDown, { className: "h-3.5 w-3.5" })
                  }
                )
              ] }) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxs("div", { className: `flex items-center gap-2 ${Boolean(draft.parent_key) ? "pl-5" : ""}`, children: [
                isSpacer ? /* @__PURE__ */ jsx(Layers, { className: "h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" }) : Boolean(draft.parent_key) ? /* @__PURE__ */ jsx(CornerDownRight, { className: "h-3.5 w-3.5 text-muted-foreground/60 shrink-0" }) : PreviewIcon && /* @__PURE__ */ jsx(PreviewIcon, { className: "h-4 w-4 text-primary shrink-0" }),
                /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-1.5", children: [
                    Boolean(draft.parent_key) && /* @__PURE__ */ jsxs("span", { className: "text-[11px] font-mono text-muted-foreground/60", children: [
                      parentOptions.find((p) => p.key === draft.parent_key)?.label || draft.parent_key,
                      " ›"
                    ] }),
                    /* @__PURE__ */ jsx("span", { className: `text-xs ${isSpacer ? "text-foreground font-semibold uppercase tracking-wider text-[11px]" : "font-medium text-foreground"}`, children: draft.label_override || base.label }),
                    isSpacer && /* @__PURE__ */ jsx(Badge, { variant: "outline", className: "text-[9px] px-1 py-0 h-3.5 border-amber-500/40 text-amber-600 dark:text-amber-400", children: "Section Header" }),
                    base.group_label && /* @__PURE__ */ jsx(Badge, { variant: "outline", className: "text-[9px] px-1 py-0 h-3.5 text-muted-foreground", children: base.group_label })
                  ] }),
                  !isSpacer && /* @__PURE__ */ jsx("span", { className: "text-[10px] text-muted-foreground font-mono truncate max-w-[200px]", children: base.nav_key })
                ] })
              ] }) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsxs(
                Select,
                {
                  value: draft.parent_key || "root",
                  onValueChange: (val) => handleDirectUpdate(base.nav_key, "parent_key", val === "root" ? null : val),
                  disabled: isUpdating,
                  children: [
                    /* @__PURE__ */ jsx(SelectTrigger, { className: "h-7 text-xs w-full max-w-[140px]", children: /* @__PURE__ */ jsx(SelectValue, { placeholder: "Top Level" }) }),
                    /* @__PURE__ */ jsxs(SelectContent, { children: [
                      /* @__PURE__ */ jsx(SelectItem, { value: "root", children: "Top Level (None)" }),
                      parentOptions.map((p) => /* @__PURE__ */ jsx(SelectItem, { value: p.key, children: p.label }, p.key))
                    ] })
                  ]
                }
              ) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx(
                Input,
                {
                  size: 1,
                  placeholder: base.label,
                  value: draft.label_override ?? "",
                  onChange: (e) => handleLocalDraftChange(base.nav_key, "label_override", e.target.value),
                  onBlur: () => handleSaveField(base.nav_key),
                  onKeyDown: (e) => {
                    if (e.key === "Enter") e.target.blur();
                  },
                  className: "h-8 text-xs w-full"
                }
              ) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx(
                Input,
                {
                  size: 1,
                  placeholder: isSpacer ? "—" : "e.g. Star, Shield",
                  value: draft.icon_override ?? "",
                  disabled: isSpacer,
                  onChange: (e) => handleLocalDraftChange(base.nav_key, "icon_override", e.target.value),
                  onBlur: () => handleSaveField(base.nav_key),
                  onKeyDown: (e) => {
                    if (e.key === "Enter") e.target.blur();
                  },
                  className: "h-8 text-xs w-full font-mono text-[11px] disabled:opacity-40"
                }
              ) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2", children: /* @__PURE__ */ jsx(
                Input,
                {
                  size: 1,
                  placeholder: isSpacer ? "—" : "Custom hover tooltip",
                  value: draft.tooltip_override ?? "",
                  disabled: isSpacer,
                  onChange: (e) => handleLocalDraftChange(base.nav_key, "tooltip_override", e.target.value),
                  onBlur: () => handleSaveField(base.nav_key),
                  onKeyDown: (e) => {
                    if (e.key === "Enter") e.target.blur();
                  },
                  className: "h-8 text-xs w-full disabled:opacity-40"
                }
              ) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-center", children: /* @__PURE__ */ jsx(
                Switch,
                {
                  checked: Boolean(draft.is_hidden_override),
                  onCheckedChange: (checked) => handleDirectUpdate(base.nav_key, "is_hidden_override", checked),
                  "aria-label": `Hide ${base.label}`
                }
              ) }),
              /* @__PURE__ */ jsx("td", { className: "px-3 py-2 text-center", children: base.is_custom || isSpacer ? /* @__PURE__ */ jsx(
                Button,
                {
                  size: "sm",
                  variant: "ghost",
                  className: "h-7 w-7 p-0 text-muted-foreground hover:text-destructive",
                  onClick: () => handleDeleteItem(base.nav_key, draft.label_override || base.label),
                  disabled: isDeleting,
                  title: `Delete ${isSpacer ? "section header" : "custom navigation item"}`,
                  children: /* @__PURE__ */ jsx(Trash2, { className: "h-3.5 w-3.5" })
                }
              ) : Boolean(settings.find((s) => s.nav_key === base.nav_key)) ? /* @__PURE__ */ jsx(
                Button,
                {
                  size: "sm",
                  variant: "ghost",
                  className: "h-7 w-7 p-0 text-muted-foreground hover:text-foreground",
                  onClick: () => handleDeleteItem(base.nav_key, draft.label_override || base.label),
                  disabled: isDeleting,
                  title: "Reset item overrides to code default",
                  children: /* @__PURE__ */ jsx(RotateCcw, { className: "h-3.5 w-3.5" })
                }
              ) : /* @__PURE__ */ jsx("span", { className: "text-muted-foreground/30 text-xs", children: "—" }) })
            ]
          },
          `${base.nav_key}-${base.parent_key || "root"}-${idx}`
        );
      }) })
    ] }) }),
    /* @__PURE__ */ jsx(Dialog, { open: isAddOpen, onOpenChange: setIsAddOpen, children: /* @__PURE__ */ jsx(DialogContent, { className: "w-[92vw] max-w-md sm:max-w-[440px]", children: /* @__PURE__ */ jsxs("form", { onSubmit: handleCreateItem, children: [
      /* @__PURE__ */ jsxs(DialogHeader, { children: [
        /* @__PURE__ */ jsxs(DialogTitle, { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsx(FolderPlus, { className: "h-5 w-5 text-primary" }),
          "Add Navigation Item or Spacer"
        ] }),
        /* @__PURE__ */ jsx(DialogDescription, { className: "text-xs", children: "Create a new navigation destination route or a visual submenu section header spacer." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-4 py-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
          /* @__PURE__ */ jsx(Label, { className: "text-xs", children: "Item Type" }),
          /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-2", children: [
            /* @__PURE__ */ jsx(
              Button,
              {
                type: "button",
                variant: addItemType === "route" ? "default" : "outline",
                size: "sm",
                className: "text-xs justify-center",
                onClick: () => setAddItemType("route"),
                children: "Navigation Route"
              }
            ),
            /* @__PURE__ */ jsx(
              Button,
              {
                type: "button",
                variant: addItemType === "spacer" ? "default" : "outline",
                size: "sm",
                className: "text-xs justify-center",
                onClick: () => setAddItemType("spacer"),
                children: "Section Spacer"
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "add-label", className: "text-xs", children: addItemType === "spacer" ? "Section Header Title *" : "Display Label *" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "add-label",
              placeholder: addItemType === "spacer" ? "e.g. Data & Media" : "e.g. Custom Reports",
              value: addLabel,
              onChange: (e) => setAddLabel(e.target.value),
              className: "h-8 text-xs",
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
          /* @__PURE__ */ jsx(Label, { className: "text-xs", children: "Parent Menu" }),
          /* @__PURE__ */ jsxs(Select, { value: addParentKey, onValueChange: setAddParentKey, children: [
            /* @__PURE__ */ jsx(SelectTrigger, { className: "h-8 text-xs", children: /* @__PURE__ */ jsx(SelectValue, { placeholder: "Top Level" }) }),
            /* @__PURE__ */ jsxs(SelectContent, { children: [
              /* @__PURE__ */ jsx(SelectItem, { value: "root", children: "Top Level (None)" }),
              parentOptions.map((p) => /* @__PURE__ */ jsx(SelectItem, { value: p.key, children: p.label }, p.key))
            ] })
          ] })
        ] }),
        addItemType === "route" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "add-route", className: "text-xs", children: "Route Path / URL *" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "add-route",
              placeholder: "e.g. /reports or /admin?tab=custom",
              value: addNavKey,
              onChange: (e) => setAddNavKey(e.target.value),
              className: "h-8 text-xs font-mono text-[11px]",
              required: true
            }
          )
        ] }),
        addItemType === "route" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "add-icon", className: "text-xs", children: "Lucide Icon Name" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "add-icon",
              placeholder: "e.g. BarChart3, Database, Shield",
              value: addIcon,
              onChange: (e) => setAddIcon(e.target.value),
              className: "h-8 text-xs font-mono text-[11px]"
            }
          )
        ] }),
        addItemType === "route" && /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1.5", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "add-tooltip", className: "text-xs", children: "Hover Tooltip" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "add-tooltip",
              placeholder: "Optional tooltip text",
              value: addTooltip,
              onChange: (e) => setAddTooltip(e.target.value),
              className: "h-8 text-xs"
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs(DialogFooter, { className: "gap-2 sm:gap-0", children: [
        /* @__PURE__ */ jsx(
          Button,
          {
            type: "button",
            variant: "outline",
            size: "sm",
            onClick: () => setIsAddOpen(false),
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsx(Button, { type: "submit", size: "sm", disabled: isUpdating, children: "Add Item" })
      ] })
    ] }) }) })
  ] });
}
export {
  MenuNavEditorPanel as default
};
//# sourceMappingURL=MenuNavEditorPanel.js.map
