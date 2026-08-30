/**
 * @file grid.ts
 * @module frontend/src/types
 * @description Shared configuration types for the unified, config-driven grid
 * header (GridHeader). These flags decouple presentation feature toggles from
 * component internals so that every data view derives its toolbar composition
 * from centralized runtime preferences (appSettings / app_grid_settings) rather
 * than ad-hoc local markup.
 */
/**
 * Feature flags and tuning constants that drive the standardized GridHeader.
 * Every property is resolved through {@link useGridConfig}, which merges the
 * admin/database grid settings with the {@link DEFAULT_GRID_HEADER_CONFIG}
 * fallback boundary (e.g. `tooltipDelayDuration ?? 150`).
 */
export interface GridHeaderConfig {
    /**
     * Latency (ms) before tooltips open. Bound into every TooltipProvider via
     * `delayDuration={config.tooltipDelayDuration ?? 150}`. Never hardcoded in a
     * layout component.
     */
    tooltipDelayDuration: number;
    /** Whether the header renders an inline search/filter input bound to the table. */
    showSearch: boolean;
    /** Whether the density (row height) toggle control is exposed. */
    showDensityToggle: boolean;
    /** Whether the column visibility toggle is exposed. */
    showColumnToggle: boolean;
    /** Whether the CSV export button is exposed. */
    showExportCsv: boolean;
    /** Whether the rank-highlight toggle is exposed (leaderboard-style views). */
    showRankHighlight: boolean;
}
/**
 * Canonical fallback used whenever a grid setting omits a header property. The
 * literal 150ms mirrors the historical hardcoded tooltip latency it replaces.
 */
export declare const DEFAULT_GRID_HEADER_CONFIG: GridHeaderConfig;
/**
 * Default tooltip latency gate. Exposed separately so components can express the
 * `config.tooltipDelayDuration ?? DEFAULT_TOOLTIP_DELAY` fallback contract
 * without importing the whole header config.
 */
export declare const DEFAULT_TOOLTIP_DELAY: number;
/**
 * Runtime tuning for the global keyboard shortcut manager. Every field is
 * resolved through {@link DEFAULT_SHORTCUTS_CONFIG} (which reads the centralized
 * {@link appSettings} matrix) merged with any user/DB preference overrides, so
 * layout components never hardcode a hotkey, sequence latency, or feature flag.
 */
export interface ShortcutsConfig {
    /** Master switch for the global keydown observer + shortcuts reference sheet. */
    shortcutsEnabled: boolean;
    /** Character that opens the shortcuts reference sheet (e.g. `?`). */
    helpKey: string;
    /**
     * Maximum latency (ms) between the two keystrokes of a chord sequence
     * (e.g. `G` then `D`) before the pending prefix is discarded.
     */
    sequenceTimeoutMs: number;
    /** Tooltip open latency (ms); shared with the grid header tuning gate. */
    tooltipDelayDuration: number;
}
/**
 * Canonical fallback for the shortcut manager. Mirrors the {@link appSettings}
 * shortcut matrix so a deployment can retune hotkeys via env/DB without touching
 * component code.
 */
export declare const DEFAULT_SHORTCUTS_CONFIG: ShortcutsConfig;
