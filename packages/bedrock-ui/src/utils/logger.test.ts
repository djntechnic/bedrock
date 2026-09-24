/**
 * @file logger.test.ts
 * @module frontend/src/utils
 * @description Coverage for the opt-in setLogLevel/getLogLevel controls on the shared Pino instance.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { log, setLogLevel, getLogLevel, type LogLevel } from './logger';
import { logger } from '../lib/logger';
import { appSettings } from '../config';

describe('logger level controls', () => {
  const originalLevel = getLogLevel();

  afterEach(() => {
    setLogLevel(originalLevel);
  });

  it('leaves default level unchanged', () => {
    expect(getLogLevel()).toBe(appSettings.logging.level);
  });

  it('setLogLevel("silent") suppresses all output', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    setLogLevel('silent');
    log.error('this should not be written');
    log.info('neither should this');

    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it('setLogLevel round-trips', () => {
    setLogLevel('debug');

    expect(getLogLevel()).toBe('debug');
    expect(log.level).toBe('debug');
  });

  it('lib/logger facade honors the level', () => {
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    setLogLevel('silent');
    logger.info('facade message suppressed');

    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it('rejects an unknown level only via the type system, not at runtime cast', () => {
    const validLevels: LogLevel[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
    expect(validLevels).toContain(getLogLevel());
  });
});
