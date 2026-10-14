import * as Sentry from '@sentry/react';
import { getObservabilityConfig } from '../config/env';
import { registerErrorReporter } from '../services/monitoringService';

let initialized = false;

/**
 * Initialises the browser Sentry SDK and registers it as the error reporter for
 * monitoringService. Returns false (and does nothing) when SENTRY_DSN /
 * VITE_SENTRY_DSN is not configured, so local dev and tests stay silent.
 */
export function initSentry(): boolean {
  if (initialized) return true;

  const { sentryDsn, environment } = getObservabilityConfig();
  if (!sentryDsn) return false;

  Sentry.init({
    dsn: sentryDsn,
    environment,
    // Errors only for now. Add tracing in a dedicated task with an explicit rate.
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
