/**
 * @file logger.ts
 * @module frontend/src/utils
 * @description Pino client instance definition, pulling settings from appSettings.
 */
import pino from 'pino';
import { appSettings } from '../config';

const isProduction = import.meta.env.PROD;

export const log = pino({
  // Dynamically set the logging threshold from settings
  level: appSettings.logging.level,
  
  // Format numeric levels into readable string tags (e.g. 30 -> INFO)
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  
  browser: {
    // Objects are what a log *shipper* consumes; formatted text is what a human
    // at a dev server reads. This condition was the other way round — inverted
    // relative to the comment that documented it — so every development log line
    // arrived as `{level: 30, time: 1755…, msg: "…"}` and the message was the
    // one part you could not read at a glance. Consumers' real warnings drowned
    // in it, which is how it was found.
    asObject: isProduction,
    disabled: isProduction && appSettings.logging.disableConsoleInProd,
  },
  
  // Strip sensitive fields completely before outputting strings
  redact: appSettings.logging.redactKeys
});

