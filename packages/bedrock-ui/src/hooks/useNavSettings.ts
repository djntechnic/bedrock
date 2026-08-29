/**
 * @file useNavSettings.ts
 * @module frontend/src/hooks
 * @description Fetches dynamic navigation settings from `/api/v1/navigation/settings`
 *              and merges them with registered NavItem definitions.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as LucideIcons from "lucide-react";
import { useMemo } from "react";
import { apiClient } from "../api/client";
import { API_ROUTES } from "../api/routes";
import { getNavItems, type NavItem } from "../components/navRegistry";
import { queryKeys } from "./queryKeys";

export interface NavItemSetting {
  nav_setting_id?: number;
  nav_key: string;
  parent_key?: string | null;
  sort_order: number;
  label_override?: string | null;
  icon_override?: string | null;
  tooltip_override?: string | null;
  is_hidden_override: boolean | number;
}

export function useNavSettings(): {
  navItems: NavItem[];
  settings: NavItemSetting[];
  isLoading: boolean;
} {
  const query = useQuery<NavItemSetting[]>({
    queryKey: queryKeys.navigation.settings(),
    queryFn: async () => {
      const { data } = await apiClient.get<NavItemSetting[]>(
        API_ROUTES.navigation.settings(),
      );
      return data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const baseItems = getNavItems();
  const settings = query.data ?? [];

  const navItems = useMemo(() => {
    const settingsMap = new Map<string, NavItemSetting>();
    for (const s of settings) {
      settingsMap.set(s.nav_key, s);
    }

    // 1. Flatten all registered base items and sub-items
    interface FlatItemCandidate {
      nav_key: string;
      label: string;
      icon?: any;
      tooltip?: string;
      exact?: boolean;
      module?: string;
      action?: "view" | "update" | "delete" | "execute";
      role?: string;
      default_parent_key: string | null;
      default_sort_order: number;
      group_label?: string | null;
    }

    const flatMap = new Map<string, FlatItemCandidate>();
    let orderIndex = 10;

    for (const top of baseItems) {
      if (!flatMap.has(top.to)) {
        flatMap.set(top.to, {
          nav_key: top.to,
          label: top.label,
          icon: top.icon,
          tooltip: top.tooltip,
          exact: top.exact,
          module: top.module,
          action: top.action,
          role: top.role,
          default_parent_key: null,
          default_sort_order: top.sort_order ?? orderIndex,
        });
        orderIndex += 10;
      }

      if (top.children) {
        for (const child of top.children) {
          if (!flatMap.has(child.to)) {
            flatMap.set(child.to, {
              nav_key: child.to,
              label: child.label,
              default_parent_key: top.to,
              default_sort_order: orderIndex,
            });
            orderIndex += 10;
          }
        }
      }

      if (top.groups) {
        for (const grp of top.groups) {
          for (const item of grp.items) {
            if (!flatMap.has(item.to)) {
              flatMap.set(item.to, {
                nav_key: item.to,
                label: item.label,
                default_parent_key: top.to,
                group_label: grp.label,
                default_sort_order: orderIndex,
              });
              orderIndex += 10;
            }
          }
        }
      }
    }

    // Include any custom items from database settings
    for (const s of settings) {
      if (!flatMap.has(s.nav_key)) {
        const isSpacer = s.nav_key.startsWith("spacer:");
        flatMap.set(s.nav_key, {
          nav_key: s.nav_key,
          label: s.label_override || (isSpacer ? "Section" : s.nav_key),
          default_parent_key: s.parent_key ?? null,
          default_sort_order: s.sort_order ?? orderIndex,
        });
        orderIndex += 10;
      }
    }

    // 2. Resolve all items with dynamic overrides
    interface ResolvedItem {
      nav_key: string;
      to: string;
      label: string;
      icon: any;
      tooltip?: string;
      exact?: boolean;
      module?: string;
      action?: "view" | "update" | "delete" | "execute";
      role?: string;
      parent_key: string | null;
      sort_order: number;
      is_hidden: boolean;
      group_label?: string | null;
    }

    const resolvedItems: ResolvedItem[] = [];

    for (const [nav_key, cand] of flatMap.entries()) {
      const s = settingsMap.get(nav_key);
      const isHidden = s ? Boolean(s.is_hidden_override) : false;
      if (isHidden) continue;

      let IconComp = cand.icon;
      if (s?.icon_override && s.icon_override in LucideIcons) {
        IconComp = (LucideIcons as Record<string, any>)[s.icon_override];
      }
      if (!IconComp) {
        IconComp = LucideIcons.CircleDot || LucideIcons.FileText;
      }

      const parent_key = s?.parent_key !== undefined ? s.parent_key : cand.default_parent_key;
      const sort_order = s?.sort_order ?? cand.default_sort_order;
      const label = s?.label_override || cand.label;
      const tooltip = s?.tooltip_override || cand.tooltip;

      resolvedItems.push({
        nav_key,
        to: nav_key,
        label,
        icon: IconComp,
        tooltip,
        exact: cand.exact,
        module: cand.module,
        action: cand.action,
        role: cand.role,
        parent_key,
        sort_order,
        is_hidden: isHidden,
        group_label: cand.group_label,
      });
    }

    // 3. Reconstruct tree structure with dynamic parent assignments
    const topLevelList: NavItem[] = [];
    const childrenByParent = new Map<string, ResolvedItem[]>();

    for (const item of resolvedItems) {
      if (!item.parent_key) {
        topLevelList.push({
          to: item.to,
          label: item.label,
          icon: item.icon,
          tooltip: item.tooltip,
          exact: item.exact,
          module: item.module,
          action: item.action,
          role: item.role,
          sort_order: item.sort_order,
          children: [],
          groups: [],
        });
      } else {
        const arr = childrenByParent.get(item.parent_key) || [];
        arr.push(item);
        childrenByParent.set(item.parent_key, arr);
      }
    }

    // Attach children to respective parents
    for (const parent of topLevelList) {
      const children = childrenByParent.get(parent.to);
      if (children && children.length > 0) {
        children.sort((a, b) => a.sort_order - b.sort_order);

        const simpleChildren: { to: string; label: string; tooltip?: string }[] = [];
        const groupMap = new Map<string, { to: string; label: string; tooltip?: string }[]>();

        for (const ch of children) {
          if (ch.nav_key.startsWith("spacer:")) continue;
          if (ch.group_label) {
            const grp = groupMap.get(ch.group_label) || [];
            grp.push({ to: ch.to, label: ch.label, tooltip: ch.tooltip });
            groupMap.set(ch.group_label, grp);
          } else {
            simpleChildren.push({ to: ch.to, label: ch.label, tooltip: ch.tooltip });
          }
        }

        if (groupMap.size > 0) {
          parent.groups = Array.from(groupMap.entries()).map(([label, items]) => ({
            label,
            items,
          }));
          if (simpleChildren.length > 0) {
            parent.children = simpleChildren;
          }
        } else if (simpleChildren.length > 0) {
          parent.children = simpleChildren;
        }
      }
    }

    return topLevelList.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [baseItems, settings]);

  return {
    navItems,
    settings,
    isLoading: query.isLoading,
  };
}

export function useNavSettingsManager() {
  const queryClient = useQueryClient();

  const query = useQuery<NavItemSetting[]>({
    queryKey: queryKeys.navigation.settings(),
    queryFn: async () => {
      const { data } = await apiClient.get<NavItemSetting[]>(
        API_ROUTES.navigation.settings(),
      );
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (settings: Partial<NavItemSetting>[]) => {
      const { data } = await apiClient.put(
        API_ROUTES.navigation.settings(),
        { settings }
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.navigation.settings(),
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete(
        API_ROUTES.navigation.settings()
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.navigation.settings(),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (navKey: string) => {
      const { data } = await apiClient.delete(
        API_ROUTES.navigation.setting(navKey)
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.navigation.settings(),
      });
    },
  });

  return {
    settings: query.data ?? [],
    isLoading: query.isLoading,
    refetch: () => query.refetch(),
    updateSettings: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending || resetMutation.isPending || deleteMutation.isPending,
    resetSettings: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
    deleteSetting: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
