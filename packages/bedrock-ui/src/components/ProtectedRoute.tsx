/**
 * @file ProtectedRoute.tsx
 * @module frontend/src/components
 * @description Phase 5.6 + 5.9 — route guard that (a) redirects unauthenticated
 *              users to `/login` preserving intended destination, (b) enforces
 *              an optional `requiredRole`, and (c) enforces an optional
 *              `requiredModule` via the P5.9 module registry. When the module
 *              is disabled the shared `<ModuleDisabled>` page renders in place
 *              instead of navigating away. If module/security checks fail due
 *              to network or server errors, renders a retry affordance.
 */
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useModules } from "../hooks/useModules";
import { useSecurity, type ActionType } from "../hooks/useSecurity";
import ModuleDisabled from "./ModuleDisabled";
import { Button } from "./ui/button";

export interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
  requiredModule?: string;
  action?: ActionType;
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
  action,
  allowAnon = false,
}: ProtectedRouteProps) {
  const { user, isAdmin, hasRole, isLoading: authLoading } = useAuth();
  const {
    hasModule,
    isLoading: modulesLoading,
    isError: modulesError,
    refetch: refetchModules,
  } = useModules();
  const {
    can,
    isLoading: securityLoading,
    isError: securityError,
    refresh: refreshSecurity,
  } = useSecurity();
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
    if (modulesError || (action && securityError)) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertCircle className="h-7 w-7" aria-hidden />
            </div>
            <h1 className="text-2xl font-semibold">Unable to verify permissions</h1>
            <p className="text-muted-foreground text-sm">
              We encountered a network error while verifying access to this feature. Please check your connection and try again.
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (modulesError) refetchModules();
                  if (action && securityError) refreshSecurity();
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (modulesLoading) return null;
    if (!hasModule(requiredModule)) {
      return <ModuleDisabled reason="module" required={requiredModule} />;
    }
    if (action) {
      if (securityLoading) return null;
      if (!can(requiredModule, action)) {
        return <ModuleDisabled reason="role" required={`${requiredModule}:${action}`} />;
      }
    }
  }

  return <>{children}</>;
}
