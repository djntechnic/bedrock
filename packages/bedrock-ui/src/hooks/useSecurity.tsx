/**
 * @file useSecurity.tsx
 * @module frontend/src/hooks
 * @description Granular RBAC and module capability resolution hook and helper primitives.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { apiClient } from "../api/client";
import { API_ROUTES } from "../api/routes";
import { queryKeys } from "./queryKeys";
import { useAuth } from "./useAuth";

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

export function useSecurity(): UseSecurityResult {
  const { token, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<PermissionsMap>({
    queryKey: queryKeys.security.myPermissions(token),
    queryFn: async () => {
      const { data } = await apiClient.get<PermissionsMap>(
        API_ROUTES.security.myPermissions(),
      );
      return data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const permissions = useMemo(() => query.data ?? {}, [query.data]);

  const can = useCallback(
    (module: string, action: ActionType = "view"): boolean => {
      if (isAdmin) return true;
      const mod = permissions[module];
      if (!mod) return false;
      return Boolean(mod[action]);
    },
    [permissions, isAdmin],
  );

  const hasModule = useCallback(
    (module: string): boolean => can(module, "view"),
    [can],
  );

  const isActionAllowed = useCallback(
    (module: string, action: ActionType): boolean => can(module, action),
    [can],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.security.myPermissions(token),
    });
  }, [queryClient, token]);

  return {
    permissions,
    can,
    hasModule,
    isActionAllowed,
    isLoading: query.isLoading,
    isError: query.isError,
    refresh,
  };
}

// ── Declarative Component Guards ─────────────────────────────────────────────

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
export function Can({ module, action = "view", children, fallback = null }: CanProps) {
  const { can, isLoading } = useSecurity();
  if (isLoading) return null;
  return can(module, action) ? <>{children}</> : <>{fallback}</>;
}

export interface PermissionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  module: string;
  action?: ActionType;
  fallback?: ReactNode;
  tooltipWhenDisabled?: string;
}

/**
 * A Button that disables itself and displays a tooltip when the user lacks the required permission.
 */
export function PermissionButton({
  module,
  action = "update",
  disabled,
  title,
  tooltipWhenDisabled,
  children,
  ...props
}: PermissionButtonProps) {
  const { can } = useSecurity();
  const allowed = can(module, action);
  const isButtonDisabled = disabled || !allowed;
  const tooltip = !allowed && tooltipWhenDisabled ? tooltipWhenDisabled : title;

  return (
    <button
      {...props}
      disabled={isButtonDisabled}
      title={tooltip}
      className={`${props.className ?? ""} ${!allowed ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}
