import { type NavItem } from "../components/navRegistry";
export interface NavItemSetting {
    nav_setting_id?: number;
    nav_key: string;
    parent_key?: string | null;
    sort_order: number;
    label_override?: string | null;
    icon_override?: string | null;
    tooltip_override?: string | null;
    is_hidden_override: boolean | number;
}
export declare function useNavSettings(): {
    navItems: NavItem[];
    settings: NavItemSetting[];
    isLoading: boolean;
};
export declare function useNavSettingsManager(): {
    settings: NoInfer<NavItemSetting[]>;
    isLoading: boolean;
    refetch: () => Promise<import("@tanstack/query-core").QueryObserverResult<NoInfer<NavItemSetting[]>, Error>>;
    updateSettings: import("@tanstack/react-query").UseMutateAsyncFunction<any, Error, Partial<NavItemSetting>[], unknown>;
    isUpdating: boolean;
    resetSettings: import("@tanstack/react-query").UseMutateAsyncFunction<any, Error, void, unknown>;
    isResetting: boolean;
    deleteSetting: import("@tanstack/react-query").UseMutateAsyncFunction<any, Error, string, unknown>;
    isDeleting: boolean;
};
