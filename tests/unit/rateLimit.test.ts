import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_POLICIES, rateLimitStoreSummary } from '../../src/server/rateLimit';

describe('rate limit policies', () => {
  it('documents the shipped limits', () => {
    expect(RATE_LIMIT_POLICIES.api).toEqual({ windowMs: 15 * 60 * 1000, max: 100 });
    expect(RATE_LIMIT_POLICIES.auth).toEqual({ windowMs: 60 * 60 * 1000, max: 10 });
    expect(RATE_LIMIT_POLICIES.checkout).toEqual({ windowMs: 60 * 60 * 1000, max: 5 });
  });

  it('reports the in-memory store and the single-instance requirement', () => {
    expect(rateLimitStoreSummary()).toEqual({ store: 'memory', instances: 'single-required' });
  });
});
