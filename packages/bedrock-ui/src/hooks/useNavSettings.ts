/**
 * @file useNavSettings.ts
 * @module frontend/src/hooks
 * @description Fetches dynamic navigation settings from `/api/v1/navigation/settings`
 *              and merges them with registered NavItem definitions.
 */
import { useQuery } from "@tanstack/react-query";
import * as LucideIcons from "lucide-react";
import { useMemo } from "react";
import { apiClient } from "../api/client";
import { API_ROUTES } from "../api/routes";
import { getNavItems, type NavItem } from "../components/navRegistry";
import { queryKeys } from "./queryKeys";

export interface NavItemSetting {
  nav_setting_id: number;
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

    const merged = baseItems.map((item) => {
      const s = settingsMap.get(item.to);
      if (!s) return item;

      let IconComp = item.icon;
      if (s.icon_override && s.icon_override in LucideIcons) {
        IconComp = (LucideIcons as Record<string, any>)[s.icon_override];
      }

      return {
        ...item,
        label: s.label_override || item.label,
        icon: IconComp,
        tooltip: s.tooltip_override || item.tooltip,
        sort_order: s.sort_order ?? item.sort_order ?? 0,
        is_hidden: Boolean(s.is_hidden_override) || item.is_hidden,
      };
    });

    return merged.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [baseItems, settings]);

  return {
    navItems,
    settings,
    isLoading: query.isLoading,
  };
}
