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

vi.mock('../../logger', () => ({
  logger: { error: vi.fn() },
}));

import { logger } from '../../logger';
import { healthCheck } from '../../src/lib/healthCheck';

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

describe('health check endpoint', () => {
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

  it('uses the admin client ping and preserves the healthy response shape', async () => {
    const previousCommit = process.env.RENDER_GIT_COMMIT;
    process.env.RENDER_GIT_COMMIT = '1234567890abcdef';
    const response = createResponse();

    await healthCheck({} as never, response as never, vi.fn());

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      status: 'ok',
      commit: '1234567',
      domain: expect.any(String),
      timestamp: expect.any(String),
      uptime: expect.any(Number),
      checks: { database: 'healthy', supabase: 'healthy' },
    });
    if (previousCommit === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = previousCommit;
    expect(state.from).toHaveBeenCalledWith('profiles');
    expect(state.select).toHaveBeenCalledWith('id');
    expect(state.limit).toHaveBeenCalledWith(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns degraded health and logs only the database error code and message', async () => {
    state.error = { code: '42501', message: 'permission denied for table profiles' };
    const response = createResponse();

    await healthCheck({} as never, response as never, vi.fn());

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
});
