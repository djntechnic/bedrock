import { jsxs, jsx } from "react/jsx-runtime";
import { Plus, Shield, Trash2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useRoleMatrix } from "../../hooks/useRoleMatrix.js";
import { Badge } from "../ui/badge.js";
import { Button } from "../ui/button.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog.js";
import { Input } from "../ui/input.js";
import { Label } from "../ui/label.js";
import { Switch } from "../ui/switch.js";
function RoleMatrixPanel() {
  const {
    matrix,
    roles,
    dataUpdatedAt,
    updateMatrix,
    createRole,
    isCreatingRole,
    deleteRole,
    isDeletingRole
  } = useRoleMatrix();
  const [drafts, setDrafts] = useState({});
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRoleSlug, setNewRoleSlug] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  useEffect(() => {
    if (!dataUpdatedAt && matrix.length === 0) return;
    const initial = {};
    for (const cell of matrix) {
      const key = `${cell.role_id}_${cell.module_id}`;
      initial[key] = {
        role_id: cell.role_id,
        module_id: cell.module_id,
        can_view: Boolean(cell.can_view),
        can_update: Boolean(cell.can_update),
        can_delete: Boolean(cell.can_delete),
        can_execute: Boolean(cell.can_execute)
      };
    }
    setDrafts(initial);
  }, [dataUpdatedAt, matrix]);
  const modulesList = useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const cell of matrix) {
      if (!map.has(cell.module_id)) {
        map.set(cell.module_id, {
          module_id: cell.module_id,
          module_slug: cell.module_slug,
          module_label: cell.module_label,
          is_core: Boolean(cell.is_core),
          roleCapabilities: {}
        });
      }
      const row = map.get(cell.module_id);
      const draftKey = `${cell.role_id}_${cell.module_id}`;
      const effectiveDraft = drafts[draftKey] ?? {
        role_id: cell.role_id,
        role_slug: cell.role_slug,
        can_view: Boolean(cell.can_view),
        can_update: Boolean(cell.can_update),
        can_delete: Boolean(cell.can_delete),
        can_execute: Boolean(cell.can_execute)
      };
      row.roleCapabilities[cell.role_id] = {
        role_slug: cell.role_slug,
        ...effectiveDraft
      };
    }
    return Array.from(map.values());
  }, [matrix, drafts]);
  const handleToggle = async (roleId, moduleId, action, value) => {
    const key = `${roleId}_${moduleId}`;
    const previous = drafts[key] || {
      role_id: roleId,
      module_id: moduleId,
      can_view: false,
      can_update: false,
      can_delete: false,
      can_execute: false
    };
    const updatedCell = {
      ...previous,
      [action]: value
    };
    setDrafts((prev) => ({
      ...prev,
      [key]: updatedCell
    }));
    try {
      await updateMatrix([updatedCell]);
    } catch (err) {
      setDrafts((prev) => ({
        ...prev,
        [key]: previous
      }));
      const error = err;
      toast.error(error?.response?.data?.detail || "Failed to update permission");
    }
  };
  const handleCreateRoleSubmit = async (e) => {
    e.preventDefault();
    if (!newRoleSlug || !newRoleLabel) {
      toast.error("Role slug and label are required");
      return;
    }
    try {
      await createRole({
        slug: newRoleSlug.toLowerCase().trim(),
        label: newRoleLabel.trim(),
        description: newRoleDesc.trim() || void 0
      });
      toast.success(`Custom role '${newRoleLabel}' created successfully`);
      setCreateRoleOpen(false);
      setNewRoleSlug("");
      setNewRoleLabel("");
      setNewRoleDesc("");
    } catch (err) {
      const error = err;
      toast.error(error?.response?.data?.detail || "Failed to create role");
    }
  };
  const handleDeleteRole = async (role) => {
    if (confirm(`Are you sure you want to delete role '${role.label}'?`)) {
      try {
        await deleteRole(role.role_id);
        toast.success(`Role '${role.label}' deleted`);
      } catch (err) {
        const error = err;
        toast.error(error?.response?.data?.detail || "Failed to delete role");
      }
    }
  };
  return /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-6", "data-testid": "role-matrix-panel", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h2", { className: "text-xl font-semibold tracking-tight", children: "Security & Permissions Matrix" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm text-muted-foreground", children: "Configure granular access capabilities (view, update, delete, execute) across roles and modules." })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "flex items-center gap-2", children: /* @__PURE__ */ jsxs(
        Button,
        {
          size: "sm",
          onClick: () => setCreateRoleOpen(true),
          children: [
            /* @__PURE__ */ jsx(Plus, { className: "h-4 w-4 mr-1" }),
            "Add Custom Role"
          ]
        }
      ) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border", children: [
      /* @__PURE__ */ jsx("span", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2", children: "Active Roles:" }),
      roles.map((r) => {
        const isCore = ["anon", "viewer", "member", "admin"].includes(r.slug);
        return /* @__PURE__ */ jsxs(
          "div",
          {
            className: "flex items-center gap-1.5 px-2.5 py-1 bg-card rounded-md border border-border text-xs shadow-xs",
            children: [
              /* @__PURE__ */ jsx(Shield, { className: "h-3 w-3 text-primary" }),
              /* @__PURE__ */ jsx("span", { className: "font-medium", children: r.label }),
              r.user_count !== void 0 && /* @__PURE__ */ jsxs(Badge, { variant: "secondary", className: "text-[10px] px-1 py-0 h-4", children: [
                r.user_count,
                " users"
              ] }),
              !isCore && /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  title: `Delete ${r.label}`,
                  onClick: () => handleDeleteRole(r),
                  disabled: isDeletingRole,
                  className: "text-muted-foreground hover:text-destructive ml-1",
                  children: /* @__PURE__ */ jsx(Trash2, { className: "h-3 w-3" })
                }
              )
            ]
          },
          r.role_id
        );
      })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "rounded-xl border border-border overflow-x-auto bg-card shadow-xs", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-sm border-collapse", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { className: "border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground", children: [
        /* @__PURE__ */ jsx("th", { className: "px-4 py-3 text-left min-w-[200px] border-r border-border", children: "Module" }),
        roles.map((role) => /* @__PURE__ */ jsx(
          "th",
          {
            className: "px-3 py-3 text-center border-r border-border last:border-0 min-w-[170px]",
            children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-center", children: [
              /* @__PURE__ */ jsx("span", { className: "font-semibold text-foreground", children: role.label }),
              /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-4 gap-1 w-full mt-2 pt-1 border-t border-border/60 text-[9px] uppercase tracking-wider text-muted-foreground", children: [
                /* @__PURE__ */ jsx("span", { title: "View capability", children: "View" }),
                /* @__PURE__ */ jsx("span", { title: "Update capability", children: "Upd" }),
                /* @__PURE__ */ jsx("span", { title: "Delete capability", children: "Del" }),
                /* @__PURE__ */ jsx("span", { title: "Execute capability", children: "Exec" })
              ] })
            ] })
          },
          role.role_id
        ))
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: modulesList.map((mod) => /* @__PURE__ */ jsxs(
        "tr",
        {
          className: "border-b border-border last:border-0 hover:bg-muted/20 transition-colors",
          children: [
            /* @__PURE__ */ jsx("td", { className: "px-4 py-3 border-r border-border bg-card", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsx("span", { className: "font-medium text-foreground", children: mod.module_label }),
              mod.is_core && /* @__PURE__ */ jsx(Badge, { variant: "outline", className: "text-[10px] px-1 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400", children: "Core" })
            ] }) }),
            roles.map((role) => {
              const caps = mod.roleCapabilities[role.role_id] || {
                can_view: false,
                can_update: false,
                can_delete: false,
                can_execute: false
              };
              const isAdminRole = role.slug === "admin";
              return /* @__PURE__ */ jsx(
                "td",
                {
                  className: "px-2 py-2 text-center border-r border-border last:border-0",
                  children: /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-4 gap-1.5 items-center justify-items-center", children: [
                    /* @__PURE__ */ jsx(
                      Switch,
                      {
                        checked: isAdminRole ? true : caps.can_view,
                        disabled: isAdminRole,
                        onCheckedChange: (checked) => handleToggle(role.role_id, mod.module_id, "can_view", checked),
                        "aria-label": `${role.slug} view ${mod.module_slug}`,
                        title: isAdminRole ? "Administrator has full access" : `${role.label}: View permission`
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      Switch,
                      {
                        checked: isAdminRole ? true : caps.can_update,
                        disabled: isAdminRole,
                        onCheckedChange: (checked) => handleToggle(role.role_id, mod.module_id, "can_update", checked),
                        "aria-label": `${role.slug} update ${mod.module_slug}`,
                        title: isAdminRole ? "Administrator has full access" : `${role.label}: Update permission`
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      Switch,
                      {
                        checked: isAdminRole ? true : caps.can_delete,
                        disabled: isAdminRole,
                        onCheckedChange: (checked) => handleToggle(role.role_id, mod.module_id, "can_delete", checked),
                        "aria-label": `${role.slug} delete ${mod.module_slug}`,
                        title: isAdminRole ? "Administrator has full access" : `${role.label}: Delete permission`
                      }
                    ),
                    /* @__PURE__ */ jsx(
                      Switch,
                      {
                        checked: isAdminRole ? true : caps.can_execute,
                        disabled: isAdminRole,
                        onCheckedChange: (checked) => handleToggle(role.role_id, mod.module_id, "can_execute", checked),
                        "aria-label": `${role.slug} execute ${mod.module_slug}`,
                        title: isAdminRole ? "Administrator has full access" : `${role.label}: Execute permission`
                      }
                    )
                  ] })
                },
                role.role_id
              );
            })
          ]
        },
        mod.module_id
      )) })
    ] }) }),
    /* @__PURE__ */ jsx(Dialog, { open: createRoleOpen, onOpenChange: setCreateRoleOpen, children: /* @__PURE__ */ jsx(DialogContent, { className: "w-[92vw] max-w-md sm:max-w-[420px]", children: /* @__PURE__ */ jsxs("form", { onSubmit: handleCreateRoleSubmit, children: [
      /* @__PURE__ */ jsxs(DialogHeader, { children: [
        /* @__PURE__ */ jsx(DialogTitle, { children: "Add Custom Role" }),
        /* @__PURE__ */ jsx(DialogDescription, { children: "Create a new dynamic application role. Roles can immediately have granular module capabilities assigned." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "grid gap-4 py-4", children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "role-slug", children: "Role Slug" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "role-slug",
              placeholder: "e.g. analyst or auditor",
              value: newRoleSlug,
              onChange: (e) => setNewRoleSlug(e.target.value),
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "role-label", children: "Display Label" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "role-label",
              placeholder: "e.g. Data Analyst",
              value: newRoleLabel,
              onChange: (e) => setNewRoleLabel(e.target.value),
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "role-desc", children: "Description (Optional)" }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "role-desc",
              placeholder: "Role description and intended usage",
              value: newRoleDesc,
              onChange: (e) => setNewRoleDesc(e.target.value)
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
            onClick: () => setCreateRoleOpen(false),
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsx(Button, { type: "submit", disabled: isCreatingRole, children: isCreatingRole ? "Creating..." : "Create Role" })
      ] })
    ] }) }) })
  ] });
}
export {
  RoleMatrixPanel as default
};
//# sourceMappingURL=RoleMatrixPanel.js.map
