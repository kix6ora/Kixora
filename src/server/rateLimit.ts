/**
 * Rate-limit policies and store mode.
 *
 * The limiters use express-rate-limit's default in-memory store, which is
 * correct only while a single Render instance serves traffic. `render.yaml`
 * pins `numInstances: 1`; see docs/adr/0002-rate-limit-store.md before scaling
 * out.
 */

export interface RateLimitPolicy {
  windowMs: number;
  max: number;
}

export const RATE_LIMIT_POLICIES = {
  api: { windowMs: 15 * 60 * 1000, max: 100 },
  auth: { windowMs: 60 * 60 * 1000, max: 10 },
  checkout: { windowMs: 60 * 60 * 1000, max: 5 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitStoreMode = 'memory' | 'shared';
export type RateLimitInstanceRequirement = 'single-required' | 'multi-ok';

export interface RateLimitStoreSummary {
  store: RateLimitStoreMode;
  instances: RateLimitInstanceRequirement;
}

/**
 * Operator-facing summary logged at startup. `single-required` means the
 * in-memory store is safe only while `numInstances: 1` is asserted in
 * render.yaml. A shared store is not implemented yet; when it is, this must
 * report `shared` / `multi-ok` and the ADR must be updated.
 */
export function rateLimitStoreSummary(): RateLimitStoreSummary {
  return { store: 'memory', instances: 'single-required' };
}
