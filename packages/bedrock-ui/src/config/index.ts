/**
 * @file index.ts
 * @module frontend/src/config
 * @description Boot-time defaults for the frontend appSettings surface.
 *
 * As of the app-config standardization work (see
 * scripts/maintenance/audit_config.py), the authoritative values live in
 * app_config_settings under the grid_/logging_/shortcuts_ categories and are
 * consumed via `useAppSettings()` (frontend/src/hooks/useAppSettings.ts).
 * The literals here remain as the pre-hydration fallback returned by that
 * hook before the first admin/config fetch resolves, and as the ultimate
 * source when the admin endpoint is unreachable. Env-var overrides
 * (VITE_APP_*) are respected for the same boot-critical values.
 */
export const appSettings = {
  system: {
    // Human-readable application name shown in the sidebar, footer, and browser
    // tab. Authoritative value lives in app_config_settings.system_app_name and
    // is delivered via useAppSettings(); this literal is only the boot-time
    // fallback before the first admin/config fetch resolves. Env var
    // VITE_APP_NAME overrides for boot-critical rendering.
    appName: (import.meta.env.VITE_APP_NAME as string) || 'MLBTracker',
  },
  logging: {
    // Falls back to safe parameters to guarantee layout efficiency
    level: (import.meta.env.VITE_APP_LOG_LEVEL as string) || 'info',
    // Safeguards against client-side browser terminal pollution in production environments
    disableConsoleInProd: import.meta.env.VITE_APP_DISABLE_CONSOLE_PROD === 'true',
    // Dynamic array filtering out credentials before strings map to the browser console
    redactKeys: ['password', 'secretToken', 'creditCard', 'hashedPassword']
  },
  grid: {
    // Centralized latency gate for all grid tooltip providers. Components must
    // read this (or the per-grid DB override surfaced by useGridConfig) rather
    // than hardcoding a delayDuration inline. Milliseconds.
    tooltipDelayDuration: Number(import.meta.env.VITE_APP_TOOLTIP_DELAY) || 150,
  },
  shortcuts: {
    // Master switch for the global keyboard shortcut manager. Disabling it stops
    // the window keydown observer from intercepting any hotkey and hides the
    // shortcuts reference sheet trigger. Read via resolveShortcutsConfig(); never
    // hardcode a boolean in a layout component.
    enabled: (import.meta.env.VITE_APP_SHORTCUTS_ENABLED ?? 'true') !== 'false',
    // Character that opens the keyboard shortcuts reference sheet. Configurable so
    // deployments can rebind the help key without editing layout files.
    helpKey: (import.meta.env.VITE_APP_SHORTCUTS_HELP_KEY as string) || '?',
    // Maximum latency (ms) between the two keys of a chord sequence (e.g. "G D")
    // before the pending prefix is discarded. Never hardcoded in the observer.
    sequenceTimeoutMs: Number(import.meta.env.VITE_APP_SHORTCUT_SEQUENCE_TIMEOUT) || 1000,
  }
};
