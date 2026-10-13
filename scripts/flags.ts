/**
 * Live-data build gate.
 *
 * A production bundle must run against real Supabase data, never the offline
 * placeholder credentials that local dev and Playwright use. This guard runs at
 * build time (see vite.config.ts) so a mock/local bundle can never be shipped
 * as if it were production.
 *
 * The only escape hatch is ALLOW_MOCK_PRODUCTION_BUILD=true, and that opt-out
 * is deliberately refused under CI so an automated pipeline can never silently
 * produce a mock build.
 */

// Core Supabase feature flags. In production every one of these must be on so
// the storefront reads live catalog/drops/cart/checkout/auth data rather than
// the local seed data used during development and tests.
const CORE_LIVE_DATA_FLAGS = [
  'VITE_USE_SUPABASE_CATALOG',
  'VITE_USE_SUPABASE_DROPS',
  'VITE_USE_SUPABASE_CART',
  'VITE_USE_SUPABASE_WISHLIST',
  'VITE_USE_SUPABASE_ORDERS',
  'VITE_USE_SUPABASE_CHECKOUT',
  'VITE_USE_SUPABASE_AUTH',
] as const;

// The offline placeholder Supabase coordinates used by src/lib/supabase.ts and
// scripts/playwright-server.ts. A production build that still carries these is
// pointed at nothing real, so it is rejected.
const PLACEHOLDER_SUPABASE_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_SUPABASE_ANON_KEY = 'placeholder-key';

export type EnvLike = Record<string, string | undefined>;

/**
 * Assert that the given environment is wired for live data in the given build
 * mode. Throws with a message naming the offending input(s) when a production
 * build would run against mock/local data. Non-production modes are never
 * gated: local dev and the test suite intentionally run fully offline.
 */
export function assertLiveDataFlags(env: EnvLike, mode: string): void {
  if (mode !== 'production') {
    return;
  }

  // Explicit mock-build opt-out. Refused under CI so an automated pipeline
  // cannot disable the live-data requirement; a human running a local
  // production build may still opt out.
  if (env.ALLOW_MOCK_PRODUCTION_BUILD === 'true') {
    if (env.CI === 'true') {
      throw new Error('the mock-build opt-out is not allowed in CI');
    }
    return;
  }

  const problems: string[] = [];

  for (const flag of CORE_LIVE_DATA_FLAGS) {
    if (env[flag] !== 'true') {
      problems.push(`${flag} must be "true" for a live-data production build`);
    }
  }

  const supabaseUrl = env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    problems.push('VITE_SUPABASE_URL is required for a live-data production build');
  } else if (supabaseUrl === PLACEHOLDER_SUPABASE_URL) {
    problems.push(`VITE_SUPABASE_URL is still the placeholder value (${PLACEHOLDER_SUPABASE_URL})`);
  }

  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) {
    problems.push('VITE_SUPABASE_ANON_KEY is required for a live-data production build');
  } else if (supabaseAnonKey === PLACEHOLDER_SUPABASE_ANON_KEY) {
    problems.push(`VITE_SUPABASE_ANON_KEY is still the placeholder value (${PLACEHOLDER_SUPABASE_ANON_KEY})`);
  }

  if (problems.length > 0) {
    throw new Error(
      `Refusing to build production against mock/local data:\n- ${problems.join('\n- ')}`
    );
  }
}
