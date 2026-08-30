/**
 * @file commandRoutes.ts
 * @module frontend/src/lib
 * @description Flat, static registry of every navigable destination in the app
 *              (top-level pages + query-param sub-views), consumed by the
 *              Cmd+K command palette. This is the source of truth that lets
 *              every route be reached in <=2 actions regardless of whether it
 *              also has a persistent-nav entry — routes with no sidebar link
 *              at all (e.g. `/health`, `/admin/approval-queue`) still need an
 *              entry here to stay reachable.
 */
import type { LucideIcon } from "lucide-react";
import type { ActionType } from "../hooks/useSecurity";

/** A single jump-to-destination entry surfaced in the command palette. */
export interface CommandRouteItem {
  /** Stable identity used for recent/pinned persistence — never reuse across entries. */
  id: string;
  /** Primary label shown in the palette list. */
  label: string;
  /** Group heading the item is rendered under. Free-form: the palette renders
   *  one section per distinct value, in first-seen order, so the set of groups
   *  is whatever the host application registers. */
  group: string;
  /** Destination path (may include a query string). */
  to: string;
  icon: LucideIcon;
  /** Module slug gating visibility, matching `useModules().hasModule()`. Omit for always-visible items. */
  module?: string;
  /** Capability action required on module (defaults to 'view') */
  action?: ActionType;
  /** Extra terms the fuzzy matcher should consider besides the label. */
  keywords?: string[];
}

let routes: CommandRouteItem[] = [];

/**
 * Registers the application's command-palette destinations, replacing any
 * previous registration.
 *
 * @param items - Palette entries, in display order.
 */
export function registerCommandRoutes(items: CommandRouteItem[]): void {
  routes = items;
}

/** @returns The registered destinations (empty when nothing registered). */
export function getCommandRoutes(): CommandRouteItem[] {
  return routes;
}

/** Test helper: drops the registration. Not used by application code. */
export function __clearCommandRoutes(): void {
  routes = [];
}
