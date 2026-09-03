/**
 * @file MenuNavEditorPanel.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description Dynamic Menu Navigation, Submenu Hierarchy & Section Spacer Customization Panel.
 */
import {
  ArrowDown,
  ArrowUp,
  CornerDownRight,
  FolderPlus,
  Layers,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useNavSettingsManager,
  type NavItemSetting,
} from "../../hooks/useNavSettings";
import { getNavItems, type NavItem } from "../navRegistry";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";

export interface FlatNavItem {
  nav_key: string;
  parent_key: string | null;
  label: string;
  group_label: string | null;
  icon?: import('react').ComponentType<{ className?: string }>;
  default_sort_order: number;
  is_sub_item: boolean;
  is_spacer: boolean;
  is_custom?: boolean;
}

function extractAllNavItems(baseItems: NavItem[], customSettings: NavItemSetting[]): FlatNavItem[] {
  const list: FlatNavItem[] = [];
  const registeredKeys = new Set<string>();
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
        is_spacer: false,
      });
      sortIndex += 10;
    }

    // Direct children
    if (item.children) {
      for (const child of item.children) {
        const childNavKey = `${item.to}::${child.to}`;
        if (!registeredKeys.has(childNavKey)) {
          registeredKeys.add(childNavKey);
          list.push({
            nav_key: childNavKey,
            parent_key: item.to,
            label: child.label,
            group_label: null,
            icon: undefined,
            default_sort_order: sortIndex,
            is_sub_item: true,
            is_spacer: false,
          });
          sortIndex += 10;
        }
      }
    }

    // Grouped children (e.g. Admin console tabs)
    if (item.groups) {
      for (const group of item.groups) {
        // Group header / spacer entry
        const groupKey = `spacer:${item.to}:${group.label.toLowerCase().replace(/\s+/g, "_")}`;
        if (!registeredKeys.has(groupKey)) {
          registeredKeys.add(groupKey);
          list.push({
            nav_key: groupKey,
            parent_key: item.to,
            label: group.label,
            group_label: null,
            icon: undefined,
            default_sort_order: sortIndex,
            is_sub_item: true,
            is_spacer: true,
          });
          sortIndex += 10;
        }

        for (const sub of group.items) {
          const subNavKey = `${item.to}::${sub.to}`;
          if (!registeredKeys.has(subNavKey)) {
            registeredKeys.add(subNavKey);
            list.push({
              nav_key: subNavKey,
              parent_key: item.to,
              label: sub.label,
              group_label: group.label,
              icon: undefined,
              default_sort_order: sortIndex,
              is_sub_item: true,
              is_spacer: false,
            });
            sortIndex += 10;
          }
        }
      }
    }
  }

  // Add any custom items or spacers from database settings not in base registry
  for (const setting of customSettings) {
    const isRegistered =
      registeredKeys.has(setting.nav_key) ||
      Boolean(
        setting.parent_key && registeredKeys.has(`${setting.parent_key}::${setting.nav_key}`)
      );
    if (!isRegistered) {
      const isSpacer = setting.nav_key.startsWith("spacer:");
      list.push({
        nav_key: setting.nav_key,
        parent_key: setting.parent_key ?? null,
        label: setting.label_override || (isSpacer ? "Custom Section Header" : setting.nav_key),
        group_label: null,
        icon: undefined,
        default_sort_order: setting.sort_order ?? sortIndex,
        is_sub_item: Boolean(setting.parent_key),
        is_spacer: isSpacer,
        is_custom: true,
      });
      sortIndex += 10;
    }
  }

  return list;
}

