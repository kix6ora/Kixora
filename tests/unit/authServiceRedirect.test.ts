import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
}));

vi.mock('../../src/config/features', () => ({
  isSupabaseAuthEnabled: () => true,
}));

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: { auth: { signUp: mocks.signUp } },
}));

import { authService } from '../../src/services/authService';

const originalPublicSiteUrl = process.env.VITE_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalPublicSiteUrl === undefined) delete process.env.VITE_PUBLIC_SITE_URL;
  else process.env.VITE_PUBLIC_SITE_URL = originalPublicSiteUrl;
  mocks.signUp.mockReset();
});

describe('authService signup redirect', () => {
  it('uses the configured public-site origin for confirmation emails', async () => {
    process.env.VITE_PUBLIC_SITE_URL = 'https://kixora-staging.onrender.com';
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const result = await authService.signUpCustomer({
      email: 'collector@example.test',
      password: 'test-only-password',
      fullName: 'Kixora Collector',
    });

    expect(result.error).toBeUndefined();
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'collector@example.test',
      password: 'test-only-password',
      options: {
        emailRedirectTo: 'https://kixora-staging.onrender.com',
        data: { full_name: 'Kixora Collector', phone: '' },
      },
    });
  });
});
