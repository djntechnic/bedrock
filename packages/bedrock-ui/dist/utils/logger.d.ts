/**
 * @file logger.ts
 * @module frontend/src/utils
 * @description Pino client instance definition, pulling settings from appSettings.
 */
import pino from 'pino';
export declare const log: pino.Logger<never, boolean>;
