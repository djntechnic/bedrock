/**
 * @file ProtectedRoute.tsx
 * @module frontend/src/components
 * @description Route guard that:
 *  (a) redirects unauthenticated users to `/login` preserving intended destination,
 *  (b) enforces an optional `requiredRole`,
 *  (c) enforces an optional `requiredModule` and `action` ('view' | 'update' | 'delete' | 'execute') via `useSecurity()`.
 *  When access is denied, renders `<ModuleDisabled>` in place instead of navigating away.
 */
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSecurity, type ActionType } from "../hooks/useSecurity";
import ModuleDisabled from "./ModuleDisabled";

export interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredModule?: string;
  action?: ActionType;
  /**
   * When true, unauthenticated users are allowed if the anon role has the
   * required capability on the module.
   */
  allowAnon?: boolean;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredModule,
  action = "view",
  allowAnon = false,
}: ProtectedRouteProps) {
  const { user, isAdmin, hasRole, isLoading: authLoading } = useAuth();
  const { can, isLoading: securityLoading } = useSecurity();
  const location = useLocation();

  if (authLoading || securityLoading) return null;

  if (!user && !allowAnon) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  if (requiredRole && !isAdmin && !hasRole(requiredRole)) {
    return <ModuleDisabled reason="role" required={requiredRole} />;
  }

  if (requiredModule && !isAdmin) {
    if (!can(requiredModule, action)) {
      return <ModuleDisabled reason="module" required={requiredModule} />;
    }
  }

  return <>{children}</>;
}
