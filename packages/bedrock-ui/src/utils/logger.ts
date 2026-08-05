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
    // CRITICAL: When running locally, set asObject to false.
    // This tells Pino to output clean plain text strings to the console window.
    asObject: !isProduction, 
    disabled: isProduction && appSettings.logging.disableConsoleInProd,
  },
  
  // Strip sensitive fields completely before outputting strings
  redact: appSettings.logging.redactKeys
});

