/**
 * @file logger.ts
 * @module frontend/src/utils
 * @description Pino client instance definition, pulling settings from appSettings.
 */
import pino from 'pino';
export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
export declare const log: pino.Logger<never, boolean>;
/**
 * Opt-in runtime override of the shared logger's threshold. Consumers call this
 * from a test setup file (e.g. `setLogLevel("silent")`) — the platform default
 * stays `appSettings.logging.level` unless a caller explicitly changes it.
 */
export declare function setLogLevel(level: LogLevel): void;
export declare function getLogLevel(): LogLevel;
