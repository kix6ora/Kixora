import { afterEach, describe, expect, it } from 'vitest';
import { isMockAuthSessionAllowed } from '../../src/services/authService';

console.log(
  '[authMockSessionGate env]',
  JSON.stringify({
    PROD: process.env.PROD ?? null,
    NODE_ENV: process.env.NODE_ENV ?? null,
    VITE_FORCE_PRODUCTION_AUTH: process.env.VITE_FORCE_PRODUCTION_AUTH ?? null,
  }),
);

const prevProd = process.env.PROD;
const prevForceProdAuth = process.env.VITE_FORCE_PRODUCTION_AUTH;
const prevPlaywrightAdmin = process.env.VITE_PLAYWRIGHT_ADMIN;

afterEach(() => {
  if (prevProd === undefined) delete process.env.PROD;
  else process.env.PROD = prevProd;
  if (prevForceProdAuth === undefined) delete process.env.VITE_FORCE_PRODUCTION_AUTH;
  else process.env.VITE_FORCE_PRODUCTION_AUTH = prevForceProdAuth;
  if (prevPlaywrightAdmin === undefined) delete process.env.VITE_PLAYWRIGHT_ADMIN;
  else process.env.VITE_PLAYWRIGHT_ADMIN = prevPlaywrightAdmin;
});

describe('authService mock session gate', () => {
  it('blocks VITE_PLAYWRIGHT_ADMIN in a production build', () => {
    delete process.env.PROD;
    delete process.env.VITE_FORCE_PRODUCTION_AUTH;
    delete process.env.VITE_PLAYWRIGHT_ADMIN;
    expect(isMockAuthSessionAllowed({ VITE_PLAYWRIGHT_ADMIN: 'true', PROD: true })).toBe(false);
  });

  it('allows VITE_PLAYWRIGHT_ADMIN outside production', () => {
    delete process.env.PROD;
    delete process.env.VITE_FORCE_PRODUCTION_AUTH;
    delete process.env.VITE_PLAYWRIGHT_ADMIN;
    expect(isMockAuthSessionAllowed({ VITE_PLAYWRIGHT_ADMIN: 'true', PROD: false })).toBe(true);
  });
});
