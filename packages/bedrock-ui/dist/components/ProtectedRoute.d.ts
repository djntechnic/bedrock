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
import { type ActionType } from "../hooks/useSecurity";
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
export default function ProtectedRoute({ children, requiredRole, requiredModule, action, allowAnon, }: ProtectedRouteProps): import("react").JSX.Element | null;
