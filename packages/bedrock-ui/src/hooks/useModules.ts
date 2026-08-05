/**
 * @file useModules.ts
 * @module frontend/src/hooks
 * @description Phase 5.9 frontend — fetches the caller's effective module
 *              slug set from `GET /api/v1/modules/me` and exposes a
 *              `hasModule(slug)` predicate. Anonymous callers receive the
 *              `anon` role's default set from the backend, so a single hook
 *              works for logged-out and logged-in surfaces alike.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiClient } from "../api/client";
import { API_ROUTES } from "../api/routes";
import { queryKeys } from "./queryKeys";
import { useAuth } from "./useAuth";

export interface ModulesMeResponse {
  authenticated: boolean;
  modules: string[];
}

export interface UseModulesResult {
  modules: Set<string>;
  hasModule: (slug: string) => boolean;
  authenticated: boolean;
  isLoading: boolean;
  isError: boolean;
}

export function useModules(): UseModulesResult {
  // Re-fetch whenever the auth token identity changes so a login/logout
  // flips the module set without a manual invalidate at the call site.
  const { token } = useAuth();
  const query = useQuery<ModulesMeResponse>({
    queryKey: queryKeys.modules.me(token),
    queryFn: async () => {
      const { data } = await apiClient.get<ModulesMeResponse>(
        API_ROUTES.modules.me(),
      );
      return data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const modules = useMemo(
    () => new Set(query.data?.modules ?? []),
    [query.data?.modules],
  );

  return {
    modules,
    hasModule: (slug: string) => modules.has(slug),
    authenticated: query.data?.authenticated ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
