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
import { type ActionType } from "../hooks/useSecurity";
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
export default function ProtectedRoute({ children, requiredRole, requiredModule, action, allowAnon, }: ProtectedRouteProps): import("react").JSX.Element | null;
