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
export declare function useModules(): UseModulesResult;
