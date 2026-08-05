/**
 * @file useAppConfig.ts
 * @module frontend/src/hooks
 * @description Loads all runtime configuration from the backend on app
 *              startup. Provides typed access to current season, inventory
 *              statuses, and UI query config for all hooks.
 *              Called once in App.tsx on mount — all other hooks consume
 *              this context rather than fetching config independently.
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient, type ApiResponse } from "../api/client";
import { API_ROUTES } from "../api/routes";
import { queryKeys } from "./queryKeys";
import { 
  useAppConfigContext, 
  type AppConfig, 
  type UiQueryConfig, 
  type InventoryStatus 
} from "../context/AppConfigContext";

export { useAppConfigContext };
export type { AppConfig, UiQueryConfig, InventoryStatus };

/**
 * Fetches the full application runtime configuration from the backend.
 * This hook is called once in App.tsx. The result is available
 * immediately to any component via useAppConfig().
 *
 * @returns TanStack Query result with AppConfig data
 */
export function useAppConfig() {
  return useQuery<ApiResponse<AppConfig>>({
    queryKey: queryKeys.appConfig.all,
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.appConfig.root());
      return data;
    },
    // Config changes rarely — 10 minute stale time.
    // On explicit config save in Admin, invalidate this query.
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

/**
 * Returns the query config for a specific hook from the loaded app config.
 * Falls back to sensible defaults if config is not yet loaded.
 *
 * @param hookName - the hook function name e.g. "useLeaderboards"
 * @param config - the AppConfig data from useAppConfig
 * @returns UiQueryConfig for the hook
 */
export function getHookConfig(
  hookName: string,
  config: AppConfig | null | undefined,
): UiQueryConfig {
  return config?.ui_query_config?.[hookName] ?? {
    staleTime: 300_000,    // 5 minute fallback
    refetchInterval: null,
    refetchOnWindowFocus: false,
  };
}

/**
 * Returns all valid inventory statuses from app config.
 * Falls back to the static list if config is not yet loaded.
 *
 * @param config - the AppConfig data from useAppConfig
 * @returns ordered list of InventoryStatus objects
 */
export function getInventoryStatuses(
  config: AppConfig | null | undefined,
): InventoryStatus[] {
  if (config?.inventory_statuses?.length) {
    return config.inventory_statuses;
  }
  // Static fallback — matches DB seed values
  return [
    { status_key: "In Collection",    display_label: "In Collection",
      is_default: 1, aliases: null, sort_order: 0,
      color_class: "bg-emerald-100 text-emerald-800" },
    { status_key: "On Hold",          display_label: "On Hold",
      is_default: 0, aliases: null, sort_order: 1,
      color_class: "bg-amber-100 text-amber-800" },
    { status_key: "For Sale/Trade",   display_label: "For Sale/Trade",
      is_default: 0, aliases: null, sort_order: 2,
      color_class: "bg-blue-100 text-blue-800" },
    { status_key: "Sale/Trade Pending", display_label: "Sale/Trade Pending",
      is_default: 0, aliases: null, sort_order: 3,
      color_class: "bg-purple-100 text-purple-800" },
    { status_key: "Wantlist",         display_label: "Wantlist",
      is_default: 0, aliases: null, sort_order: 4,
      color_class: "bg-rose-100 text-rose-800" },
  ];
}
