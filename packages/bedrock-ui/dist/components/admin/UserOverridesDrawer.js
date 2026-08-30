import { jsx, jsxs } from "react/jsx-runtime";
import { Shield, ShieldCheck, Sparkles, RotateCcw, Check, X } from "lucide-react";
import React__default, { useState, useMemo } from "react";
import { toast } from "sonner";
import { useUserOverrides } from "../../hooks/useUserOverrides.js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "../ui/sheet.js";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs.js";
function UserOverridesDrawer({
  user,
  open,
  onOpenChange
}) {
  const {
    overrides,
    profile,
    updateOverrides,
    isUpdating
  } = useUserOverrides(user?.user_id ?? null);
  const [activeTab, setActiveTab] = useState("overrides");
  const [draftOverrides, setDraftOverrides] = useState({});
  React__default.useEffect(() => {
    if (!open || !user) return;
    const map = {};
    for (const ov of overrides) {
      map[ov.module_id] = { ...ov };
    }
    setDraftOverrides(map);
  }, [overrides, open, user?.user_id]);
  const handleTriStateChange = async (moduleId, action, value) => {
    if (!user) return;
    const current = draftOverrides[moduleId] || {
      user_id: user.user_id,
      module_id: moduleId,
      module_slug: "",
      module_label: "",
      is_core: false,
      can_view: null,
      can_update: null,
      can_delete: null,
      can_execute: null
    };
    const updated = {
      ...current,
      [action]: value
    };
    setDraftOverrides((prev) => ({
      ...prev,
      [moduleId]: updated
    }));
    try {
      await updateOverrides([
        {
          module_id: moduleId,
          can_view: updated.can_view,
          can_update: updated.can_update,
          can_delete: updated.can_delete,
          can_execute: updated.can_execute
        }
      ]);
      toast.success("Override saved");
    } catch (err) {
      setDraftOverrides((prev) => ({
        ...prev,
        [moduleId]: current
      }));
      const error = err;
      const detail = error?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : detail?.message || "Failed to update override";
      toast.error(msg);
    }
  };
  const handleResetAllOverrides = async () => {
    if (!user) return;
    if (confirm(`Reset all granular overrides for ${user.email} back to role defaults?`)) {
      try {
        const resets = overrides.map((ov) => ({
          module_id: ov.module_id,
          can_view: null,
          can_update: null,
          can_delete: null,
          can_execute: null
        }));
        await updateOverrides(resets);
        toast.success(`Overrides reset for ${user.email}`);
      } catch (err) {
        const error = err;
        const detail = error?.response?.data?.detail;
        const msg = typeof detail === "string" ? detail : detail?.message || "Failed to reset overrides";
        toast.error(msg);
      }
    }
  };
  const modulesList = useMemo(() => {
    return overrides;
  }, [overrides]);
  if (!user) return null;
  return /* @__PURE__ */ jsx(Sheet, { open, onOpenChange, children: /* @__PURE__ */ jsxs(SheetContent, { className: "w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-6 p-6", children: [
    /* @__PURE__ */ jsxs(SheetHeader, { className: "gap-1 border-b border-border pb-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsx(Shield, { className: "h-5 w-5 text-primary" }),
        /* @__PURE__ */ jsx(SheetTitle, { className: "text-lg font-semibold", children: "User Permissions & Access Control" })
      ] }),
      /* @__PURE__ */ jsx(SheetDescription, { className: "text-xs text-muted-foreground", children: "Manage granular tri-state overrides and inspect compiled authorization profiles." }),
      /* @__PURE__ */ jsxs("div", { className: "mt-3 p-3 bg-muted/40 rounded-lg border border-border flex flex-col gap-2 text-xs", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsx("span", { className: "font-medium text-foreground text-sm", children: user.email }),
          user.is_superuser && /* @__PURE__ */ jsx(Badge, { variant: "destructive", className: "text-[10px] h-4", children: "Superuser (Bypass All)" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [
          /* @__PURE__ */ jsx("span", { className: "text-muted-foreground", children: "Assigned Roles:" }),
          (user.roles || []).map((r) => /* @__PURE__ */ jsx(Badge, { variant: "secondary", className: "text-[11px] px-1.5 py-0 h-4", children: r }, r))
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(Tabs, { value: activeTab, onValueChange: (v) => setActiveTab(v), className: "w-full", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mb-4", children: [
        /* @__PURE__ */ jsxs(TabsList, { className: "grid grid-cols-2 w-full max-w-[340px]", children: [
          /* @__PURE__ */ jsxs(TabsTrigger, { value: "overrides", className: "text-xs", children: [
            /* @__PURE__ */ jsx(ShieldCheck, { className: "h-3.5 w-3.5 mr-1.5" }),
            "Granular Overrides"
          ] }),
          /* @__PURE__ */ jsxs(TabsTrigger, { value: "compiled", className: "text-xs", children: [
            /* @__PURE__ */ jsx(Sparkles, { className: "h-3.5 w-3.5 mr-1.5" }),
            "Compiled Profile"
          ] })
        ] }),
        activeTab === "overrides" && /* @__PURE__ */ jsxs(
          Button,
          {
            variant: "outline",
            size: "sm",
            className: "text-xs text-muted-foreground hover:text-foreground",
            onClick: handleResetAllOverrides,
            disabled: isUpdating || overrides.length === 0,
            children: [
              /* @__PURE__ */ jsx(RotateCcw, { className: "h-3.5 w-3.5 mr-1" }),
              "Reset All"
            ]
          }
        )
      ] }),
      /* @__PURE__ */ jsxs(TabsContent, { value: "overrides", className: "space-y-4 outline-none", children: [
        /* @__PURE__ */ jsx("div", { className: "p-3 bg-muted/30 rounded-lg border border-border text-xs text-muted-foreground", children: "Overrides allow you to force grant (Grant) or force revoke (Deny) specific permissions for this individual user regardless of their role." }),
        /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-3", children: modulesList.map((mod) => {
          const draft = draftOverrides[mod.module_id] || {
            user_id: user.user_id,
            module_id: mod.module_id,
            module_slug: mod.module_slug,
            module_label: mod.module_label,
            is_core: mod.is_core,
            can_view: null,
            can_update: null,
            can_delete: null,
            can_execute: null
          };
          return /* @__PURE__ */ jsxs(
            "div",
            {
              className: "p-3.5 bg-card rounded-lg border border-border flex flex-col gap-3 shadow-xs",
              children: [
                /* @__PURE__ */ jsx("div", { className: "flex items-center justify-between", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx("span", { className: "font-medium text-sm text-foreground", children: mod.module_label }),
                  Boolean(mod.is_core) && /* @__PURE__ */ jsx(Badge, { variant: "outline", className: "text-[10px] px-1 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400", children: "Core" })
                ] }) }),
                /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1", children: [
                  /* @__PURE__ */ jsx(
                    TriStateActionControl,
                    {
                      label: "View",
                      value: draft.can_view,
                      disabled: user.is_superuser,
                      onChange: (v) => handleTriStateChange(mod.module_id, "can_view", v)
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    TriStateActionControl,
                    {
                      label: "Update",
                      value: draft.can_update,
                      disabled: user.is_superuser,
                      onChange: (v) => handleTriStateChange(mod.module_id, "can_update", v)
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    TriStateActionControl,
                    {
                      label: "Delete",
                      value: draft.can_delete,
                      disabled: user.is_superuser,
                      onChange: (v) => handleTriStateChange(mod.module_id, "can_delete", v)
                    }
                  ),
                  /* @__PURE__ */ jsx(
                    TriStateActionControl,
                    {
                      label: "Execute",
                      value: draft.can_execute,
                      disabled: user.is_superuser,
                      onChange: (v) => handleTriStateChange(mod.module_id, "can_execute", v)
                    }
                  )
                ] })
              ]
            },
            mod.module_id
          );
        }) })
      ] }),
      /* @__PURE__ */ jsxs(TabsContent, { value: "compiled", className: "space-y-4 outline-none", children: [
        /* @__PURE__ */ jsx("div", { className: "p-3 bg-muted/30 rounded-lg border border-border text-xs text-muted-foreground", children: "This inspector displays the final compiled runtime capabilities computed by combining all assigned roles and per-user overrides." }),
        profile && /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-border overflow-x-auto bg-card shadow-xs", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-xs min-w-[460px]", children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-border bg-muted/40 text-muted-foreground", children: [
            /* @__PURE__ */ jsx("th", { className: "px-3 py-2 text-left font-semibold", children: "Module" }),
            /* @__PURE__ */ jsx("th", { className: "px-2 py-2 text-center font-semibold w-20", children: "View" }),
            /* @__PURE__ */ jsx("th", { className: "px-2 py-2 text-center font-semibold w-20", children: "Update" }),
            /* @__PURE__ */ jsx("th", { className: "px-2 py-2 text-center font-semibold w-20", children: "Delete" }),
            /* @__PURE__ */ jsx("th", { className: "px-2 py-2 text-center font-semibold w-20", children: "Execute" })
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: Object.entries(profile?.capabilities || {}).map(([slug, caps]) => /* @__PURE__ */ jsxs("tr", { className: "border-b border-border last:border-0 hover:bg-muted/10", children: [
            /* @__PURE__ */ jsx("td", { className: "px-3 py-2 font-medium capitalize text-foreground", children: slug }),
            /* @__PURE__ */ jsx("td", { className: "px-2 py-2 text-center", children: /* @__PURE__ */ jsx(CompiledCapBadge, { granted: caps.view }) }),
            /* @__PURE__ */ jsx("td", { className: "px-2 py-2 text-center", children: /* @__PURE__ */ jsx(CompiledCapBadge, { granted: caps.update }) }),
            /* @__PURE__ */ jsx("td", { className: "px-2 py-2 text-center", children: /* @__PURE__ */ jsx(CompiledCapBadge, { granted: caps.delete }) }),
            /* @__PURE__ */ jsx("td", { className: "px-2 py-2 text-center", children: /* @__PURE__ */ jsx(CompiledCapBadge, { granted: caps.execute }) })
          ] }, slug)) })
        ] }) })
      ] })
    ] })
  ] }) });
}
function TriStateActionControl({
  label,
  value,
  disabled,
  onChange
}) {
  const isInherit = value === null;
  const isGrant = value === true || value === 1;
  const isDeny = value === false || value === 0;
  return /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between px-2.5 py-1.5 bg-muted/20 rounded-md border border-border/60 text-xs gap-2", children: [
    /* @__PURE__ */ jsx("span", { className: "font-medium text-foreground/90 shrink-0", children: label }),
    /* @__PURE__ */ jsxs("div", { className: "inline-flex rounded-md bg-muted/60 p-0.5 border border-border/40 shrink-0", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          disabled,
          onClick: () => onChange(null),
          className: `px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${isInherit ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"}`,
          title: "Inherit capability from user's assigned roles",
          children: "Inherit"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          disabled,
          onClick: () => onChange(true),
          className: `px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${isGrant ? "bg-emerald-600 text-white shadow-2xs font-semibold" : "text-muted-foreground hover:text-emerald-600"}`,
          title: "Force grant capability to this user",
          children: "Grant"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          disabled,
          onClick: () => onChange(false),
          className: `px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${isDeny ? "bg-rose-600 text-white shadow-2xs font-semibold" : "text-muted-foreground hover:text-rose-600"}`,
          title: "Force deny capability for this user",
          children: "Deny"
        }
      )
    ] })
  ] });
}
function CompiledCapBadge({ granted }) {
  if (granted) {
    return /* @__PURE__ */ jsxs(
      "span",
      {
        className: "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 gap-1",
        title: "Granted",
        children: [
          /* @__PURE__ */ jsx(Check, { className: "h-3 w-3 stroke-[2.5]" }),
          "Allow"
        ]
      }
    );
  }
  return /* @__PURE__ */ jsxs(
    "span",
    {
      className: "inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground/60 gap-1",
      title: "Denied / Not Granted",
      children: [
        /* @__PURE__ */ jsx(X, { className: "h-3 w-3 stroke-[2.5]" }),
        "Deny"
      ]
    }
  );
}
export {
  UserOverridesDrawer as default
};
//# sourceMappingURL=UserOverridesDrawer.js.map
