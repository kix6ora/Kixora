import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  error: null as { code: string; message: string } | null,
  thrown: null as Error | null,
  from: vi.fn(),
  select: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock('../../src/lib/supabaseAdmin', () => ({
  getSupabaseAdmin: () => ({ from: state.from }),
}));

vi.mock('../../src/config/env', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/config/env')>();
  return {
    ...actual,
    validateProductionEnv: () => ({ valid: true, errors: [] as string[] }),
  };
});

vi.mock('../../logger', () => ({
  logger: { error: vi.fn() },
}));

import { logger } from '../../logger';
import { livenessCheck, readinessCheck } from '../../src/lib/healthCheck';

function createResponse() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

describe('liveness check endpoint', () => {
  beforeEach(() => {
    state.error = null;
    state.thrown = null;
    state.from.mockReset().mockReturnValue({ select: state.select });
    state.select.mockReset().mockReturnValue({ limit: state.limit });
    state.limit.mockReset().mockImplementation(async () => {
      if (state.thrown) throw state.thrown;
      return { error: state.error };
    });
    vi.mocked(logger.error).mockClear();
  });

  it('returns 200 with a small body and no dependency checks', async () => {
    const response = createResponse();

    await livenessCheck({} as never, response as never, vi.fn());

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      uptime: expect.any(Number),
      timestamp: expect.any(String),
    });
    expect(state.from).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns 200 even when the Supabase check rejects', async () => {
    state.thrown = new Error('supabase is down');
    const response = createResponse();

    await livenessCheck({} as never, response as never, vi.fn());

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
    expect(state.from).not.toHaveBeenCalled();
  });

  it('returns 200 even when the Supabase check reports unhealthy', async () => {
    state.error = { code: '42501', message: 'permission denied for table profiles' };
    const response = createResponse();

    await livenessCheck({} as never, response as never, vi.fn());

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
    expect(state.from).not.toHaveBeenCalled();
  });

  it('exposes no secrets, urls or keys in the body', async () => {
    const response = createResponse();

    await livenessCheck({} as never, response as never, vi.fn());

    const serialized = JSON.stringify(response.body);
    expect(Object.keys(response.body as Record<string, unknown>).sort()).toEqual([
      'status',
      'timestamp',
      'uptime',
    ]);
    expect(serialized).not.toMatch(/key|secret|token|password|url|http/i);
  });
});

describe('readiness check endpoint', () => {
  beforeEach(() => {
    state.error = null;
    state.thrown = null;
    state.from.mockReset().mockReturnValue({ select: state.select });
    state.select.mockReset().mockReturnValue({ limit: state.limit });
    state.limit.mockReset().mockImplementation(async () => {
      if (state.thrown) throw state.thrown;
      return { error: state.error };
    });
    vi.mocked(logger.error).mockClear();
  });

  it('uses the admin client ping and preserves the deploy labels', async () => {
    const previousCommit = process.env.RENDER_GIT_COMMIT;
    const previousServiceName = process.env.RENDER_SERVICE_NAME;
    process.env.RENDER_GIT_COMMIT = '1234567890abcdef';
    process.env.RENDER_SERVICE_NAME = 'kixora-staging';
    const response = createResponse();

    await readinessCheck({} as never, response as never, vi.fn());

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ready',
      commit: '1234567',
      domain: 'kixora-staging',
      timestamp: expect.any(String),
      checks: { database: 'healthy', supabase: 'healthy' },
    });
    if (previousCommit === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = previousCommit;
    if (previousServiceName === undefined) delete process.env.RENDER_SERVICE_NAME;
    else process.env.RENDER_SERVICE_NAME = previousServiceName;
    expect(state.from).toHaveBeenCalledWith('profiles');
    expect(state.select).toHaveBeenCalledWith('id');
    expect(state.limit).toHaveBeenCalledWith(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns 503 when the Supabase check is unhealthy', async () => {
    state.error = { code: '42501', message: 'permission denied for table profiles' };
    const response = createResponse();

    await readinessCheck({} as never, response as never, vi.fn());

    expect(response.statusCode).toBe(503);
    expect(response.body).toMatchObject({
      status: 'degraded',
      checks: { database: 'unhealthy', supabase: 'unhealthy' },
    });
    expect(logger.error).toHaveBeenCalledWith('[Health Check] Database ping failed', {
      code: '42501',
      message: 'permission denied for table profiles',
    });
  });

  it('returns 503 when the Supabase check rejects', async () => {
    state.thrown = new Error('connection refused');
    const response = createResponse();

    await readinessCheck({} as never, response as never, vi.fn());

    expect(response.statusCode).toBe(503);
    expect(response.body).toMatchObject({ status: 'degraded' });
  });

  it('includes the active payment provider mode as a plain string', async () => {
    const response = createResponse();

    await readinessCheck({} as never, response as never, vi.fn());

    const body = response.body as { checks: { paymentProvider: unknown } };
    expect(['payfast', 'mock']).toContain(body.checks.paymentProvider);
  });

  it('exposes the webhook-configured flags as booleans', async () => {
    const response = createResponse();

    await readinessCheck({} as never, response as never, vi.fn());

    const body = response.body as {
      checks: { payfastWebhookConfigured: unknown; shippingWebhookConfigured: unknown };
    };
    expect(typeof body.checks.payfastWebhookConfigured).toBe('boolean');
    expect(typeof body.checks.shippingWebhookConfigured).toBe('boolean');
  });

  it('exposes no secrets, urls or keys in the body', async () => {
    const response = createResponse();

    await readinessCheck({} as never, response as never, vi.fn());

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(/passphrase|service_role|api[_-]?key|secret|token|http/i);
  });
});
