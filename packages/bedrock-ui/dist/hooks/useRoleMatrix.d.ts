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
export declare function useRoleMatrix(): {
    matrix: MatrixCell[];
    roles: RoleRecord[];
    dataUpdatedAt: number;
    isLoading: boolean;
    isError: boolean;
    refetch: () => Promise<void>;
    updateMatrix: import("@tanstack/react-query").UseMutateAsyncFunction<any, Error, MatrixCellUpdate[], unknown>;
    isUpdatingMatrix: boolean;
    createRole: import("@tanstack/react-query").UseMutateAsyncFunction<any, Error, {
        slug: string;
        label: string;
        description?: string;
    }, unknown>;
    isCreatingRole: boolean;
    updateRole: import("@tanstack/react-query").UseMutateAsyncFunction<any, Error, {
        roleId: number;
        payload: {
            label?: string;
            description?: string;
        };
    }, unknown>;
    isUpdatingRole: boolean;
    deleteRole: import("@tanstack/react-query").UseMutateAsyncFunction<any, Error, number, unknown>;
    isDeletingRole: boolean;
};
