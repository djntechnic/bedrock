import type { SortingState, VisibilityState } from "@tanstack/react-table";
import { type ApiResponse } from "../api/client";
import { type GridConfig } from "./useGridConfig";
export interface UserGridColumnPreference {
    column_id: string;
    /** `null` = no override, inherit the admin default_visible. */
    visible: boolean | null;
    /** `null` = no override, inherit the admin column_order. */
    column_order: number | null;
}
export interface UserGridPreference {
    user_id: number;
    grid_id: string;
    sort_column: string | null;
    sort_direction: "asc" | "desc" | null;
    /** Raw JSON text of the saved columnFilters snapshot, or null. */
    pinned_filter_set: string | null;
    dashboard_pin: boolean;
    columns: UserGridColumnPreference[];
}
export interface UserGridPreferenceUpdate {
    sort_column?: string | null;
    sort_direction?: "asc" | "desc" | null;
    pinned_filter_set?: string | null;
    dashboard_pin?: boolean;
    columns?: Array<{
        column_id: string;
        visible?: boolean | null;
        column_order?: number | null;
    }>;
}
/** Fetches the caller's saved preference row for `gridId`. Disabled entirely
 * for anonymous visitors — no network call, no 401 noise. */
export declare function useUserGridPreference(gridId: string, enabled: boolean): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<UserGridPreference>>, Error>;
/** Every saved grid row for the caller — used to assemble the dashboard's
 * pinned-content score strip without a per-grid round trip. */
export declare function useUserGridPreferences(enabled: boolean): import("@tanstack/react-query").UseQueryResult<NoInfer<ApiResponse<UserGridPreference[]>>, Error>;
export declare function useUpdateUserGridPreference(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    gridId: string;
    updates: UserGridPreferenceUpdate;
}, unknown>;
export declare function useUnpinUserGridColumn(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    gridId: string;
    columnId: string;
}, unknown>;
export interface MergedUserGridState {
    sorting: SortingState;
    columnVisibility: VisibilityState;
    columnOrder: string[];
    dashboardPin: boolean;
    /** Parsed `pinned_filter_set`, or `null` when absent/malformed/not an array. */
    pinnedFilters: unknown[] | null;
}
export interface SessionGridOverrides {
    sorting?: SortingState;
    columnVisibility?: VisibilityState;
    columnOrder?: string[];
}
/**
 * Pure merge: admin default → user override → session state. Exported for
 * direct unit testing — this is the priority surface the per-user
 * customization feature lives or dies on (see mergeUserGridPreference.test.ts).
 *
 * Column overrides only apply to columns still present in `adminConfig.columns`
 * — a saved override for a column the admin later removed is silently
 * ignored rather than reintroducing a dead column.
 */
export declare function mergeUserGridPreference(adminConfig: GridConfig, userPref: UserGridPreference | undefined, session?: SessionGridOverrides): MergedUserGridState;
export interface UserGridConfigBundle {
    adminConfig: GridConfig;
    merged: MergedUserGridState;
    /** True once admin config (and, when authenticated, the user's saved
     * preference) has resolved — gates initial-state seeding. */
    isReady: boolean;
    persistSorting: (sorting: SortingState) => void;
    persistColumnVisible: (columnId: string, visible: boolean) => void;
    persistColumnOrder: (order: string[]) => void;
    persistFilters: (filters: unknown[]) => void;
    dashboardPin: boolean;
    setDashboardPin: (next: boolean) => void;
}
/**
 * Composes admin config + the user's saved preference into a single bundle
 * consumed by `useTableState`. No-ops every read/write when the caller is
 * anonymous — `isAuthenticated=false` means zero network traffic to the new
 * endpoints and today's pure-admin-default behavior, unchanged.
 */
export declare function useUserGridConfig(gridId: string): UserGridConfigBundle;
/** Grids the user has pinned as dashboard sources (`dashboard_pin=1`). */
export declare function useUserPinnedGrids(): {
    data: UserGridPreference[];
    isLoading: boolean;
};
/** Pinned player IDs from the synthetic 'player_pins' grid_id, in pin-rank order. */
export declare function useUserPlayerPins(): {
    playerIds: number[];
    isLoading: boolean;
};
/** Toggle a single player's pinned status from either the leaderboard row
 * icon or PlayerProfileFlyout — one shared mechanism, two entry points. */
export declare function useTogglePlayerPin(): {
    toggle: (playerId: number) => void;
    isPinned: (playerId: number) => boolean;
};
