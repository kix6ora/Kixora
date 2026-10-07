import { test, expect } from '@playwright/test';
import { validateProductionEnv } from '../../src/config/env';
import { PayFastPaymentDriver } from '../../src/services/payments/payfastDriver';
import { trackingWebhookService } from '../../src/services/shipping/trackingWebhookService';

const envKeys = [
  'NODE_ENV',
  'VITE_PAYMENT_PROVIDER_MODE',
  'VITE_PAYFAST_MERCHANT_ID',
  'VITE_PAYFAST_MERCHANT_KEY',
  'PAYFAST_PASSPHRASE',
  'SHIPPING_WEBHOOK_SECRET',
  'CORS_ALLOWED_ORIGINS',
] as const;

test.describe('Phase 2: Production Security Gates', () => {
  const originalEnv = new Map<string, string | undefined>();

  test.beforeEach(() => {
    for (const key of envKeys) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
    process.env.NODE_ENV = 'production';
  });

  test.afterEach(() => {
    for (const key of envKeys) {
      const value = originalEnv.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('rejects mock payment mode and keeps shipping deferred unless explicitly enabled', () => {
    const result = validateProductionEnv();
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('VITE_PAYMENT_PROVIDER_MODE must be payfast in production.');
    expect(result.errors).not.toContain('SHIPPING_WEBHOOK_SECRET is required when shipping is enabled.');
    expect(result.errors).toContain('CORS_ALLOWED_ORIGINS must contain explicit origins in production.');
  });

  test('accepts a complete PayFast production configuration', () => {
    Object.assign(process.env, {
      VITE_PAYMENT_PROVIDER_MODE: 'payfast',
      VITE_PAYFAST_MERCHANT_ID: '10000100',
      VITE_PAYFAST_MERCHANT_KEY: 'sandbox-test-key',
      PAYFAST_PASSPHRASE: 'phase4-test-passphrase',
      CUSTOMER_ORIGIN: 'https://kixora.com',
      ADMIN_ORIGIN: 'https://admin.kixora.com',
      CORS_ALLOWED_ORIGINS: 'https://kixora.com,https://admin.kixora.com',
    });

    expect(validateProductionEnv()).toEqual({ valid: true, errors: [] });
  });

  test('rejects unsigned PayFast and tracking webhooks', async () => {
    const payfast = await new PayFastPaymentDriver().handleWebhook({
      payload: { payment_status: 'COMPLETE', custom_str1: 'KX-TEST' },
    });
    expect(payfast.success).toBe(false);

    const tracking = await trackingWebhookService.verifyAndProcessTrackingWebhook({
      rawBody: JSON.stringify({ eventId: 'evt-unsigned', status: 'DELIVERED' }),
      secret: '',
    });
    expect(tracking.success).toBe(false);
  });
});
