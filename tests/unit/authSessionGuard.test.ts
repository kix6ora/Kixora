import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/features', () => ({
  isSupabaseAuthEnabled: () => false,
}));

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => false,
  supabase: { auth: {} },
}));

import { authService } from '../../src/services/authService';

const MOCK_KEY = 'kixora_auth_session';

describe('authService production session guard', () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevPlaywright = process.env.VITE_PLAYWRIGHT_ADMIN;

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevPlaywright === undefined) delete process.env.VITE_PLAYWRIGHT_ADMIN;
    else process.env.VITE_PLAYWRIGHT_ADMIN = prevPlaywright;
  });

  it('returns false for mock sessions when VITE_FORCE_PRODUCTION_AUTH is true even in test mode', async () => {
    vi.stubEnv('VITE_FORCE_PRODUCTION_AUTH', 'true');
    vi.stubEnv('VITE_PLAYWRIGHT_ADMIN', '');

    const forged = JSON.stringify({
      user: { id: 'attacker', email: 'attacker@example.test', role: 'admin' },
      accessToken: 'forged',
      refreshToken: null,
      expiresAt: null,
    });
    localStorage.setItem(MOCK_KEY, forged);

    const session = await authService.getSession();

    expect(session).toBeNull();
    expect(localStorage.getItem(MOCK_KEY)).toBeNull();
  });
});
