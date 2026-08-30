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
    capabilities: Record<string, {
        view: boolean;
        update: boolean;
        delete: boolean;
        execute: boolean;
    }>;
}
export declare function useUserOverrides(userId: number | null): {
    overrides: UserOverrideRecord[];
    profile: NoInfer<CompiledUserProfile> | undefined;
    isLoading: boolean;
    refetch: () => void;
    updateOverrides: import("@tanstack/react-query").UseMutateAsyncFunction<any, Error, UserOverrideUpdatePayload[], unknown>;
    isUpdating: boolean;
};
