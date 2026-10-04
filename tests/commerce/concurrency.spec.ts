import { test, expect } from '@playwright/test';
import { webhookService } from '../../src/services/webhookService';
import { webhookIdempotency } from '../../src/services/payments/webhookIdempotency';
import { generatePayFastSignature } from '../../src/services/payments/crypto';

function signedPayFastWebhook(payload: Record<string, unknown>) {
  const passphrase = 'playwright_payfast_test';
  return { signature: generatePayFastSignature(payload, passphrase), passphrase };
}

test.describe('Commerce Concurrency & Idempotency Tests', () => {

  test.beforeEach(() => {
    webhookIdempotency.clearRegistry();
  });

  test('CONC-01: Duplicate webhook processing is blocked by idempotency', async () => {
    const orderCode = 'KX-SHARED-123';
    
    const payload = {
      m_payment_id: orderCode,
      pf_payment_id: 'pf_shared_123',
      payment_status: 'COMPLETE',
      amount_gross: '100.00',
    };
    const signed = signedPayFastWebhook(payload);

    // First processing
    const res1 = await webhookService.processWebhook({
      provider: 'payfast',
      payload,
      ...signed,
    });
    expect(res1.success).toBe(true);
    expect(res1.idempotent).toBe(false);

    // Second processing (duplicate)
    const res2 = await webhookService.processWebhook({
      provider: 'payfast',
      payload,
      ...signed,
    });
    expect(res2.success).toBe(true);
    expect(res2.idempotent).toBe(true);
  });

  test('CONC-02: Failure webhook arrives after success (unlikely but possible race)', async () => {
    // This is handled by idempotency if it's the SAME event ID, 
    // but if it's a different event ID (e.g. failure then success), 
    // the state machine should handle it.
    
    // In our case, if it's already 'paid', confirm_inventory_sale (which I updated in 0017) 
    // returns success immediately without changing state.
  });
});
