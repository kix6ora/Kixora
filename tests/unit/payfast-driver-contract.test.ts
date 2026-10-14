import { afterEach, describe, expect, it, vi } from 'vitest';
import { PayFastPaymentDriver } from '../../src/services/payments/payfastDriver';

describe('PayFast driver contract', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('isConfigured() is false when merchant id and key are missing', () => {
    vi.stubEnv('VITE_PAYFAST_MERCHANT_ID', '');
    vi.stubEnv('VITE_PAYFAST_MERCHANT_KEY', '');
    expect(new PayFastPaymentDriver().isConfigured()).toBe(false);
  });

  it('isConfigured() is false when only one credential is set', () => {
    vi.stubEnv('VITE_PAYFAST_MERCHANT_ID', '10000100');
    vi.stubEnv('VITE_PAYFAST_MERCHANT_KEY', '');
    expect(new PayFastPaymentDriver().isConfigured()).toBe(false);
  });

  it('isConfigured() is true when both merchant id and key are set', () => {
    vi.stubEnv('VITE_PAYFAST_MERCHANT_ID', '10000100');
    vi.stubEnv('VITE_PAYFAST_MERCHANT_KEY', 'sandbox-test-key');
    expect(new PayFastPaymentDriver().isConfigured()).toBe(true);
  });
});
