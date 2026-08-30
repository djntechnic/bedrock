/**
 * @file ProtectedRoute.tsx
 * @module frontend/src/components
 * @description Phase 5.6 + 5.9 — route guard that (a) redirects unauthenticated
 *              users to `/login` preserving intended destination, (b) enforces
 *              an optional `requiredRole`, and (c) enforces an optional
 *              `requiredModule` via the P5.9 module registry. When the module
 *              is disabled the shared `<ModuleDisabled>` page renders in place
 *              instead of navigating away.
 */
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useModules } from "../hooks/useModules";
import ModuleDisabled from "./ModuleDisabled";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredModule?: string;
  /**
   * When true, unauthenticated users are allowed if the anon role has the
   * required module. Used for otherwise-public pages that still respect
   * module toggles (players, leaderboards, etc.).
   */
  allowAnon?: boolean;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredModule,
  allowAnon = false,
}: ProtectedRouteProps) {
  const { user, isAdmin, hasRole, isLoading: authLoading } = useAuth();
  const { hasModule, isLoading: modulesLoading } = useModules();
  const location = useLocation();

  if (authLoading) return null;

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
    if (modulesLoading) return null;
    if (!hasModule(requiredModule)) {
      return <ModuleDisabled reason="module" required={requiredModule} />;
    }
  }

  return <>{children}</>;
}
