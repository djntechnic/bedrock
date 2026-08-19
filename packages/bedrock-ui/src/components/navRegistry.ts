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

/** A leaf destination nested under a top-level nav entry. */
export interface SubItem {
  to: string;
  label: string;
}

/** A labelled cluster of {@link SubItem}s inside a top-level entry. */
export interface SubGroup {
  label: string;
  items: SubItem[];
}

/** A top-level entry in the primary navigation rail. */
export interface NavItem {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  /** Match the route exactly rather than by prefix (used for "/"). */
  exact?: boolean;
  children?: SubItem[];
  groups?: SubGroup[];
  /** Phase 5.9 — module slug this nav entry requires. */
  module?: string;
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
export function isNavItemVisible(
  item: NavItem,
  auth: {
    user: unknown;
    isAdmin: boolean;
    hasRole: (slug: string) => boolean;
  },
): boolean {
  // Predates `role` and stays for the apps that rely on it: `module: "admin"`
  // has always meant "admins only" as well as "the admin module".
  if (item.module === "admin" && (!auth.user || !auth.isAdmin)) return false;

  if (item.role) {
    if (!auth.user) return false;
    // `isAdmin` short-circuits exactly as it does in `<ProtectedRoute>`, so a
    // superuser never loses a link to a role they were not explicitly granted.
    if (!auth.isAdmin && !auth.hasRole(item.role)) return false;
  }

  return true;
}

let items: NavItem[] = [];

/**
 * Registers the application's navigation tree, replacing any previous
 * registration.
 *
 * @param navItems - Top-level entries, in render order.
 */
export function registerNavItems(navItems: NavItem[]): void {
  items = navItems;
}

/** @returns The registered navigation tree (empty when nothing registered). */
export function getNavItems(): NavItem[] {
  return items;
}

/** Test helper: drops the registration. Not used by application code. */
export function __clearNavItems(): void {
  items = [];
}
