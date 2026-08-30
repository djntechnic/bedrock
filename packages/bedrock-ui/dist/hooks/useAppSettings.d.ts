export interface ResolvedAppSettings {
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
}
/**
 * React Query hook that returns the merged appSettings surface. Boot-time
 * env-var defaults are returned until the first fetch resolves, so consumers
 * never see undefined during the pre-hydration render.
 */
export declare function useAppSettings(): ResolvedAppSettings;
