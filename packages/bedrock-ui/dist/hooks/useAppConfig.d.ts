import { type ApiResponse } from "../api/client";
import { useAppConfigContext, type AppConfig, type UiQueryConfig, type InventoryStatus } from "../context/AppConfigContext";
export { useAppConfigContext };
export type { AppConfig, UiQueryConfig, InventoryStatus };
/**
 * Fetches the full application runtime configuration from the backend.
 * This hook is called once in App.tsx. The result is available
 * immediately to any component via useAppConfig().
 *
 * @returns TanStack Query result with AppConfig data
 */
export declare function useAppConfig(): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<AppConfig>>, Error>;
/**
 * Returns the query config for a specific hook from the loaded app config.
 * Falls back to sensible defaults if config is not yet loaded.
 *
 * @param hookName - the hook function name e.g. "useLeaderboards"
 * @param config - the AppConfig data from useAppConfig
 * @returns UiQueryConfig for the hook
 */
export declare function getHookConfig(hookName: string, config: AppConfig | null | undefined): UiQueryConfig;
/**
 * Returns all valid inventory statuses from app config.
 * Falls back to the static list if config is not yet loaded.
 *
 * @param config - the AppConfig data from useAppConfig
 * @returns ordered list of InventoryStatus objects
 */
export declare function getInventoryStatuses(config: AppConfig | null | undefined): InventoryStatus[];
