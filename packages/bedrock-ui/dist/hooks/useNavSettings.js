import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import * as LucideIcons from "lucide-react";
import { useMemo } from "react";
import { apiClient } from "../api/client.js";
import { API_ROUTES } from "../api/routes.js";
import { getNavItems } from "../components/navRegistry.js";
import { queryKeys } from "./queryKeys.js";
function useNavSettings() {
  const query = useQuery({
    queryKey: queryKeys.navigation.settings(),
    queryFn: async () => {
      const { data } = await apiClient.get(
        API_ROUTES.navigation.settings()
      );
      return data;
    },
    staleTime: 1e3 * 60 * 5,
    refetchOnWindowFocus: false
  });
  const baseItems = getNavItems();
  const settings = query.data ?? [];
  const navItems = useMemo(() => {
    const settingsMap = /* @__PURE__ */ new Map();
    for (const s of settings) {
      settingsMap.set(s.nav_key, s);
    }
    const flatMap = /* @__PURE__ */ new Map();
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
          default_sort_order: top.sort_order ?? orderIndex
        });
        orderIndex += 10;
      }
      if (top.children) {
        for (const child of top.children) {
          if (!flatMap.has(child.to)) {
            flatMap.set(child.to, {
              nav_key: child.to,
              label: child.label,
              tooltip: child.tooltip,
              module: child.module,
              action: child.action,
              role: child.role,
              default_parent_key: top.to,
              default_sort_order: orderIndex
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
                tooltip: item.tooltip,
                module: item.module,
                action: item.action,
                role: item.role,
                default_parent_key: top.to,
                group_label: grp.label,
                default_sort_order: orderIndex
              });
              orderIndex += 10;
            }
          }
        }
      }
    }
    for (const s of settings) {
      if (!flatMap.has(s.nav_key)) {
        const isSpacer = s.nav_key.startsWith("spacer:");
        flatMap.set(s.nav_key, {
          nav_key: s.nav_key,
          label: s.label_override || (isSpacer ? "Section" : s.nav_key),
          default_parent_key: s.parent_key ?? null,
          default_sort_order: s.sort_order ?? orderIndex
        });
        orderIndex += 10;
      }
    }
    const resolvedItems = [];
    for (const [nav_key, cand] of flatMap.entries()) {
      const s = settingsMap.get(nav_key);
      const isHidden = s ? Boolean(s.is_hidden_override) : false;
      if (isHidden) continue;
      let IconComp = cand.icon;
      if (s?.icon_override && s.icon_override in LucideIcons) {
        IconComp = LucideIcons[s.icon_override];
      }
      if (!IconComp) {
        IconComp = LucideIcons.CircleDot || LucideIcons.FileText;
      }
      const parent_key = s?.parent_key !== void 0 ? s.parent_key : cand.default_parent_key;
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
        group_label: cand.group_label
      });
    }
    const topLevelList = [];
    const childrenByParent = /* @__PURE__ */ new Map();
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
          groups: []
        });
      } else {
        const arr = childrenByParent.get(item.parent_key) || [];
        arr.push(item);
        childrenByParent.set(item.parent_key, arr);
      }
    }
    for (const parent of topLevelList) {
      const children = childrenByParent.get(parent.to);
      if (children && children.length > 0) {
        children.sort((a, b) => a.sort_order - b.sort_order);
        const simpleChildren = [];
        const groupMap = /* @__PURE__ */ new Map();
        for (const ch of children) {
          if (ch.nav_key.startsWith("spacer:")) continue;
          const subItem = {
            to: ch.to,
            label: ch.label,
            tooltip: ch.tooltip,
            module: ch.module,
            action: ch.action,
            role: ch.role
          };
          if (ch.group_label) {
            const grp = groupMap.get(ch.group_label) || [];
            grp.push(subItem);
            groupMap.set(ch.group_label, grp);
          } else {
            simpleChildren.push(subItem);
          }
        }
        if (groupMap.size > 0) {
          parent.groups = Array.from(groupMap.entries()).map(([label, items]) => ({
            label,
            items
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
    isLoading: query.isLoading
  };
}
function useNavSettingsManager() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.navigation.settings(),
    queryFn: async () => {
      const { data } = await apiClient.get(
        API_ROUTES.navigation.settings()
      );
      return data;
    }
  });
  const updateMutation = useMutation({
    mutationFn: async (settings) => {
      const { data } = await apiClient.put(
        API_ROUTES.navigation.settings(),
        { settings }
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.navigation.settings()
      });
    }
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
        queryKey: queryKeys.navigation.settings()
      });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: async (navKey) => {
      const { data } = await apiClient.delete(
        API_ROUTES.navigation.setting(navKey)
      );
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.navigation.settings()
      });
    }
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
    isDeleting: deleteMutation.isPending
  };
}
export {
  useNavSettings,
  useNavSettingsManager
};
//# sourceMappingURL=useNavSettings.js.map
