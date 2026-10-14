/**
 * Kixora Monitoring & Error Reporting Service
 *
 * Runtime-agnostic facade. It owns PII sanitisation and delegates delivery to an
 * SDK-backed reporter registered by the entrypoint:
 *   - browser: src/lib/sentryBrowser.ts (@sentry/react)
 *   - server:  src/lib/sentryServer.ts  (@sentry/node)
 *
 * There is no HTTP call here. When no reporter is registered (SENTRY_DSN unset,
 * or tests) errors fall back to the structured console.
 */
import { sanitizeDataForLogging } from '../utils/security';

export interface ErrorContext {
  userId?: string;
  orderCode?: string;
  component?: string;
  action?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/** Minimal contract implemented by each Sentry SDK adapter. */
export interface ErrorReporter {
  captureException(error: unknown, context?: Record<string, unknown>): void;
}

let reporter: ErrorReporter | null = null;

/** Registers the active SDK reporter. Pass null to detach (tests). */
export function registerErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

export function isErrorReporterRegistered(): boolean {
  return reporter !== null;
}

class MonitoringService {
  private isProduction = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') || (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD);

  /**
   * Delivers an error to the registered SDK reporter. Returns false when no
   * reporter is attached, so the caller can fall back to the console.
   */
  private deliver(error: unknown, context: Record<string, unknown>): boolean {
    if (!reporter) return false;
    reporter.captureException(error, context);
    return true;
  }

  /**
   * Reports an error to the production monitoring system (abstraction).
   */
  public async reportError(error: Error | string, context: ErrorContext = {}): Promise<void> {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = error instanceof Error ? error.stack : undefined;

    const sanitizedContext = sanitizeDataForLogging(context);
    const sanitizedMessage = sanitizeDataForLogging(errorMessage);

    const payload = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: sanitizedMessage,
      context: sanitizedContext,
      stack: this.isProduction ? undefined : errorStack,
      environment: (typeof process !== 'undefined' && process.env?.NODE_ENV) || (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE) || 'development',
    };

    if (this.deliver(error instanceof Error ? error : new Error(errorMessage), {
      ...sanitizedContext,
      message: sanitizedMessage,
    })) {
      return;
    }

    // No SDK registered (SENTRY_DSN unset) — structured console only.
    if (this.isProduction) {
      console.error('[PRODUCTION-MONITORING]:', JSON.stringify(payload));
    } else {
      console.error('[DEV-MONITORING]:', payload);
    }
  }

  /**
   * Reports a non-critical warning.
   */
  public reportWarning(message: string, context: ErrorContext = {}): void {
    const sanitizedContext = sanitizeDataForLogging(context);
    const sanitizedMessage = sanitizeDataForLogging(message);

    const payload = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message: sanitizedMessage,
      context: sanitizedContext,
    };

    if (this.isProduction) {
      console.warn('[PRODUCTION-MONITORING]:', JSON.stringify(payload));
    } else {
      console.warn('[DEV-MONITORING]:', payload);
    }
  }
}

export const monitoringService = new MonitoringService();
