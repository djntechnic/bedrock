/**
 * @file usePersistedDisclosure.ts
 * @module frontend/src/hooks
 * @description Small open/closed state hook backed by localStorage with structured
 *              Pino logging on every transition so a support engineer can retrace
 *              an admin's layout state from the log stream. Silent no-op fallback
 *              when localStorage is unavailable (SSR / private mode).
 */
/** Common namespace prefix — keeps keys grep-able in devtools. */
export declare const DISCLOSURE_KEY_PREFIX = "mlbtracker.gridEditor.";
/**
 * Returns a `[open, setOpen]` tuple. `key` is stored under
 * `mlbtracker.gridEditor.<key>` unless it already begins with the shared prefix.
 * Every state change emits a structured `log.info` for support/telemetry.
 */
export declare function usePersistedDisclosure(key: string, defaultOpen?: boolean): [boolean, (next: boolean) => void, () => void];
