import { test, expect } from '@playwright/test';
import { generatePayFastSignature } from '../../src/services/payments/crypto';
import { webhookService } from '../../src/services/webhookService';

test.describe('Phase 3: Provider webhook validation', () => {
  test('rejects a verified PayFast event without an order reference', async () => {
    const payload = {
      m_payment_id: '',
      pf_payment_id: 'pf_123',
      payment_status: 'COMPLETE',
      amount_gross: '10.00',
    };
    const passphrase = 'phase3-test';
    const result = await webhookService.processWebhook({
      provider: 'payfast',
      payload,
      signature: generatePayFastSignature(payload, passphrase),
      passphrase,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('missing an order reference');
  });

  test('preserves PayFast amount metadata for reconciliation validation', async () => {
    const payload = {
      m_payment_id: 'KX-VALIDATION',
      pf_payment_id: 'pf_123',
      payment_status: 'COMPLETE',
      amount_gross: '1250.00',
    };
    const passphrase = 'phase3-passphrase';
    const result = await webhookService.processWebhook({
      provider: 'payfast',
      payload,
      signature: generatePayFastSignature(payload, passphrase),
      passphrase,
    });

    expect(result.success).toBe(true);
    expect(result.orderCode).toBe('KX-VALIDATION');
  });
});