export default function MenuNavEditorPanel() {
  const {
    settings,
    updateSettings,
    resetSettings,
    deleteSetting,
    isUpdating,
    isResetting,
    isDeleting,
  } = useNavSettingsManager();

  const baseItems = useMemo(() => getNavItems(), []);

  // Compute all available items combining base registry and custom settings
  const allFlatItems = useMemo(() => {
    return extractAllNavItems(baseItems, settings);
  }, [baseItems, settings]);

  // Local draft state keyed by nav_key
  const [drafts, setDrafts] = useState<Record<string, NavItemSetting>>({});

  // Sync draft state from server settings and base registry
  React.useEffect(() => {
    const map: Record<string, NavItemSetting> = {};
    for (const item of allFlatItems) {
      const subRoute =
        item.parent_key && item.nav_key.startsWith(`${item.parent_key}::`)
          ? item.nav_key.slice(item.parent_key.length + 2)
          : null;
      const existing =
        settings.find((s) => s.nav_key === item.nav_key) ??
        (subRoute
          ? settings.find(
              (s) =>
                s.nav_key === subRoute &&
                (subRoute !== item.parent_key || s.parent_key === item.parent_key)
            )
          : undefined);
      map[item.nav_key] = {
        nav_key: item.nav_key,
        parent_key: existing?.parent_key ?? item.parent_key ?? null,
        sort_order: existing?.sort_order ?? item.default_sort_order ?? 0,
        label_override: existing?.label_override ?? "",
        icon_override: existing?.icon_override ?? "",
        tooltip_override: existing?.tooltip_override ?? "",
        is_hidden_override: Boolean(existing?.is_hidden_override),
      };
    }
    setDrafts(map);
  }, [allFlatItems, settings]);

  const itemsList = useMemo(() => {
    return allFlatItems
      .map((item) => {
        const draft = drafts[item.nav_key] || {
          nav_key: item.nav_key,
          parent_key: item.parent_key ?? null,
          sort_order: item.default_sort_order ?? 0,
          label_override: "",
          icon_override: "",
          tooltip_override: "",
          is_hidden_override: false,
        };
        return {
          base: item,
          draft,
        };
      })
      .sort((a, b) => a.draft.sort_order - b.draft.sort_order);
  }, [allFlatItems, drafts]);

  // Modal Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addItemType, setAddItemType] = useState<"route" | "spacer">("route");
  const [addNavKey, setAddNavKey] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addParentKey, setAddParentKey] = useState<string>("root");
  const [addIcon, setAddIcon] = useState("");
  const [addTooltip, setAddTooltip] = useState("");

  const handleLocalDraftChange = (
    navKey: string,
    field: keyof NavItemSetting,
    value: string | boolean | number | null
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [navKey]: {
        ...prev[navKey],
        [field]: value,
      },
    }));
  };

  const handleSaveField = async (navKey: string) => {
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
          is_hidden_override: current.is_hidden_override ? 1 : 0,
        },
      ]);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to update navigation setting");
    }
  };

  const handleDirectUpdate = async (
    navKey: string,
    field: keyof NavItemSetting,
    value: string | boolean | number | null
  ) => {
    const current = drafts[navKey];
    if (!current) return;

    const updated = {
      ...current,
      [field]: value,
    };

    setDrafts((prev) => ({
      ...prev,
      [navKey]: updated,
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
          is_hidden_override: updated.is_hidden_override ? 1 : 0,
        },
      ]);
    } catch (err: unknown) {
      setDrafts((prev) => ({
        ...prev,
        [navKey]: current,
      }));
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to update navigation setting");
    }
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= itemsList.length) return;

    // Create a reordered array copy
    const newItems = [...itemsList];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);

    // Re-index all elements sequentially by steps of 10
    const batchUpdates: NavItemSetting[] = [];
    const nextDrafts: Record<string, NavItemSetting> = { ...drafts };

    newItems.forEach((entry, idx) => {
      const assignedOrder = (idx + 1) * 10;
      const updatedDraft = {
        ...entry.draft,
        sort_order: assignedOrder,
      };
      nextDrafts[entry.base.nav_key] = updatedDraft;
      batchUpdates.push({
        nav_key: entry.base.nav_key,
        parent_key: updatedDraft.parent_key ?? null,
        sort_order: assignedOrder,
        label_override: updatedDraft.label_override || null,
        icon_override: updatedDraft.icon_override || null,
        tooltip_override: updatedDraft.tooltip_override || null,
        is_hidden_override: updatedDraft.is_hidden_override ? 1 : 0,
      });
    });

    setDrafts(nextDrafts);

    try {
      await updateSettings(batchUpdates);
    } catch (err: unknown) {
      toast.error("Failed to update navigation order");
    }
  };

  const handleRestoreDefaults = async () => {
    if (
      confirm(
        "Are you sure you want to restore all navigation settings to core application defaults? All custom labels, orderings, icon overrides, and custom spacers will be cleared."
      )
    ) {
      try {
        await resetSettings();
        toast.success("Navigation settings restored to defaults");
      } catch (err: unknown) {
        toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to restore defaults");
      }
    }
  };

  const handleDeleteItem = async (navKey: string, label: string) => {
    if (confirm(`Delete custom navigation item / spacer '${label}'?`)) {
      try {
        await deleteSetting(navKey);
      } catch (err: unknown) {
        toast.error("Failed to delete navigation item");
      }
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
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
          is_hidden_override: 0,
        },
      ]);
      toast.success(`Created ${addItemType === "spacer" ? "section header" : "navigation item"} '${addLabel}'`);
      setIsAddOpen(false);
      setAddNavKey("");
      setAddLabel("");
      setAddIcon("");
      setAddTooltip("");
      setAddParentKey("root");
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to create item");
    }
  };

  // Extract top-level parents for selection dropdown
  const parentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of baseItems) {
      if (!map.has(b.to)) {
        map.set(b.to, `${b.label} (${b.to})`);
      }
    }
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [baseItems]);

  return (
    <div className="flex flex-col gap-6" data-testid="menu-nav-editor-panel">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Menu Navigation & Submenu Editor</h2>
          <p className="text-sm text-muted-foreground">
            Configure dynamic ordering, custom display labels, Lucide icons, tooltips, and section spacers across top-level menus and submenus.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestoreDefaults}
            disabled={isResetting || isUpdating}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Restore Defaults
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddOpen(true)}
            disabled={isUpdating}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Navigation Item
          </Button>
        </div>
      </div>

      {/* Navigation Settings Table */}
      <div className="rounded-xl border border-border overflow-x-auto bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground bg-muted/30">
              <th className="px-3 py-3 text-center w-14">Order</th>
              <th className="px-3 py-3 text-left min-w-[240px]">Menu Item / Section</th>
              <th className="px-3 py-3 text-left min-w-[140px]">Parent Menu</th>
              <th className="px-3 py-3 text-left min-w-[180px]">Display Label Override</th>
              <th className="px-3 py-3 text-left min-w-[140px]">Icon Override</th>
              <th className="px-3 py-3 text-left min-w-[180px]">Tooltip Override</th>
              <th className="px-3 py-3 text-center w-16">Hidden</th>
              <th className="px-3 py-3 text-center w-12">Actions</th>
            </tr>
          </thead>
          <tbody>
            {itemsList.map(({ base, draft }, idx) => {
              let PreviewIcon = base.icon;
              if (draft.icon_override && draft.icon_override in LucideIcons) {
                PreviewIcon = (LucideIcons as unknown as Record<string, import('react').ComponentType<{ className?: string }>>)[draft.icon_override];
              }

              const isSpacer = base.is_spacer;

              return (
                <tr
                  key={`${base.nav_key}-${base.parent_key || "root"}-${idx}`}
                  className={`border-b border-border last:border-0 hover:bg-muted/15 transition-colors ${
                    isSpacer
                      ? "bg-muted/25 font-semibold"
                      : base.is_sub_item
                      ? "bg-muted/5"
                      : "bg-card"
                  }`}
                >
                  {/* Reorder Buttons */}
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(idx, "up")}
                        disabled={idx === 0 || isUpdating}
                        className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(idx, "down")}
                        disabled={idx === itemsList.length - 1 || isUpdating}
                        className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* Hierarchical Structure & Route */}
                  <td className="px-3 py-2">
                    <div className={`flex items-center gap-2 ${Boolean(draft.parent_key) ? "pl-5" : ""}`}>
                      {isSpacer ? (
                        <Layers className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      ) : Boolean(draft.parent_key) ? (
                        <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                      ) : (
                        PreviewIcon && <PreviewIcon className="h-4 w-4 text-primary shrink-0" />
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          {Boolean(draft.parent_key) && (
                            <span className="text-[11px] font-mono text-muted-foreground/60">
                              {parentOptions.find((p) => p.key === draft.parent_key)?.label || draft.parent_key} ›
                            </span>
                          )}
                          <span className={`text-xs ${isSpacer ? "text-foreground font-semibold uppercase tracking-wider text-[11px]" : "font-medium text-foreground"}`}>
                            {draft.label_override || base.label}
                          </span>
                          {isSpacer && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 border-amber-500/40 text-amber-600 dark:text-amber-400">
                              Section Header
                            </Badge>
                          )}
                          {base.group_label && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 text-muted-foreground">
                              {base.group_label}
                            </Badge>
                          )}
                        </div>
                        {!isSpacer && (
                          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                            {base.nav_key.includes("::") ? base.nav_key.split("::")[1] : base.nav_key}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Parent Menu Assignment */}
                  <td className="px-3 py-2">
                    <Select
                      value={draft.parent_key || "root"}
                      onValueChange={(val) =>
                        handleDirectUpdate(base.nav_key, "parent_key", val === "root" ? null : val)
                      }
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="h-7 text-xs w-full max-w-[140px]">
                        <SelectValue placeholder="Top Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="root">Top Level (None)</SelectItem>
                        {parentOptions.map((p) => (
                          <SelectItem key={p.key} value={p.key}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Display Label Override Input */}
                  <td className="px-3 py-2">
                    <Input
                      size={1}
                      placeholder={base.label}
                      value={draft.label_override ?? ""}
                      onChange={(e) =>
                        handleLocalDraftChange(base.nav_key, "label_override", e.target.value)
                      }
                      onBlur={() => handleSaveField(base.nav_key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="h-8 text-xs w-full"
                    />
                  </td>

                  {/* Icon Override Input */}
                  <td className="px-3 py-2">
                    <Input
                      size={1}
                      placeholder={isSpacer ? "—" : "e.g. Star, Shield"}
                      value={draft.icon_override ?? ""}
                      disabled={isSpacer}
                      onChange={(e) =>
                        handleLocalDraftChange(base.nav_key, "icon_override", e.target.value)
                      }
                      onBlur={() => handleSaveField(base.nav_key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="h-8 text-xs w-full font-mono text-[11px] disabled:opacity-40"
                    />
                  </td>

                  {/* Tooltip Override Input */}
                  <td className="px-3 py-2">
                    <Input
                      size={1}
                      placeholder={isSpacer ? "—" : "Custom hover tooltip"}
                      value={draft.tooltip_override ?? ""}
                      disabled={isSpacer}
                      onChange={(e) =>
                        handleLocalDraftChange(base.nav_key, "tooltip_override", e.target.value)
                      }
                      onBlur={() => handleSaveField(base.nav_key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      className="h-8 text-xs w-full disabled:opacity-40"
                    />
                  </td>

                  {/* Hidden Override Switch */}
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={Boolean(draft.is_hidden_override)}
                      onCheckedChange={(checked) =>
                        handleDirectUpdate(base.nav_key, "is_hidden_override", checked)
                      }
                      aria-label={`Hide ${base.label}`}
                    />
                  </td>

                  {/* Actions (Delete for custom/spacers, Reset for modified registered items) */}
                  <td className="px-3 py-2 text-center">
                    {base.is_custom || isSpacer ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteItem(base.nav_key, draft.label_override || base.label)}
                        disabled={isDeleting}
                        title={`Delete ${isSpacer ? "section header" : "custom navigation item"}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : (() => {
                      const subRoute =
                        base.parent_key && base.nav_key.startsWith(`${base.parent_key}::`)
                          ? base.nav_key.slice(base.parent_key.length + 2)
                          : null;
                      const existing =
                        settings.find((s) => s.nav_key === base.nav_key) ||
                        (subRoute
                          ? settings.find(
                              (s) =>
                                s.nav_key === subRoute &&
                                (subRoute !== base.parent_key || s.parent_key === base.parent_key)
                            )
                          : undefined);
                      return existing ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            handleDeleteItem(existing.nav_key, draft.label_override || base.label)
                          }
                          disabled={isDeleting}
                          title="Reset item overrides to code default"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground/30 text-xs">—</span>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Navigation Item / Spacer Modal Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[92vw] max-w-md sm:max-w-[440px]">
          <form onSubmit={handleCreateItem}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-primary" />
                Add Navigation Item or Spacer
              </DialogTitle>
              <DialogDescription className="text-xs">
                Create a new navigation destination route or a visual submenu section header spacer.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              {/* Item Type */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Item Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={addItemType === "route" ? "default" : "outline"}
                    size="sm"
                    className="text-xs justify-center"
                    onClick={() => setAddItemType("route")}
                  >
                    Navigation Route
                  </Button>
                  <Button
                    type="button"
                    variant={addItemType === "spacer" ? "default" : "outline"}
                    size="sm"
                    className="text-xs justify-center"
                    onClick={() => setAddItemType("spacer")}
                  >
                    Section Spacer
                  </Button>
                </div>
              </div>

              {/* Display Label / Header Name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="add-label" className="text-xs">
                  {addItemType === "spacer" ? "Section Header Title *" : "Display Label *"}
                </Label>
                <Input
                  id="add-label"
                  placeholder={addItemType === "spacer" ? "e.g. Data & Media" : "e.g. Custom Reports"}
                  value={addLabel}
                  onChange={(e) => setAddLabel(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>

              {/* Parent Menu */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Parent Menu</Label>
                <Select value={addParentKey} onValueChange={setAddParentKey}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Top Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Top Level (None)</SelectItem>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Route Path (Route only) */}
              {addItemType === "route" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-route" className="text-xs">
                    Route Path / URL *
                  </Label>
                  <Input
                    id="add-route"
                    placeholder="e.g. /reports or /admin?tab=custom"
                    value={addNavKey}
                    onChange={(e) => setAddNavKey(e.target.value)}
                    className="h-8 text-xs font-mono text-[11px]"
                    required
                  />
                </div>
              )}

              {/* Icon (Route only) */}
              {addItemType === "route" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-icon" className="text-xs">
                    Lucide Icon Name
                  </Label>
                  <Input
                    id="add-icon"
                    placeholder="e.g. BarChart3, Database, Shield"
                    value={addIcon}
                    onChange={(e) => setAddIcon(e.target.value)}
                    className="h-8 text-xs font-mono text-[11px]"
                  />
                </div>
              )}

              {/* Tooltip (Route only) */}
              {addItemType === "route" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="add-tooltip" className="text-xs">
                    Hover Tooltip
                  </Label>
                  <Input
                    id="add-tooltip"
                    placeholder="Optional tooltip text"
                    value={addTooltip}
                    onChange={(e) => setAddTooltip(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isUpdating}>
                Add Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
