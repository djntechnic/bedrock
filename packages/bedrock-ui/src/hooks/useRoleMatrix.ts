/**
 * @file useRoleMatrix.ts
 * @module frontend/src/hooks
 * @description Role permissions matrix and custom role mutations hook.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { API_ROUTES } from "../api/routes";
import { queryKeys } from "./queryKeys";

export interface RoleRecord {
  role_id: number;
  slug: string;
  label: string;
  description?: string | null;
  user_count?: number;
  created_at: string;
  created_by: string;
  modified_at: string;
  modified_by: string;
}

export interface MatrixCell {
  role_id: number;
  role_slug: string;
  role_label: string;
  module_id: number;
  module_slug: string;
  module_label: string;
  is_core: number;
  can_view: boolean | number;
  can_update: boolean | number;
  can_delete: boolean | number;
  can_execute: boolean | number;
}

export interface MatrixCellUpdate {
  role_id: number;
  module_id: number;
  can_view: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_execute: boolean;
}

const EMPTY_MATRIX: MatrixCell[] = [];
const EMPTY_ROLES: RoleRecord[] = [];

export function useRoleMatrix() {
  const queryClient = useQueryClient();

  const matrixQuery = useQuery<MatrixCell[]>({
    queryKey: queryKeys.security.matrix(),
    queryFn: async () => {
      const { data } = await apiClient.get<MatrixCell[]>(API_ROUTES.security.matrix());
      return data;
    },
    staleTime: 1000 * 60 * 2,
  });

  const rolesQuery = useQuery<RoleRecord[]>({
    queryKey: queryKeys.security.roles(),
    queryFn: async () => {
      const { data } = await apiClient.get<RoleRecord[]>(API_ROUTES.security.roles());
      return data;
    },
    staleTime: 1000 * 60 * 2,
  });

  const updateMatrixMutation = useMutation({
    mutationFn: async (updates: MatrixCellUpdate[]) => {
      const { data } = await apiClient.put(API_ROUTES.security.matrix(), { updates });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.security.all });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (payload: { slug: string; label: string; description?: string }) => {
      const { data } = await apiClient.post(API_ROUTES.security.roles(), payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.security.all });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ roleId, payload }: { roleId: number; payload: { label?: string; description?: string } }) => {
      const { data } = await apiClient.patch(API_ROUTES.security.role(roleId), payload);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.security.all });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: number) => {
      const { data } = await apiClient.delete(API_ROUTES.security.role(roleId));
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.security.all });
    },
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
    isDeletingRole: deleteRoleMutation.isPending,
  };
}
