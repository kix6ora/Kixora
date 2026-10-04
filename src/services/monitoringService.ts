/**
 * Kixora Monitoring & Error Reporting Service
 */
import { sanitizeDataForLogging } from '../utils/security';
import { getObservabilityConfig } from '../config/env';

export interface ErrorContext {
  userId?: string;
  orderCode?: string;
  component?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

class MonitoringService {
  private isProduction = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') || (typeof import.meta !== 'undefined' && (import.meta as any).env?.PROD);

  private async dispatchToSentry(payload: Record<string, unknown>) {
    const { sentryDsn } = getObservabilityConfig();
    if (!sentryDsn) {
      return false;
    }

    try {
      await fetch(sentryDsn, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          environment: getObservabilityConfig().environment,
          ...payload,
        }),
      });
      return true;
    } catch {
      return false;
    }
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

    if (this.isProduction) {
      const sentrySent = await this.dispatchToSentry(payload);
      if (!sentrySent) {
        console.error('[PRODUCTION-MONITORING]:', JSON.stringify(payload));
      }
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
