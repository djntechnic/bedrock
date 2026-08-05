/**
 * @file logger.ts
 * @module frontend/src/lib
 * @description Structured Pino-based frontend logger (re-export of the app logger).
 */
import { log } from '../utils/logger';

function debug(message: string, context?: Record<string, unknown>): void {
  log.debug(context ?? {}, message);
}

function info(message: string, context?: Record<string, unknown>): void {
  log.info(context ?? {}, message);
}

function warn(message: string, context?: Record<string, unknown>): void {
  log.warn(context ?? {}, message);
}

function error(message: string, context?: Record<string, unknown>): void {
  log.error(context ?? {}, message);
}

export const logger = { debug, info, warn, error };

