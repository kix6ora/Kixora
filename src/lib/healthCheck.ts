import type { RequestHandler } from 'express';
import { logger } from '../../logger';
import { getEnvConfig, getServerConfig, validateProductionEnv } from '../config/env';
import { isSupabaseConfigured } from './supabase';
import { getSupabaseAdmin } from './supabaseAdmin';

function getDomainLabel(): string {
  return process.env.RENDER_SERVICE_NAME ||
    (process.env.NODE_ENV === 'production' ? 'kixora-production' : 'kixora-development');
}

function getCommitLabel(): string {
  return process.env.RENDER_GIT_COMMIT?.slice(0, 7) || 'unknown';
}

function logDatabaseError(error: unknown) {
  const details = error && typeof error === 'object'
    ? error as { code?: unknown; message?: unknown }
    : {};

  logger.error('[Health Check] Database ping failed', {
    code: typeof details.code === 'string' ? details.code : undefined,
    message: typeof details.message === 'string' ? details.message : 'Unknown error',
  });
}

/**
 * Liveness probe: always 200 while the process is alive.
 * Must not call Supabase or any other dependency.
 */
export const livenessCheck: RequestHandler = (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
};

type DependencyStatus = 'healthy' | 'unhealthy' | 'not_configured';

/**
 * Readiness probe: owns the Supabase dependency check.
 * Returns 503 when degraded, 200 when ready.
 */
export const readinessCheck: RequestHandler = async (_req, res) => {
  let database: DependencyStatus = 'not_configured';
  let supabase: DependencyStatus = 'not_configured';

  if (isSupabaseConfigured()) {
    try {
      const { error } = await getSupabaseAdmin().from('profiles').select('id').limit(1);
      database = error ? 'unhealthy' : 'healthy';
      supabase = error ? 'unhealthy' : 'healthy';
      if (error) logDatabaseError(error);
    } catch (error: unknown) {
      logDatabaseError(error);
      database = 'unhealthy';
      supabase = 'unhealthy';
    }
  }

  const configuration = validateProductionEnv();
  const dependenciesReady = database === 'healthy' || database === 'not_configured';
  const ready = dependenciesReady && configuration.valid;
  const paymentProvider = getEnvConfig().paymentProviderMode;
  const serverConfig = getServerConfig();

  const body = {
    status: ready ? 'ready' : 'degraded',
    domain: getDomainLabel(),
    commit: getCommitLabel(),
    timestamp: new Date().toISOString(),
    checks: {
      database,
      supabase,
      configuration: configuration.valid,
      paymentProvider,
      payfastWebhookConfigured: Boolean(serverConfig.payfastPassphrase),
      shippingWebhookConfigured: Boolean(serverConfig.shippingWebhookSecret),
    },
  };

  if (!ready) {
    return res.status(503).json(body);
  }

  return res.json(body);
};

/** @deprecated Use livenessCheck for /api/health and readinessCheck for /api/ready. */
export const healthCheck = livenessCheck;
