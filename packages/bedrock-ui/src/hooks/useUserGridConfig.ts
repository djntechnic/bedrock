/**
 * @file useUserGridConfig.ts
 * @module frontend/src/hooks
 * @description Per-user grid/dashboard customization layered on top of the
 * admin-global GridConfig (useGridConfig). Merge order is admin default →
 * user override → session state: `mergeUserGridPreference` is the pure,
 * independently-tested function that implements the first two tiers; the
 * third tier is just whatever's currently in `useTableState`'s React state
 * — this hook only needs to produce a correct *initial* seed plus debounced
 * persist callbacks for when that state changes.
 *
 * `grid_id='dashboard'` and `grid_id='player_pins'` are synthetic — they
 * reuse this same (grid_id, column_id) shape as an ordered pin registry
 * (dashboard widget order/visibility, and pinned players) rather than real
 * column config. See api/services/user_preferences_service.py for the
 * backend side of that convention.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SortingState, VisibilityState } from "@tanstack/react-table";

import { apiClient, type ApiResponse } from "../api/client";
import { API_ROUTES } from "../api/routes";
import { queryKeys } from "./queryKeys";
import { useAuth } from "./useAuth";
import { useGridConfig, type GridConfig } from "./useGridConfig";

/** Debounce window for typing/dragging-driven persists (sort, column
 * visibility, column order, filters). Discrete toggles (dashboard pin,
 * player pin/unpin) persist immediately instead. */
const PERSIST_DEBOUNCE_MS = 600;

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
export function useUserGridPreference(gridId: string, enabled: boolean) {
  return useQuery<ApiResponse<UserGridPreference>>({
    queryKey: queryKeys.userPreferences.grid(gridId),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.userPreferences.grid(gridId));
      return data;
    },
    enabled,
    staleTime: 60_000,
  });
}

/** Every saved grid row for the caller — used to assemble the dashboard's
 * pinned-content score strip without a per-grid round trip. */
export function useUserGridPreferences(enabled: boolean) {
  return useQuery<ApiResponse<UserGridPreference[]>>({
    queryKey: queryKeys.userPreferences.grids(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.userPreferences.grids());
      return data;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useUpdateUserGridPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gridId,
      updates,
    }: {
      gridId: string;
      updates: UserGridPreferenceUpdate;
    }) => {
      const { data } = await apiClient.patch(
        API_ROUTES.userPreferences.grid(gridId),
        updates,
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.userPreferences.grid(variables.gridId) });
      qc.invalidateQueries({ queryKey: queryKeys.userPreferences.grids() });
    },
  });
}

