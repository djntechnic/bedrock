import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "../api/client.js";
import { API_ROUTES } from "../api/routes.js";
import { queryKeys } from "./queryKeys.js";
const EMPTY_MATRIX = [];
const EMPTY_ROLES = [];
function useRoleMatrix() {
  const queryClient = useQueryClient();
  const matrixQuery = useQuery({
    queryKey: queryKeys.security.matrix(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.security.matrix());
      return data;
    },
    staleTime: 1e3 * 60 * 2
  });
  const rolesQuery = useQuery({
    queryKey: queryKeys.security.roles(),
    queryFn: async () => {
      const { data } = await apiClient.get(API_ROUTES.security.roles());
      return data;
    },
    staleTime: 1e3 * 60 * 2
  });
  const updateMatrixMutation = useMutation({
    mutationFn: async (updates) => {
      const { data } = await apiClient.put(API_ROUTES.security.matrix(), { updates });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.security.all });
    }
  });
  const createRoleMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post(API_ROUTES.security.roles(), payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.security.all });
    }
  });
  const updateRoleMutation = useMutation({
    mutationFn: async ({ roleId, payload }) => {
      const { data } = await apiClient.patch(API_ROUTES.security.role(roleId), payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.security.all });
    }
  });
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId) => {
      const { data } = await apiClient.delete(API_ROUTES.security.role(roleId));
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.security.all });
    }
  });
  return {
    matrix: matrixQuery.data ?? EMPTY_MATRIX,
    roles: rolesQuery.data ?? EMPTY_ROLES,
    dataUpdatedAt: matrixQuery.dataUpdatedAt,
    isLoading: matrixQuery.isLoading || rolesQuery.isLoading,
    isError: matrixQuery.isError || rolesQuery.isError,
    refetch: async () => {
      await Promise.all([matrixQuery.refetch(), rolesQuery.refetch()]);
    },
    updateMatrix: updateMatrixMutation.mutateAsync,
    isUpdatingMatrix: updateMatrixMutation.isPending,
    createRole: createRoleMutation.mutateAsync,
    isCreatingRole: createRoleMutation.isPending,
    updateRole: updateRoleMutation.mutateAsync,
    isUpdatingRole: updateRoleMutation.isPending,
    deleteRole: deleteRoleMutation.mutateAsync,
    isDeletingRole: deleteRoleMutation.isPending
  };
}
export {
  useRoleMatrix
};
//# sourceMappingURL=useRoleMatrix.js.map
