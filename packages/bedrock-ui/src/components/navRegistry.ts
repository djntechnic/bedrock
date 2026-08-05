/**
 * @file navRegistry.ts
 * @module frontend/src/components
 * @description Extension point for the application's primary navigation tree.
 *
 * `<AppSidebar>` owns the *shell* — the icon rail, expand/collapse behaviour,
 * active-route matching, section disclosure state, and the §5.9 module gating
 * that hides an entry when `useModules().hasModule()` is false. It owns none
 * of the *content*: the actual routes are pure application knowledge, so the
 * host app registers them here at boot.
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
