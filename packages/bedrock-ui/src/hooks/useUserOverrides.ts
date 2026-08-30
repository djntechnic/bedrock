/**
 * @file useUserOverrides.ts
 * @module @djntechnic/bedrock-ui/hooks
 * @description Hook for managing tri-state per-user module capability overrides and compiled profile inspection.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { API_ROUTES } from "../api/routes";
import { queryKeys } from "./queryKeys";

export interface UserOverrideRecord {
  override_id?: number;
  user_id: number;
  module_id: number;
  module_slug: string;
  module_label: string;
  is_core: boolean;
  can_view: boolean | null;
  can_update: boolean | null;
  can_delete: boolean | null;
  can_execute: boolean | null;
}

export interface UserOverrideUpdatePayload {
  module_id: number;
  can_view: boolean | null;
  can_update: boolean | null;
  can_delete: boolean | null;
  can_execute: boolean | null;
}

export interface CompiledUserProfile {
  user_id: number;
  email?: string;
  is_superuser: boolean;
  roles: string[];
  capabilities: Record<
    string,
    {
      view: boolean;
      update: boolean;
      delete: boolean;
      execute: boolean;
    }
  >;
}

const EMPTY_OVERRIDES: UserOverrideRecord[] = [];

export function useUserOverrides(userId: number | null) {
  const queryClient = useQueryClient();

  const overridesQuery = useQuery<UserOverrideRecord[]>({
    queryKey: queryKeys.security.userOverrides ? queryKeys.security.userOverrides(userId ?? 0) : ["security", "user-overrides", userId],
    queryFn: async () => {
      if (!userId) return EMPTY_OVERRIDES;
      const { data } = await apiClient.get<UserOverrideRecord[]>(
        API_ROUTES.security.userOverrides(userId)
      );
      return data;
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
  });

  const profileQuery = useQuery<CompiledUserProfile>({
    queryKey: queryKeys.security.userProfile(userId ?? 0),
    queryFn: async () => {
      if (!userId) {
        return {
          user_id: 0,
          is_superuser: false,
          roles: [],
          capabilities: {},
        };
      }
      const { data } = await apiClient.get<CompiledUserProfile>(
        API_ROUTES.security.userProfile(userId)
      );
      return data;
    },
    enabled: Boolean(userId),
    staleTime: 1000 * 30,
  });

  const setOverridesMutation = useMutation({
    mutationFn: async (overrides: UserOverrideUpdatePayload[]) => {
      if (!userId) throw new Error("No user selected");
      const { data } = await apiClient.put(
        API_ROUTES.security.userOverrides(userId),
        { overrides }
      );
      return data;
    },
    onSuccess: () => {
      if (userId) {
        void queryClient.invalidateQueries({
          queryKey: ["security", "user-overrides", userId],
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.security.userProfile(userId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.security.myPermissions(null),
        });
      }
    },
  });

  return {
    overrides: overridesQuery.data ?? EMPTY_OVERRIDES,
    profile: profileQuery.data,
    isLoading: overridesQuery.isLoading || profileQuery.isLoading,
    refetch: () => {
      void overridesQuery.refetch();
      void profileQuery.refetch();
    },
    updateOverrides: setOverridesMutation.mutateAsync,
    isUpdating: setOverridesMutation.isPending,
  };
}
