import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { inspectHostname } from '../../src/routes/DomainGuard';

const playwrightFlagEnv = { VITE_PLAYWRIGHT_ADMIN: 'true' } as const;

describe('DomainGuard VITE_PLAYWRIGHT_ADMIN bypass', () => {
  it('blocks ?domain=admin in a production build even with VITE_PLAYWRIGHT_ADMIN=true', () => {
    const result = inspectHostname('kixora.com', '?domain=admin', {
      ...playwrightFlagEnv,
      PROD: true,
    });

    expect(result.isAdminDomain).toBe(false);
    expect(result.isCustomerDomain).toBe(true);
  });

  it('honours VITE_PLAYWRIGHT_ADMIN + ?domain=admin outside production', () => {
    const result = inspectHostname('kixora.com', '?domain=admin', {
      ...playwrightFlagEnv,
      PROD: false,
    });

    expect(result.isAdminDomain).toBe(true);
    expect(result.isCustomerDomain).toBe(false);
  });
});
