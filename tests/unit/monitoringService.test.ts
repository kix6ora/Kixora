import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isErrorReporterRegistered,
  monitoringService,
  registerErrorReporter,
} from '../../src/services/monitoringService';

afterEach(() => {
  registerErrorReporter(null);
  vi.restoreAllMocks();
});

describe('monitoringService error reporting', () => {
  it('routes errors to the registered SDK reporter', async () => {
    const captureException = vi.fn();
    registerErrorReporter({ captureException });
    expect(isErrorReporterRegistered()).toBe(true);

    const error = new Error('boom');
    await monitoringService.reportError(error, { component: 'checkout', action: 'init' });

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][0]).toBe(error);
    expect(captureException.mock.calls[0][1]).toMatchObject({
      component: 'checkout',
      action: 'init',
    });
  });

  it('normalises a string error into an Error before reporting', async () => {
    const captureException = vi.fn();
    registerErrorReporter({ captureException });

    await monitoringService.reportError('string failure');

    const reported = captureException.mock.calls[0][0] as Error;
    expect(reported).toBeInstanceOf(Error);
    expect(reported.message).toBe('string failure');
  });

  it('never posts to the DSN and falls back to console without a reporter', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(undefined as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await monitoringService.reportError(new Error('offline'), { component: 'test' });

    expect(isErrorReporterRegistered()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});