/**
 * @file AppConfigContext.ts
 * @module frontend/src/context
 * @description React context providing the loaded AppConfig to all
 *              components. Populated in App.tsx on mount.
 */
import { createContext, useContext } from "react";

export interface InventoryStatus {
  status_key: string;
  display_label: string;
  is_default: number;
  aliases: string | null;
  sort_order: number;
  color_class: string;
}

export interface UiQueryConfig {
  staleTime: number;
  refetchInterval: number | null;
  refetchOnWindowFocus: boolean;
}

export interface AppConfig {
  current_season: number;
  seasons: {
    season_year: number;
    season_type: string;
    is_current: number;
    data_source: string;
    lahman_available: number;
  }[];
  inventory_statuses: InventoryStatus[];
  ui_query_config: Record<string, UiQueryConfig>;
  app_config: Record<string, string>;
}

export const AppConfigContext = createContext<AppConfig | null>(null);

/**
 * Returns the loaded AppConfig from context.
 * Returns null if config has not yet loaded.
 */
export function useAppConfigContext(): AppConfig | null {
  return useContext(AppConfigContext);
}
