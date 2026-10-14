import * as Sentry from '@sentry/node';
import { getObservabilityConfig } from '../config/env';
import { registerErrorReporter } from '../services/monitoringService';

let initialized = false;

/**
 * Initialises the server Sentry SDK and registers it as the error reporter for
 * monitoringService. Returns false (and does nothing) when SENTRY_DSN is not
 * configured, so local dev and tests stay silent.
 *
 * This module must only be imported from the Node entrypoint (server.ts). It is
 * never part of the Vite client graph.
 */
export function initSentry(): boolean {
  if (initialized) return true;

  const { sentryDsn, environment } = getObservabilityConfig();
  if (!sentryDsn) return false;

  Sentry.init({
    dsn: sentryDsn,
    environment,
    tracesSampleRate: 0,
  });

  registerErrorReporter({
    captureException: (error, context) => {
      Sentry.captureException(error, context ? { extra: context } : undefined);
    },
  });

  initialized = true;
  return true;
}

/** Flushes buffered events before process exit. Safe to call when disabled. */
export async function flushSentry(timeoutMs = 2000): Promise<boolean> {
  if (!initialized) return true;
  return Sentry.flush(timeoutMs);
}
