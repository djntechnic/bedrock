import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "../api/client.js";
import { API_ROUTES } from "../api/routes.js";
import { queryKeys } from "./queryKeys.js";
const EMPTY_OVERRIDES = [];
function useUserOverrides(userId) {
  const queryClient = useQueryClient();
  const overridesQuery = useQuery({
    queryKey: queryKeys.security.userOverrides ? queryKeys.security.userOverrides(userId ?? 0) : ["security", "user-overrides", userId],
    queryFn: async () => {
      if (!userId) return EMPTY_OVERRIDES;
      const { data } = await apiClient.get(
        API_ROUTES.security.userOverrides(userId)
      );
      return data;
    },
    enabled: Boolean(userId),
    staleTime: 1e3 * 30
  });
  const profileQuery = useQuery({
    queryKey: queryKeys.security.userProfile(userId ?? 0),
    queryFn: async () => {
      if (!userId) {
        return {
          user_id: 0,
          is_superuser: false,
          roles: [],
          capabilities: {}
        };
      }
      const { data } = await apiClient.get(
        API_ROUTES.security.userProfile(userId)
      );
      return data;
    },
    enabled: Boolean(userId),
    staleTime: 1e3 * 30
  });
  const setOverridesMutation = useMutation({
    mutationFn: async (overrides) => {
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
          queryKey: ["security", "user-overrides", userId]
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.security.userProfile(userId)
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.security.myPermissions(null)
        });
      }
    }
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
    isUpdating: setOverridesMutation.isPending
  };
}
export {
  useUserOverrides
};
//# sourceMappingURL=useUserOverrides.js.map
