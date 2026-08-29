/**
 * @file UserOverridesDrawer.tsx
 * @module @djntechnic/bedrock-ui/components/admin
 * @description Slide-out Sheet Drawer for granular tri-state capability overrides & compiled profile inspection.
 */
import {
  Check,
  RotateCcw,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  useUserOverrides,
  type UserOverrideRecord,
} from "../../hooks/useUserOverrides";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface UserAdminRecord {
  user_id: number;
  email: string;
  display_name?: string | null;
  roles?: string[];
  is_active: boolean;
  is_superuser?: boolean;
}

interface UserOverridesDrawerProps {
  user: UserAdminRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ActionName = "can_view" | "can_update" | "can_delete" | "can_execute";

export default function UserOverridesDrawer({
  user,
  open,
  onOpenChange,
}: UserOverridesDrawerProps) {
  const {
    overrides,
    profile,
    updateOverrides,
    isUpdating,
  } = useUserOverrides(user?.user_id ?? null);

  const [activeTab, setActiveTab] = useState<"overrides" | "compiled">("overrides");

  // Local optimistic state
  const [draftOverrides, setDraftOverrides] = useState<Record<number, UserOverrideRecord>>({});

  // Sync draft overrides when server data arrives
  React.useEffect(() => {
    if (!open || !user) return;
    const map: Record<number, UserOverrideRecord> = {};
    for (const ov of overrides) {
      map[ov.module_id] = { ...ov };
    }
    setDraftOverrides(map);
  }, [overrides, open, user?.user_id]);

  const handleTriStateChange = async (
    moduleId: number,
    action: ActionName,
    value: boolean | null
  ) => {
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
      can_execute: null,
    };

    const updated = {
      ...current,
      [action]: value,
    };

    // 1. Optimistic update
    setDraftOverrides((prev) => ({
      ...prev,
      [moduleId]: updated,
    }));

    // 2. Auto-save
    try {
      await updateOverrides([
        {
          module_id: moduleId,
          can_view: updated.can_view,
          can_update: updated.can_update,
          can_delete: updated.can_delete,
          can_execute: updated.can_execute,
        },
      ]);
      toast.success("Override saved");
    } catch (err: any) {
      // Revert on error
      setDraftOverrides((prev) => ({
        ...prev,
        [moduleId]: current,
      }));
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (detail?.message || "Failed to update override");
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
          can_execute: null,
        }));
        await updateOverrides(resets);
        toast.success(`Overrides reset for ${user.email}`);
      } catch (err: any) {
        const detail = err?.response?.data?.detail;
        const msg = typeof detail === "string" ? detail : (detail?.message || "Failed to reset overrides");
        toast.error(msg);
      }
    }
  };

  const modulesList = useMemo(() => {
    return overrides;
  }, [overrides]);

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto flex flex-col gap-6 p-6">
        <SheetHeader className="gap-1 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <SheetTitle className="text-lg font-semibold">
              User Permissions & Access Control
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Manage granular tri-state overrides and inspect compiled authorization profiles.
          </SheetDescription>

          {/* User Meta Card */}
          <div className="mt-3 p-3 bg-muted/40 rounded-lg border border-border flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground text-sm">{user.email}</span>
              {user.is_superuser && (
                <Badge variant="destructive" className="text-[10px] h-4">
                  Superuser (Bypass All)
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground">Assigned Roles:</span>
              {(user.roles || []).map((r) => (
                <Badge key={r} variant="secondary" className="text-[11px] px-1.5 py-0 h-4">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        </SheetHeader>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="grid grid-cols-2 w-full max-w-[340px]">
              <TabsTrigger value="overrides" className="text-xs">
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                Granular Overrides
              </TabsTrigger>
              <TabsTrigger value="compiled" className="text-xs">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Compiled Profile
              </TabsTrigger>
            </TabsList>

            {activeTab === "overrides" && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={handleResetAllOverrides}
                disabled={isUpdating || overrides.length === 0}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Reset All
              </Button>
            )}
          </div>

          {/* Tab 1: Granular Tri-State Overrides */}
          <TabsContent value="overrides" className="space-y-4 outline-none">
            <div className="p-3 bg-muted/30 rounded-lg border border-border text-xs text-muted-foreground">
              Overrides allow you to force grant (Grant) or force revoke (Deny) specific permissions for this individual user regardless of their role.
            </div>

            <div className="flex flex-col gap-3">
              {modulesList.map((mod) => {
                const draft = draftOverrides[mod.module_id] || {
                  user_id: user.user_id,
                  module_id: mod.module_id,
                  module_slug: mod.module_slug,
                  module_label: mod.module_label,
                  is_core: mod.is_core,
                  can_view: null,
                  can_update: null,
                  can_delete: null,
                  can_execute: null,
                };

                return (
                  <div
                    key={mod.module_id}
                    className="p-3.5 bg-card rounded-lg border border-border flex flex-col gap-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">
                          {mod.module_label}
                        </span>
                        {Boolean(mod.is_core) && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400">
                            Core
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Tri-state segmented controls for 4 capabilities */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {/* View */}
                      <TriStateActionControl
                        label="View"
                        value={draft.can_view}
                        disabled={user.is_superuser}
                        onChange={(v) => handleTriStateChange(mod.module_id, "can_view", v)}
                      />
                      {/* Update */}
                      <TriStateActionControl
                        label="Update"
                        value={draft.can_update}
                        disabled={user.is_superuser}
                        onChange={(v) => handleTriStateChange(mod.module_id, "can_update", v)}
                      />
                      {/* Delete */}
                      <TriStateActionControl
                        label="Delete"
                        value={draft.can_delete}
                        disabled={user.is_superuser}
                        onChange={(v) => handleTriStateChange(mod.module_id, "can_delete", v)}
                      />
                      {/* Execute */}
                      <TriStateActionControl
                        label="Execute"
                        value={draft.can_execute}
                        disabled={user.is_superuser}
                        onChange={(v) => handleTriStateChange(mod.module_id, "can_execute", v)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Tab 2: Compiled Profile Inspector */}
          <TabsContent value="compiled" className="space-y-4 outline-none">
            <div className="p-3 bg-muted/30 rounded-lg border border-border text-xs text-muted-foreground">
              This inspector displays the final compiled runtime capabilities computed by combining all assigned roles and per-user overrides.
            </div>

            {profile && (
              <div className="rounded-xl border border-border overflow-x-auto bg-card shadow-xs">
                <table className="w-full text-xs min-w-[460px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                      <th className="px-3 py-2 text-left font-semibold">Module</th>
                      <th className="px-2 py-2 text-center font-semibold w-20">View</th>
                      <th className="px-2 py-2 text-center font-semibold w-20">Update</th>
                      <th className="px-2 py-2 text-center font-semibold w-20">Delete</th>
                      <th className="px-2 py-2 text-center font-semibold w-20">Execute</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(profile?.capabilities || {}).map(([slug, caps]) => (
                      <tr key={slug} className="border-b border-border last:border-0 hover:bg-muted/10">
                        <td className="px-3 py-2 font-medium capitalize text-foreground">
                          {slug}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <CompiledCapBadge granted={caps.view} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <CompiledCapBadge granted={caps.update} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <CompiledCapBadge granted={caps.delete} />
                        </td>
                        <td className="px-2 py-2 text-center">
                          <CompiledCapBadge granted={caps.execute} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function TriStateActionControl({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean | null;
  disabled?: boolean;
  onChange: (val: boolean | null) => void;
}) {
  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted/20 rounded-md border border-border/60 text-xs gap-2">
      <span className="font-medium text-foreground/90 shrink-0">{label}</span>
      <div className="inline-flex rounded-md bg-muted/60 p-0.5 border border-border/40 shrink-0">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
            value === null
              ? "bg-background text-foreground shadow-2xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Inherit capability from user's assigned roles"
        >
          Inherit
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(true)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
            value === true
              ? "bg-emerald-600 text-white shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-emerald-600"
          }`}
          title="Force grant capability to this user"
        >
          Grant
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(false)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
            value === false
              ? "bg-rose-600 text-white shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-rose-600"
          }`}
          title="Force deny capability for this user"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function CompiledCapBadge({ granted }: { granted: boolean }) {
  if (granted) {
    return (
      <span
        className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 gap-1"
        title="Granted"
      >
        <Check className="h-3 w-3 stroke-[2.5]" />
        Allow
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground/60 gap-1"
      title="Denied / Not Granted"
    >
      <X className="h-3 w-3 stroke-[2.5]" />
      Deny
    </span>
  );
}
