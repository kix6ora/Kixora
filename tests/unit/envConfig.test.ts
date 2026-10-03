import { afterEach, describe, expect, it } from 'vitest';
import { getPublicSiteUrl, validateProductionEnv } from '../../src/config/env';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

const payfastBase = () => ({
  NODE_ENV: 'production',
  VITE_PAYMENT_PROVIDER_MODE: 'payfast',
  VITE_PUBLIC_SITE_URL: 'https://kixora-staging.onrender.com',
  VITE_PAYFAST_MERCHANT_ID: '100001',
  VITE_PAYFAST_MERCHANT_KEY: 'merchant-key',
  PAYFAST_PASSPHRASE: 'strong-passphrase',
  ADMIN_ORIGIN: 'https://admin.kixora.com',
  CUSTOMER_ORIGIN: 'https://kixora.com',
  CORS_ALLOWED_ORIGINS: 'https://admin.kixora.com,https://kixora.com',
});

const applyEnv = (patch: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};

describe('validateProductionEnv', () => {
  it('accepts the PayFast production contract when all required origins are present', () => {
    applyEnv(payfastBase());
    expect(validateProductionEnv().valid).toBe(true);
  });

  it('rejects empty or wildcard CORS configuration in production', () => {
    applyEnv({ ...payfastBase(), CORS_ALLOWED_ORIGINS: '*' });
    const result = validateProductionEnv();
    expect(result.valid).toBe(false);
    expect(result.errors.some((item) => item.includes('CORS_ALLOWED_ORIGINS'))).toBe(true);
  });

  it('skips strict validation when NODE_ENV is not production', () => {
    applyEnv({ ...payfastBase(), NODE_ENV: 'development' });
    const result = validateProductionEnv();
    expect(result.valid).toBe(true);
  });

  it('rejects unsupported payment providers instead of falling back to mock', () => {
    applyEnv({ ...payfastBase(), VITE_PAYMENT_PROVIDER_MODE: 'unconfigured' });
    expect(() => validateProductionEnv()).toThrow('Unsupported payment provider');
  });

  it('rejects when ADMIN_ORIGIN and CUSTOMER_ORIGIN are not distinct in production', () => {
    applyEnv({
      ...payfastBase(),
      ADMIN_ORIGIN: 'https://kixora.com',
      CUSTOMER_ORIGIN: 'https://kixora.com',
    });
    const result = validateProductionEnv();
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('distinct') || e.includes('ADMIN_ORIGIN') || e.includes('CUSTOMER_ORIGIN'))
    ).toBe(true);
  });

  it('rejects when an origin declared in CUSTOMER_ORIGIN is missing from CORS_ALLOWED_ORIGINS', () => {
    applyEnv({
      ...payfastBase(),
      CORS_ALLOWED_ORIGINS: 'https://admin.kixora.com',
    });
    const result = validateProductionEnv();
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('CORS_ALLOWED_ORIGINS') || e.includes('CUSTOMER_ORIGIN'))
    ).toBe(true);
  });

  it('rejects PayFast configuration when PAYFAST_PASSPHRASE is missing', () => {
    applyEnv({ ...payfastBase(), PAYFAST_PASSPHRASE: undefined });
    const result = validateProductionEnv();
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.includes('PAYFAST') || e.includes('PASSPHRASE') || e.includes('passphrase'))
    ).toBe(true);
  });

});

describe('getPublicSiteUrl', () => {
  it('normalizes the configured HTTPS site URL to its origin', () => {
    applyEnv({ VITE_PUBLIC_SITE_URL: 'https://kixora-staging.onrender.com/' });
    expect(getPublicSiteUrl()).toBe('https://kixora-staging.onrender.com');
  });

  it('rejects missing or non-origin public-site URLs', () => {
    applyEnv({ VITE_PUBLIC_SITE_URL: undefined });
    expect(() => getPublicSiteUrl()).toThrow(/VITE_PUBLIC_SITE_URL is required/);

    applyEnv({ VITE_PUBLIC_SITE_URL: 'https://kixora-staging.onrender.com/auth/confirm' });
    expect(() => getPublicSiteUrl()).toThrow(/HTTPS origin/);
  });

  it('requires HTTPS in production', () => {
    applyEnv({ ...payfastBase(), VITE_PUBLIC_SITE_URL: 'http://127.0.0.1:3000' });
    expect(() => getPublicSiteUrl()).toThrow(/HTTPS origin/);
  });
});
