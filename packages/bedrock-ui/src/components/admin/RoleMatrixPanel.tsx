/**
 * @file RoleMatrixPanel.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description Granular RBAC Role Permissions Matrix & Dynamic Role Management Console.
 */
import {
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useRoleMatrix,
} from "../../hooks/useRoleMatrix";
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
import { Switch } from "../ui/switch";

interface ModuleRow {
  module_id: number;
  module_slug: string;
  module_label: string;
  is_core: boolean;
  roleCapabilities: Record<
    number,
    {
      role_slug: string;
      can_view: boolean;
      can_update: boolean;
      can_delete: boolean;
      can_execute: boolean;
    }
  >;
}

export default function RoleMatrixPanel() {
  const {
    matrix,
    roles,
    dataUpdatedAt,
    updateMatrix,
    createRole,
    isCreatingRole,
    deleteRole,
    isDeletingRole,
  } = useRoleMatrix();

  // Optimistic local state: key = `${role_id}_${module_id}`
  const [drafts, setDrafts] = useState<
    Record<
      string,
      {
        role_id: number;
        module_id: number;
        can_view: boolean;
        can_update: boolean;
        can_delete: boolean;
        can_execute: boolean;
      }
    >
  >({});

  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRoleSlug, setNewRoleSlug] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");

  // Sync draft from matrix whenever matrix updates from server
  useEffect(() => {
    if (!dataUpdatedAt && matrix.length === 0) return;
    const initial: typeof drafts = {};
    for (const cell of matrix) {
      const key = `${cell.role_id}_${cell.module_id}`;
      initial[key] = {
        role_id: cell.role_id,
        module_id: cell.module_id,
        can_view: Boolean(cell.can_view),
        can_update: Boolean(cell.can_update),
        can_delete: Boolean(cell.can_delete),
        can_execute: Boolean(cell.can_execute),
      };
    }
    setDrafts(initial);
  }, [dataUpdatedAt, matrix]);

  // Transform matrix into grouped rows per module
  const modulesList: ModuleRow[] = useMemo(() => {
    const map = new Map<number, ModuleRow>();

    for (const cell of matrix) {
      if (!map.has(cell.module_id)) {
        map.set(cell.module_id, {
          module_id: cell.module_id,
          module_slug: cell.module_slug,
          module_label: cell.module_label,
          is_core: Boolean(cell.is_core),
          roleCapabilities: {},
        });
      }

      const row = map.get(cell.module_id)!;
      const draftKey = `${cell.role_id}_${cell.module_id}`;
      const effectiveDraft = drafts[draftKey] ?? {
        role_id: cell.role_id,
        role_slug: cell.role_slug,
        can_view: Boolean(cell.can_view),
        can_update: Boolean(cell.can_update),
        can_delete: Boolean(cell.can_delete),
        can_execute: Boolean(cell.can_execute),
      };

      row.roleCapabilities[cell.role_id] = {
        role_slug: cell.role_slug,
        ...effectiveDraft,
      };
    }

    return Array.from(map.values());
  }, [matrix, drafts]);

  const handleToggle = async (
    roleId: number,
    moduleId: number,
    action: "can_view" | "can_update" | "can_delete" | "can_execute",
    value: boolean,
  ) => {
    const key = `${roleId}_${moduleId}`;
    const previous = drafts[key] || {
      role_id: roleId,
      module_id: moduleId,
      can_view: false,
      can_update: false,
      can_delete: false,
      can_execute: false,
    };

    const updatedCell = {
      ...previous,
      [action]: value,
    };

    // 1. Optimistic UI update
    setDrafts((prev) => ({
      ...prev,
      [key]: updatedCell,
    }));

    // 2. Auto-save immediately to server
    try {
      await updateMatrix([updatedCell]);
    } catch (err: any) {
      // Revert on failure
      setDrafts((prev) => ({
        ...prev,
        [key]: previous,
      }));
      toast.error(err?.response?.data?.detail || "Failed to update permission");
    }
  };

  const handleCreateRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleSlug || !newRoleLabel) {
      toast.error("Role slug and label are required");
      return;
    }
    try {
      await createRole({
        slug: newRoleSlug.toLowerCase().trim(),
        label: newRoleLabel.trim(),
        description: newRoleDesc.trim() || undefined,
      });
      toast.success(`Custom role '${newRoleLabel}' created successfully`);
      setCreateRoleOpen(false);
      setNewRoleSlug("");
      setNewRoleLabel("");
      setNewRoleDesc("");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to create role");
    }
  };

  const handleDeleteRole = async (role: any) => {
    if (confirm(`Are you sure you want to delete role '${role.label}'?`)) {
      try {
        await deleteRole(role.role_id);
        toast.success(`Role '${role.label}' deleted`);
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Failed to delete role");
      }
    }
  };

  return (
    <div className="flex flex-col gap-6" data-testid="role-matrix-panel">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Security & Permissions Matrix</h2>
          <p className="text-sm text-muted-foreground">
            Configure granular access capabilities (view, update, delete, execute) across roles and modules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setCreateRoleOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Custom Role
          </Button>
        </div>
      </div>

      {/* Roles Summary Badges */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">
          Active Roles:
        </span>
        {roles.map((r) => {
          const isCore = ["anon", "viewer", "member", "admin"].includes(r.slug);
          return (
            <div
              key={r.role_id}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-card rounded-md border border-border text-xs shadow-xs"
            >
              <Shield className="h-3 w-3 text-primary" />
              <span className="font-medium">{r.label}</span>
              {r.user_count !== undefined && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                  {r.user_count} users
                </Badge>
              )}
              {!isCore && (
                <button
                  type="button"
                  title={`Delete ${r.label}`}
                  onClick={() => handleDeleteRole(r)}
                  disabled={isDeletingRole}
                  className="text-muted-foreground hover:text-destructive ml-1"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Permissions Matrix Grid */}
      <div className="rounded-xl border border-border overflow-x-auto bg-card shadow-xs">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
              <th className="px-4 py-3 text-left min-w-[200px] border-r border-border">Module</th>
              {roles.map((role) => (
                <th
                  key={role.role_id}
                  className="px-3 py-3 text-center border-r border-border last:border-0 min-w-[170px]"
                >
                  <div className="flex flex-col items-center">
                    <span className="font-semibold text-foreground">{role.label}</span>
                    <div className="grid grid-cols-4 gap-1 w-full mt-2 pt-1 border-t border-border/60 text-[9px] uppercase tracking-wider text-muted-foreground">
                      <span title="View capability">View</span>
                      <span title="Update capability">Upd</span>
                      <span title="Delete capability">Del</span>
                      <span title="Execute capability">Exec</span>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modulesList.map((mod) => (
              <tr
                key={mod.module_id}
                className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                {/* Module Column */}
                <td className="px-4 py-3 border-r border-border bg-card">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{mod.module_label}</span>
                    {mod.is_core && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400">
                        Core
                      </Badge>
                    )}
                  </div>
                </td>

                {/* Role Capabilities Columns */}
                {roles.map((role) => {
                  const caps = mod.roleCapabilities[role.role_id] || {
                    can_view: false,
                    can_update: false,
                    can_delete: false,
                    can_execute: false,
                  };
                  const isAdminRole = role.slug === "admin";

                  return (
                    <td
                      key={role.role_id}
                      className="px-2 py-2 text-center border-r border-border last:border-0"
                    >
                      <div className="grid grid-cols-4 gap-1.5 items-center justify-items-center">
                        {/* View Toggle */}
                        <Switch
                          checked={isAdminRole ? true : caps.can_view}
                          disabled={isAdminRole}
                          onCheckedChange={(checked) =>
                            handleToggle(role.role_id, mod.module_id, "can_view", checked)
                          }
                          aria-label={`${role.slug} view ${mod.module_slug}`}
                          title={isAdminRole ? "Administrator has full access" : `${role.label}: View permission`}
                        />

                        {/* Update Toggle */}
                        <Switch
                          checked={isAdminRole ? true : caps.can_update}
                          disabled={isAdminRole}
                          onCheckedChange={(checked) =>
                            handleToggle(role.role_id, mod.module_id, "can_update", checked)
                          }
                          aria-label={`${role.slug} update ${mod.module_slug}`}
                          title={isAdminRole ? "Administrator has full access" : `${role.label}: Update permission`}
                        />

                        {/* Delete Toggle */}
                        <Switch
                          checked={isAdminRole ? true : caps.can_delete}
                          disabled={isAdminRole}
                          onCheckedChange={(checked) =>
                            handleToggle(role.role_id, mod.module_id, "can_delete", checked)
                          }
                          aria-label={`${role.slug} delete ${mod.module_slug}`}
                          title={isAdminRole ? "Administrator has full access" : `${role.label}: Delete permission`}
                        />

                        {/* Execute Toggle */}
                        <Switch
                          checked={isAdminRole ? true : caps.can_execute}
                          disabled={isAdminRole}
                          onCheckedChange={(checked) =>
                            handleToggle(role.role_id, mod.module_id, "can_execute", checked)
                          }
                          aria-label={`${role.slug} execute ${mod.module_slug}`}
                          title={isAdminRole ? "Administrator has full access" : `${role.label}: Execute permission`}
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Custom Role Dialog */}
      <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
        <DialogContent className="w-[92vw] max-w-md sm:max-w-[420px]">
          <form onSubmit={handleCreateRoleSubmit}>
            <DialogHeader>
              <DialogTitle>Add Custom Role</DialogTitle>
              <DialogDescription>
                Create a new dynamic application role. Roles can immediately have granular module capabilities assigned.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="role-slug">Role Slug</Label>
                <Input
                  id="role-slug"
                  placeholder="e.g. analyst or auditor"
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role-label">Display Label</Label>
                <Input
                  id="role-label"
                  placeholder="e.g. Data Analyst"
                  value={newRoleLabel}
                  onChange={(e) => setNewRoleLabel(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role-desc">Description (Optional)</Label>
                <Input
                  id="role-desc"
                  placeholder="Role description and intended usage"
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateRoleOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingRole}>
                {isCreatingRole ? "Creating..." : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
