import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '../../src/services/authService';
import { isSupabaseAuthEnabled } from '../../src/config/features';

const MOCK_KEY = 'kixora_auth_session';

// Guarantee: under Vitest, VITE_USE_SUPABASE_AUTH is unset, so
// parseBooleanEnv('VITE_USE_SUPABASE_AUTH', false) returns false and
// the Supabase branch in signUpCustomer() is never taken. The mock
// fallback path is therefore always reached. No vi.mock, no VITE_*
// stubs, no seam: authService is imported statically.
expect(isSupabaseAuthEnabled()).toBe(false);

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  localStorage.clear();
});

describe('authService signUpCustomer production guard', () => {
  it('refuses mock signup in production and writes nothing to localStorage', async () => {
    // Makes the exact signIn() production check true via process.env.
    vi.stubEnv('NODE_ENV', 'production');

    const result = await authService.signUpCustomer({
      email: 'prod-refusal@example.test',
      password: 'password123',
      fullName: 'Prod Refusal',
    });

    // Red-first visibility: show the actual return value in the log.
    console.log('[red-first] production signUpCustomer result:', JSON.stringify(result));
    console.log('[red-first] production localStorage:', localStorage.getItem(MOCK_KEY));

    expect(result.user).toBeNull();
    expect(result.session).toBeNull();
    expect(result.error).toBe('Authentication service unavailable. Please try again later.');
    expect(localStorage.getItem(MOCK_KEY)).toBeNull();
  });

  it('still writes the mock session outside production', async () => {
    // Non-production case depends only on NODE_ENV being 'test'
    // (Vitest default). It does not depend on PROD or any other value.
    vi.stubEnv('NODE_ENV', 'test');

    const result = await authService.signUpCustomer({
      email: 'local-collector@example.test',
      password: 'password123',
      fullName: 'Local Collector',
    });

    expect(result.error).toBeUndefined();
    expect(result.user?.role).toBe('customer');
    expect(result.session?.accessToken?.startsWith('mock_jwt_')).toBe(true);
    expect(localStorage.getItem(MOCK_KEY)).toBe(JSON.stringify(result.session));
  });
});
