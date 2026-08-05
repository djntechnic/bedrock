/**
 * @file shortcuts.ts
 * @module frontend/src/lib
 * @description Schema-driven definitions for the global keyboard shortcut
 * subsystem. The categorized binding matrix consumed by
 * {@link KeyboardShortcutsSheet} is built here from the centralized
 * {@link ShortcutsConfig} (never hardcoded inside layout files), so hotkeys,
 * sequence prefixes, and the help key all flow from runtime configuration with
 * graceful defaults.
 */

import { DEFAULT_SHORTCUTS_CONFIG, type ShortcutsConfig } from "../types/grid";

/** A single documented shortcut rendered as a labeled row of key chips. */
export interface ShortcutBinding {
  /** Stable identifier for telemetry + test selectors. */
  id: string;
  /** Human-readable description of what the shortcut does. */
  label: string;
  /**
   * Ordered key chips to display. A binding may expose alternate chords by
   * nesting arrays (e.g. `[["↑"], ["↓"]]` → "↑ / ↓"); a flat array is a single
   * chord (e.g. `["Cmd", "K"]`).
   */
  keys: (string | string[])[];
}

/** A titled section grouping related shortcuts in the reference sheet. */
export interface ShortcutCategory {
  /** Stable identifier for the section. */
  id: string;
  /** Section heading (e.g. "Navigation"). */
  title: string;
  bindings: ShortcutBinding[];
}

/**
 * True when the current platform is macOS — used to surface the Cmd glyph
 * instead of Ctrl. Guarded for non-browser (test/SSR) execution contexts.
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || "");
}

/** Display label for the primary command modifier on the active platform. */
export function primaryModifierLabel(): "Cmd" | "Ctrl" {
  return isMacPlatform() ? "Cmd" : "Ctrl";
}

/**
 * Merges partial preference overrides (user profile / DB config) onto the
 * canonical {@link DEFAULT_SHORTCUTS_CONFIG} fallback boundary. Undefined fields
 * fall through to the default so callers always receive a complete config.
 */
export function resolveShortcutsConfig(
  overrides?: Partial<ShortcutsConfig> | null
): ShortcutsConfig {
  return { ...DEFAULT_SHORTCUTS_CONFIG, ...(overrides ?? {}) };
}

/**
 * Builds the categorized shortcut matrix presented in the reference sheet. The
 * command modifier chip and the help key chip are derived from the platform and
 * the resolved config respectively, keeping the presentation layer decoupled
 * from hardcoded key strings.
 */
export function buildShortcutGroups(
  config: ShortcutsConfig = DEFAULT_SHORTCUTS_CONFIG
): ShortcutCategory[] {
  const mod = primaryModifierLabel();
  return [
    {
      id: "navigation",
      title: "Navigation",
      bindings: [
        { id: "search", label: "Global Search", keys: [[mod, "K"]] },
        { id: "goto-dashboard", label: "Dashboard", keys: [["G", "D"]] },
        { id: "goto-leaderboards", label: "Leaderboards", keys: [["G", "L"]] },
        { id: "goto-rankings", label: "Rankings", keys: [["G", "R"]] },
        { id: "goto-trends", label: "Trends", keys: [["G", "T"]] },
        { id: "goto-players", label: "Players", keys: [["G", "P"]] },
      ],
    },
    {
      id: "table-controls",
      title: "Table Controls",
      bindings: [
        { id: "row-nav", label: "Row Navigation", keys: [["↑"], ["↓"]] },
        { id: "row-exec", label: "Row Execution", keys: [["Enter"]] },
        { id: "close-panel", label: "Close Panel", keys: [["Esc"]] },
      ],
    },
    {
      id: "appearance",
      title: "Appearance System",
      bindings: [
        { id: "theme-toggle", label: "Theme Mutation", keys: [[mod, "Shift", "L"]] },
      ],
    },
    {
      id: "general",
      title: "General Utility",
      bindings: [
        { id: "help", label: "Help Matrix", keys: [[config.helpKey]] },
      ],
    },
  ];
}
