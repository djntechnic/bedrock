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
import { type ShortcutsConfig } from "../types/grid";
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
export declare function isMacPlatform(): boolean;
/** Display label for the primary command modifier on the active platform. */
export declare function primaryModifierLabel(): "Cmd" | "Ctrl";
/**
 * Merges partial preference overrides (user profile / DB config) onto the
 * canonical {@link DEFAULT_SHORTCUTS_CONFIG} fallback boundary. Undefined fields
 * fall through to the default so callers always receive a complete config.
 */
export declare function resolveShortcutsConfig(overrides?: Partial<ShortcutsConfig> | null): ShortcutsConfig;
/**
 * Builds the categorized shortcut matrix presented in the reference sheet. The
 * command modifier chip and the help key chip are derived from the platform and
 * the resolved config respectively, keeping the presentation layer decoupled
 * from hardcoded key strings.
 */
export declare function buildShortcutGroups(config?: ShortcutsConfig): ShortcutCategory[];
