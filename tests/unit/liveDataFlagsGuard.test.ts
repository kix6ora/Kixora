import { describe, expect, it } from 'vitest';
import { assertLiveDataFlags } from '../../scripts/flags';

// A production bundle wired to live data: every core Supabase flag on and real
// (non-placeholder) credentials. Each test starts from this baseline and breaks
// exactly one thing.
const validProductionEnv = () => ({
  VITE_USE_SUPABASE_CATALOG: 'true',
  VITE_USE_SUPABASE_DROPS: 'true',
  VITE_USE_SUPABASE_CART: 'true',
  VITE_USE_SUPABASE_WISHLIST: 'true',
  VITE_USE_SUPABASE_ORDERS: 'true',
  VITE_USE_SUPABASE_CHECKOUT: 'true',
  VITE_USE_SUPABASE_AUTH: 'true',
  VITE_SUPABASE_URL: 'https://project.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'real-anon-key',
});

describe('assertLiveDataFlags', () => {
  it('throws in production when a core live-data flag is off, naming the flag', () => {
    const env = { ...validProductionEnv(), VITE_USE_SUPABASE_CATALOG: 'false' };
    expect(() => assertLiveDataFlags(env, 'production')).toThrow('VITE_USE_SUPABASE_CATALOG');
  });

  it('throws in production when VITE_SUPABASE_URL is missing, naming it', () => {
    const env = { ...validProductionEnv(), VITE_SUPABASE_URL: undefined };
    expect(() => assertLiveDataFlags(env, 'production')).toThrow('VITE_SUPABASE_URL');
  });

  it('throws in production when URL and key are the offline placeholders, naming both', () => {
    const env = {
      ...validProductionEnv(),
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'placeholder-key',
    };
    let message = '';
    try {
      assertLiveDataFlags(env, 'production');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('VITE_SUPABASE_URL');
    expect(message).toContain('VITE_SUPABASE_ANON_KEY');
  });

  it('does not throw in production when every live-data input is valid', () => {
    expect(() => assertLiveDataFlags(validProductionEnv(), 'production')).not.toThrow();
  });

  it('does not throw outside production even when every flag is off', () => {
    const env = {
      VITE_USE_SUPABASE_CATALOG: 'false',
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'placeholder-key',
    };
    expect(() => assertLiveDataFlags(env, 'development')).not.toThrow();
  });

  it('throws in production when the mock-build opt-out is combined with CI', () => {
    const env = {
      ...validProductionEnv(),
      ALLOW_MOCK_PRODUCTION_BUILD: 'true',
      CI: 'true',
    };
    expect(() => assertLiveDataFlags(env, 'production')).toThrow(
      /the mock-build opt-out is not allowed in CI/
    );
  });
});
