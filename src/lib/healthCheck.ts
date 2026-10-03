import type { RequestHandler } from 'express';
import { logger } from '../../logger';
import { isSupabaseConfigured } from './supabase';
import { getSupabaseAdmin } from './supabaseAdmin';

function logDatabaseError(error: unknown) {
  const details = error && typeof error === 'object'
    ? error as { code?: unknown; message?: unknown }
    : {};

  logger.error('[Health Check] Database ping failed', {
    code: typeof details.code === 'string' ? details.code : undefined,
    message: typeof details.message === 'string' ? details.message : 'Unknown error',
  });
}

export const healthCheck: RequestHandler = async (_req, res) => {
  const health = {
    status: 'ok',
    domain: process.env.NODE_ENV === 'production' ? 'kixora-production' : 'kixora-development',
    commit: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || 'unknown',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: 'unknown',
      supabase: 'unknown',
    },
  };

  if (isSupabaseConfigured()) {
    try {
      const { error } = await getSupabaseAdmin().from('profiles').select('id').limit(1);
      health.checks.database = error ? 'unhealthy' : 'healthy';
      health.checks.supabase = error ? 'unhealthy' : 'healthy';
      if (error) logDatabaseError(error);
    } catch (error: unknown) {
      logDatabaseError(error);
      health.checks.database = 'unhealthy';
      health.checks.supabase = 'unhealthy';
    }
  } else {
    health.checks.database = 'not_configured';
    health.checks.supabase = 'not_configured';
  }

  const allHealthy = Object.values(health.checks).every(check =>
    check === 'healthy' || check === 'not_configured'
  );

  if (!allHealthy) {
    health.status = 'degraded';
    return res.status(503).json(health);
  }

  return res.json(health);
};