export function useUnpinUserGridColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gridId, columnId }: { gridId: string; columnId: string }) => {
      const { data } = await apiClient.delete(
        API_ROUTES.userPreferences.gridColumn(gridId, columnId),
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.userPreferences.grid(variables.gridId) });
      qc.invalidateQueries({ queryKey: queryKeys.userPreferences.grids() });
    },
  });
}

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
export function mergeUserGridPreference(
  adminConfig: GridConfig,
  userPref: UserGridPreference | undefined,
  session?: SessionGridOverrides,
): MergedUserGridState {
  let sorting: SortingState;
  if (session?.sorting !== undefined) {
    sorting = session.sorting;
  } else if (userPref?.sort_column) {
    sorting = [
      { id: userPref.sort_column, desc: userPref.sort_direction === "desc" },
    ];
  } else if (adminConfig.defaultSortColumn) {
    sorting = [
      {
        id: adminConfig.defaultSortColumn,
        desc: adminConfig.defaultSortDirection === "desc",
      },
    ];
  } else {
    sorting = [];
  }

  const userColumnsById = new Map(
    (userPref?.columns ?? []).map((c) => [c.column_id, c] as const),
  );
  const columnVisibility: VisibilityState = {};
  const orderEntries: { id: string; order: number }[] = [];
  for (const col of Object.values(adminConfig.columns)) {
    const override = userColumnsById.get(col.column_id);
    columnVisibility[col.column_id] =
      override?.visible ?? !!col.default_visible;
    orderEntries.push({
      id: col.column_id,
      order: override?.column_order ?? col.column_order,
    });
  }
  if (session?.columnVisibility) {
    Object.assign(columnVisibility, session.columnVisibility);
  }
  const columnOrder =
    session?.columnOrder ??
    orderEntries.sort((a, b) => a.order - b.order).map((e) => e.id);

  let pinnedFilters: unknown[] | null = null;
  if (userPref?.pinned_filter_set) {
    try {
      const parsed = JSON.parse(userPref.pinned_filter_set);
      pinnedFilters = Array.isArray(parsed) ? parsed : null;
    } catch {
      pinnedFilters = null;
    }
  }

  return {
    sorting,
    columnVisibility,
    columnOrder,
    dashboardPin: userPref?.dashboard_pin ?? false,
    pinnedFilters,
  };
}

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
export function useUserGridConfig(gridId: string): UserGridConfigBundle {
  const adminConfig = useGridConfig(gridId);
  const { isAuthenticated } = useAuth();
  const { data: prefResponse } = useUserGridPreference(gridId, isAuthenticated);
  const userPref = isAuthenticated ? prefResponse?.data : undefined;
  const updateMutation = useUpdateUserGridPreference();

  const merged = useMemo(
    () => mergeUserGridPreference(adminConfig, userPref),
    [adminConfig, userPref],
  );

  const isReady =
    adminConfig.isLoaded && (!isAuthenticated || prefResponse !== undefined);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  // `useMutation` returns a fresh result object on every render. Listing it as
  // a dependency below made `schedulePatch` — and every persist* callback
  // derived from it — a new function each render, so a consumer effect keyed
  // on one of them re-ran on identity alone. That re-armed the debounce, the
  // PATCH invalidated the preference queries, the refetch re-rendered, and the
  // cycle sustained itself: an unbounded PATCH/GET loop under an idle grid.
  // `.mutate` is stable across renders, so holding it in a ref lets the
  // callbacks depend on values that actually change.
  const mutateRef = useRef(updateMutation.mutate);
  useEffect(() => {
    mutateRef.current = updateMutation.mutate;
  }, [updateMutation.mutate]);

  // Second guard, independent of identity: never arm the debounce for a
  // payload we already persisted. Keyed by the update's field set, so an
  // unchanged sort does not mask a changed filter and vice versa — two
  // alternating no-op persists would otherwise keep each other alive.
  const lastPersistedRef = useRef<Map<string, string>>(new Map());

  const schedulePatch = useCallback(
    (updates: UserGridPreferenceUpdate) => {
      if (!isAuthenticated) return;

      const fieldSet = Object.keys(updates).sort().join(",");
      const payload = JSON.stringify(updates);
      if (lastPersistedRef.current.get(fieldSet) === payload) return;
      lastPersistedRef.current.set(fieldSet, payload);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        mutateRef.current({ gridId, updates });
      }, PERSIST_DEBOUNCE_MS);
    },
    [isAuthenticated, gridId],
  );

  const persistSorting = useCallback(
    (sorting: SortingState) => {
      const first = sorting[0];
      schedulePatch({
        sort_column: first?.id ?? null,
        sort_direction: first ? (first.desc ? "desc" : "asc") : null,
      });
    },
    [schedulePatch],
  );

  const persistColumnVisible = useCallback(
    (columnId: string, visible: boolean) => {
      schedulePatch({ columns: [{ column_id: columnId, visible }] });
    },
    [schedulePatch],
  );

  const persistColumnOrder = useCallback(
    (order: string[]) => {
      schedulePatch({
        columns: order.map((column_id, column_order) => ({
          column_id,
          column_order,
        })),
      });
    },
    [schedulePatch],
  );

  const persistFilters = useCallback(
    (filters: unknown[]) => {
      schedulePatch({ pinned_filter_set: JSON.stringify(filters) });
    },
    [schedulePatch],
  );

  const setDashboardPin = useCallback(
    (next: boolean) => {
      if (!isAuthenticated) return;
      // Discrete toggle — persists immediately, no debounce. Goes through the
      // ref for the same identity reason as `schedulePatch`, and deliberately
      // skips the last-persisted guard: a toggle is an explicit act and must
      // reach the server even if it restores the previous value.
      mutateRef.current({ gridId, updates: { dashboard_pin: next } });
    },
    [isAuthenticated, gridId],
  );

  return {
    adminConfig,
    merged,
    isReady,
    persistSorting,
    persistColumnVisible,
    persistColumnOrder,
    persistFilters,
    dashboardPin: merged.dashboardPin,
    setDashboardPin,
  };
}

/** Grids the user has pinned as dashboard sources (`dashboard_pin=1`). */
export function useUserPinnedGrids(): {
  data: UserGridPreference[];
  isLoading: boolean;
} {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useUserGridPreferences(isAuthenticated);
  const pinned = useMemo(
    () => (data?.data ?? []).filter((row) => row.dashboard_pin),
    [data],
  );
  return { data: pinned, isLoading: isAuthenticated && isLoading };
}

/** Pinned player IDs from the synthetic 'player_pins' grid_id, in pin-rank order. */
export function useUserPlayerPins(): {
  playerIds: number[];
  isLoading: boolean;
} {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useUserGridPreferences(isAuthenticated);
  const playerIds = useMemo(() => {
    const row = (data?.data ?? []).find((r) => r.grid_id === "player_pins");
    if (!row) return [];
    return [...row.columns]
      .sort((a, b) => (a.column_order ?? 0) - (b.column_order ?? 0))
      .map((c) => Number(c.column_id))
      .filter((id) => Number.isFinite(id));
  }, [data]);
  return { playerIds, isLoading: isAuthenticated && isLoading };
}

/** Toggle a single player's pinned status from either the leaderboard row
 * icon or PlayerProfileFlyout — one shared mechanism, two entry points. */
export function useTogglePlayerPin() {
  const updateMutation = useUpdateUserGridPreference();
  const unpinMutation = useUnpinUserGridColumn();
  const { playerIds } = useUserPlayerPins();

  const toggle = useCallback(
    (playerId: number) => {
      const columnId = String(playerId);
      if (playerIds.includes(playerId)) {
        unpinMutation.mutate({ gridId: "player_pins", columnId });
      } else {
        updateMutation.mutate({
          gridId: "player_pins",
          updates: {
            columns: [
              { column_id: columnId, visible: true, column_order: playerIds.length },
            ],
          },
        });
      }
    },
    [playerIds, updateMutation, unpinMutation],
  );

  return { toggle, isPinned: (playerId: number) => playerIds.includes(playerId) };
}
