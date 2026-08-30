import { useMemo, useRef, useEffect, useCallback } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client.js";
import { API_ROUTES } from "../api/routes.js";
import { queryKeys } from "./queryKeys.js";
import { useAuth } from "./useAuth.js";
import { useGridConfig } from "./useGridConfig.js";
const PERSIST_DEBOUNCE_MS = 600;
function useUserGridPreference(gridId, enabled) {
  return useQuery({
    queryKey: queryKeys.userPreferences.grid(gridId),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.userPreferences.grid(gridId));
      return data;
    },
    enabled,
    staleTime: 6e4
  });
}
function useUserGridPreferences(enabled) {
  return useQuery({
    queryKey: queryKeys.userPreferences.grids(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.userPreferences.grids());
      return data;
    },
    enabled,
    staleTime: 3e4
  });
}
function useUpdateUserGridPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      gridId,
      updates
    }) => {
      const { data } = await apiClient.patch(
        API_ROUTES.userPreferences.grid(gridId),
        updates
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.userPreferences.grid(variables.gridId) });
      qc.invalidateQueries({ queryKey: queryKeys.userPreferences.grids() });
    }
  });
}
function useUnpinUserGridColumn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gridId, columnId }) => {
      const { data } = await apiClient.delete(
        API_ROUTES.userPreferences.gridColumn(gridId, columnId)
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.userPreferences.grid(variables.gridId) });
      qc.invalidateQueries({ queryKey: queryKeys.userPreferences.grids() });
    }
  });
}
function mergeUserGridPreference(adminConfig, userPref, session) {
  let sorting;
  if (session?.sorting !== void 0) {
    sorting = session.sorting;
  } else if (userPref?.sort_column) {
    sorting = [
      { id: userPref.sort_column, desc: userPref.sort_direction === "desc" }
    ];
  } else if (adminConfig.defaultSortColumn) {
    sorting = [
      {
        id: adminConfig.defaultSortColumn,
        desc: adminConfig.defaultSortDirection === "desc"
      }
    ];
  } else {
    sorting = [];
  }
  const userColumnsById = new Map(
    (userPref?.columns ?? []).map((c) => [c.column_id, c])
  );
  const columnVisibility = {};
  const orderEntries = [];
  for (const col of Object.values(adminConfig.columns)) {
    const override = userColumnsById.get(col.column_id);
    columnVisibility[col.column_id] = override?.visible ?? !!col.default_visible;
    orderEntries.push({
      id: col.column_id,
      order: override?.column_order ?? col.column_order
    });
  }
  if (session?.columnVisibility) {
    Object.assign(columnVisibility, session.columnVisibility);
  }
  const columnOrder = session?.columnOrder ?? orderEntries.sort((a, b) => a.order - b.order).map((e) => e.id);
  let pinnedFilters = null;
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
    pinnedFilters
  };
}
function useUserGridConfig(gridId) {
  const adminConfig = useGridConfig(gridId);
  const { isAuthenticated } = useAuth();
  const { data: prefResponse } = useUserGridPreference(gridId, isAuthenticated);
  const userPref = isAuthenticated ? prefResponse?.data : void 0;
  const updateMutation = useUpdateUserGridPreference();
  const merged = useMemo(
    () => mergeUserGridPreference(adminConfig, userPref),
    [adminConfig, userPref]
  );
  const isReady = adminConfig.isLoaded && (!isAuthenticated || prefResponse !== void 0);
  const debounceRef = useRef(null);
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );
  const mutateRef = useRef(updateMutation.mutate);
  useEffect(() => {
    mutateRef.current = updateMutation.mutate;
  }, [updateMutation.mutate]);
  const lastPersistedRef = useRef(/* @__PURE__ */ new Map());
  const schedulePatch = useCallback(
    (updates) => {
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
    [isAuthenticated, gridId]
  );
  const persistSorting = useCallback(
    (sorting) => {
      const first = sorting[0];
      schedulePatch({
        sort_column: first?.id ?? null,
        sort_direction: first ? first.desc ? "desc" : "asc" : null
      });
    },
    [schedulePatch]
  );
  const persistColumnVisible = useCallback(
    (columnId, visible) => {
      schedulePatch({ columns: [{ column_id: columnId, visible }] });
    },
    [schedulePatch]
  );
  const persistColumnOrder = useCallback(
    (order) => {
      schedulePatch({
        columns: order.map((column_id, column_order) => ({
          column_id,
          column_order
        }))
      });
    },
    [schedulePatch]
  );
  const persistFilters = useCallback(
    (filters) => {
      schedulePatch({ pinned_filter_set: JSON.stringify(filters) });
    },
    [schedulePatch]
  );
  const setDashboardPin = useCallback(
    (next) => {
      if (!isAuthenticated) return;
      mutateRef.current({ gridId, updates: { dashboard_pin: next } });
    },
    [isAuthenticated, gridId]
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
    setDashboardPin
  };
}
function useUserPinnedGrids() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useUserGridPreferences(isAuthenticated);
  const pinned = useMemo(
    () => (data?.data ?? []).filter((row) => row.dashboard_pin),
    [data]
  );
  return { data: pinned, isLoading: isAuthenticated && isLoading };
}
function useUserPlayerPins() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useUserGridPreferences(isAuthenticated);
  const playerIds = useMemo(() => {
    const row = (data?.data ?? []).find((r) => r.grid_id === "player_pins");
    if (!row) return [];
    return [...row.columns].sort((a, b) => (a.column_order ?? 0) - (b.column_order ?? 0)).map((c) => Number(c.column_id)).filter((id) => Number.isFinite(id));
  }, [data]);
  return { playerIds, isLoading: isAuthenticated && isLoading };
}
function useTogglePlayerPin() {
  const updateMutation = useUpdateUserGridPreference();
  const unpinMutation = useUnpinUserGridColumn();
  const { playerIds } = useUserPlayerPins();
  const toggle = useCallback(
    (playerId) => {
      const columnId = String(playerId);
      if (playerIds.includes(playerId)) {
        unpinMutation.mutate({ gridId: "player_pins", columnId });
      } else {
        updateMutation.mutate({
          gridId: "player_pins",
          updates: {
            columns: [
              { column_id: columnId, visible: true, column_order: playerIds.length }
            ]
          }
        });
      }
    },
    [playerIds, updateMutation, unpinMutation]
  );
  return { toggle, isPinned: (playerId) => playerIds.includes(playerId) };
}
export {
  mergeUserGridPreference,
  useTogglePlayerPin,
  useUnpinUserGridColumn,
  useUpdateUserGridPreference,
  useUserGridConfig,
  useUserGridPreference,
  useUserGridPreferences,
  useUserPinnedGrids,
  useUserPlayerPins
};
//# sourceMappingURL=useUserGridConfig.js.map
