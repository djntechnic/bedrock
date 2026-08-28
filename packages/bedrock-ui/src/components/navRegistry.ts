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
  /** Module slug this nav entry requires. */
  module?: string;
  /** Action capability required ('view' | 'update' | 'delete' | 'execute'). Defaults to 'view'. */
  action?: "view" | "update" | "delete" | "execute";
  /** Role slug this nav entry requires. */
  role?: string;
  /** Custom sort order index */
  sort_order?: number;
  /** Custom tooltip string */
  tooltip?: string;
  /** Force hide toggle */
  is_hidden?: boolean;
}

/**
 * The role/security half of nav gating, factored out of `<AppSidebar>` so it can be
 * reasoned about — and tested — without a router, a query client and an auth
 * provider.
 *
 * @param item - The entry being considered.
 * @param auth - The facts `useAuth()` exposes about the caller.
 * @param security - Optional security context with `can(module, action)`.
 * @returns False when the entry must not be rendered at all.
 */
export function isNavItemVisible(
  item: NavItem,
  auth: {
    user: unknown;
    isAdmin: boolean;
    hasRole: (slug: string) => boolean;
  },
  security?: {
    can: (module: string, action?: any) => boolean;
  },
): boolean {
  if (item.is_hidden) return false;

  // Granular security check: if module is specified and security provider is passed,
  // hide completely if caller lacks the required capability.
  if (item.module && security) {
    if (!security.can(item.module, item.action ?? "view")) {
      return false;
    }
  }

  // Admin module fallback check
  if (item.module === "admin" && (!auth.user || !auth.isAdmin)) return false;

  if (item.role) {
    if (!auth.user) return false;
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
