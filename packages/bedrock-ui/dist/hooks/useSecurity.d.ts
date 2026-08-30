import type { ButtonHTMLAttributes, ReactNode } from "react";
export type ActionType = "view" | "update" | "delete" | "execute";
export interface CapabilityMap {
    view: boolean;
    update: boolean;
    delete: boolean;
    execute: boolean;
}
export type PermissionsMap = Record<string, CapabilityMap>;
export interface UseSecurityResult {
    permissions: PermissionsMap;
    /** Check if caller has capability on a module (defaults to 'view') */
    can: (module: string, action?: ActionType) => boolean;
    /** Legacy-compatible alias for can(module, 'view') */
    hasModule: (module: string) => boolean;
    isActionAllowed: (module: string, action: ActionType) => boolean;
    isLoading: boolean;
    isError: boolean;
    refresh: () => Promise<void>;
}
export declare function useSecurity(): UseSecurityResult;
export interface CanProps {
    module: string;
    action?: ActionType;
    children: ReactNode;
    fallback?: ReactNode;
}
/**
 * Declarative capability rendering guard.
 * Renders `children` if caller holds capability on `module`; otherwise renders `fallback` (or null).
 */
export declare function Can({ module, action, children, fallback }: CanProps): import("react").JSX.Element | null;
export interface PermissionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    module: string;
    action?: ActionType;
    fallback?: ReactNode;
    tooltipWhenDisabled?: string;
}
/**
 * A Button that disables itself and displays a tooltip when the user lacks the required permission.
 */
export declare function PermissionButton({ module, action, disabled, title, tooltipWhenDisabled, children, ...props }: PermissionButtonProps): import("react").JSX.Element;
