import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client.js";
import { API_ROUTES } from "../api/routes.js";
import { queryKeys } from "./queryKeys.js";
import { useAppConfigContext } from "../context/AppConfigContext.js";
function useAppConfig() {
  return useQuery({
    queryKey: queryKeys.appConfig.all,
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.appConfig.root());
      return data;
    },
    // Config changes rarely — 10 minute stale time.
    // On explicit config save in Admin, invalidate this query.
    staleTime: 1e3 * 60 * 10,
    refetchOnWindowFocus: false
  });
}
function getHookConfig(hookName, config) {
  return config?.ui_query_config?.[hookName] ?? {
    staleTime: 3e5,
    // 5 minute fallback
    refetchInterval: null,
    refetchOnWindowFocus: false
  };
}
function getInventoryStatuses(config) {
  if (config?.inventory_statuses?.length) {
    return config.inventory_statuses;
  }
  return [
    {
      status_key: "In Collection",
      display_label: "In Collection",
      is_default: 1,
      aliases: null,
      sort_order: 0,
      color_class: "bg-positive/15 text-positive"
    },
    {
      status_key: "On Hold",
      display_label: "On Hold",
      is_default: 0,
      aliases: null,
      sort_order: 1,
      color_class: "bg-warning/15 text-warning"
    },
    {
      status_key: "For Sale/Trade",
      display_label: "For Sale/Trade",
      is_default: 0,
      aliases: null,
      sort_order: 2,
      color_class: "bg-info/15 text-info"
    },
    {
      status_key: "Sale/Trade Pending",
      display_label: "Sale/Trade Pending",
      is_default: 0,
      aliases: null,
      sort_order: 3,
      color_class: "bg-neutral/15 text-neutral"
    },
    {
      status_key: "Wantlist",
      display_label: "Wantlist",
      is_default: 0,
      aliases: null,
      sort_order: 4,
      color_class: "bg-negative/15 text-negative"
    }
  ];
}
export {
  getHookConfig,
  getInventoryStatuses,
  useAppConfig,
  useAppConfigContext
};
//# sourceMappingURL=useAppConfig.js.map
