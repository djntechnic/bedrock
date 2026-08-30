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
export declare const appSettings: {
    system: {
        appName: string;
    };
    logging: {
        level: string;
        disableConsoleInProd: boolean;
        redactKeys: string[];
    };
    grid: {
        tooltipDelayDuration: number;
    };
    shortcuts: {
        enabled: boolean;
        helpKey: string;
        sequenceTimeoutMs: number;
    };
};
