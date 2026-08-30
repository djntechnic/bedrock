/**
 * @file navRegistry.ts
 * @module frontend/src/components
 * @description Extension point for the application's primary navigation tree.
 *
 * `<AppSidebar>` owns the *shell* — the icon rail, expand/collapse behaviour,
 * active-route matching, section disclosure state, the §5.9 module gating that
 * hides an entry when `useModules().hasModule()` is false, and the role gating
 * in {@link isNavItemVisible}. It owns none of the *content*: the actual routes
 * are pure application knowledge, so the host app registers them here at boot.
 *
 * Registration is a module side-effect (see `main.tsx`). Reading happens
 * during render, after registration, so the sidebar always sees a complete
 * tree.
 */
import type { ComponentType } from "react";
import type { ActionType } from "../hooks/useSecurity";
/** A leaf destination nested under a top-level nav entry. */
export interface SubItem {
    to: string;
    label: string;
    tooltip?: string;
    module?: string;
    action?: ActionType;
    role?: string;
    exact?: boolean;
    sort_order?: number;
}
/** A labelled cluster of {@link SubItem}s inside a top-level entry. */
export interface SubGroup {
    label: string;
    items: SubItem[];
}
/** A top-level entry in the primary navigation rail. */
export interface NavItem {
    to: string;
    icon: ComponentType<{
        className?: string;
    }>;
    label: string;
    tooltip?: string;
    /** Match the route exactly rather than by prefix (used for "/"). */
    exact?: boolean;
    children?: SubItem[];
    groups?: SubGroup[];
    /** Phase 5.9 — module slug this nav entry requires. */
    module?: string;
    action?: ActionType;
    sort_order?: number;
    /**
     * Role slug this nav entry requires. Below it, the entry is not rendered at
     * all — an admin-only destination should not advertise itself.
     *
     * Deliberately separate from {@link NavItem.module}: `module` also drives the
     * *disabled* rendering via `hasModule()`, so an app that gates by role but
     * seeds no module registry would otherwise get a permanently greyed-out
     * entry. Set both only when both are true.
     *
     * Mirror the guard `<ProtectedRoute requiredRole>` applies to the route
     * itself. This hides the link; it is not the access control.
     */
    role?: string;
}
/**
 * The role/auth half of nav gating, factored out of `<AppSidebar>` so it can be
 * reasoned about — and tested — without a router, a query client and an auth
 * provider.
 *
 * @param item - The entry being considered.
 * @param auth - The three facts `useAuth()` exposes about the caller.
 * @returns False when the entry must not be rendered at all.
 */
export declare function isNavItemVisible(item: NavItem, auth: {
    user: unknown;
    isAdmin: boolean;
    hasRole: (slug: string) => boolean;
}): boolean;
/**
 * Registers the application's navigation tree, replacing any previous
 * registration.
 *
 * @param navItems - Top-level entries, in render order.
 */
export declare function registerNavItems(navItems: NavItem[]): void;
/** @returns The registered navigation tree (empty when nothing registered). */
export declare function getNavItems(): NavItem[];
/** Test helper: drops the registration. Not used by application code. */
export declare function __clearNavItems(): void;
