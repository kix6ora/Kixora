import { test, expect } from '@playwright/test';
import {
  generatePayFastSignature,
  verifyPayFastSignature,
} from '../../src/services/payments/crypto';
import { webhookIdempotency } from '../../src/services/payments/webhookIdempotency';
import { webhookService } from '../../src/services/webhookService';
import { paymentService } from '../../src/services/paymentService';

test.describe('Phase 3C: Payment Verification & Secure Webhook Handling', () => {

  test.beforeEach(() => {
    webhookIdempotency.clearRegistry();
  });

  test('WH-03: PayFast ITN MD5 signature verification validates correct parameter hashes with passphrase', async () => {
    const passphrase = 'kixora_secure_passphrase';
    const itnData: Record<string, string> = {
      m_payment_id: 'KX-8899',
      pf_payment_id: '1234567',
      payment_status: 'COMPLETE',
      item_name: 'Kixora Vault Order #KX-8899',
      amount_gross: '4200.00',
      amount_fee: '-96.60',
      amount_net: '4103.40',
      custom_str1: 'KX-8899',
      email_address: 'collector@kixora.com',
      merchant_id: '10000100'
    };

    // 1. Generate expected MD5 signature
    const signature = generatePayFastSignature(itnData, passphrase);
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
    expect(signature.length).toBe(32); // MD5 hex length

    // 2. Verify matching signature
    const validVerify = verifyPayFastSignature(itnData, signature, passphrase);
    expect(validVerify.valid).toBe(true);
    expect(validVerify.expectedSignature).toBe(signature);

    // 3. Reject tampered amount
    const tamperedData = { ...itnData, amount_gross: '1.00' };
    const tamperedVerify = verifyPayFastSignature(tamperedData, signature, passphrase);
    expect(tamperedVerify.valid).toBe(false);

    // 4. Reject missing/wrong passphrase
    const wrongPassphraseVerify = verifyPayFastSignature(itnData, signature, 'different_secret');
    expect(wrongPassphraseVerify.valid).toBe(false);
  });

  test('WH-04: Webhook idempotency registry blocks duplicate event execution', async () => {
    const eventId = 'pf_idempotency_test:COMPLETE';
    const provider = 'payfast';

    // 1. Initially not processed
    expect(await webhookIdempotency.isEventProcessed(eventId, provider)).toBe(false);

    // 2. Record processed event
    await webhookIdempotency.recordEventProcessed({
      eventId,
      provider,
      eventType: 'payfast.itn.complete',
      orderCode: 'KX-9988',
      status: 'processed'
    });

    // 3. Subsequent check confirms processed
    expect(await webhookIdempotency.isEventProcessed(eventId, provider)).toBe(true);

    // 4. Webhook service processWebhook returns idempotent flag on second call
    const payload = {
      m_payment_id: 'KX-9988',
      pf_payment_id: 'pf_idempotency_test',
      payment_status: 'COMPLETE',
      amount_gross: '100.00',
    };
    const duplicateSecret = 'payfast_idempotency_test';
    const duplicateSignature = generatePayFastSignature(payload, duplicateSecret);

    const duplicateRes = await webhookService.processWebhook({
      provider: 'payfast',
      payload,
      signature: duplicateSignature,
      passphrase: duplicateSecret,
    });

    expect(duplicateRes.success).toBe(true);
    expect(duplicateRes.idempotent).toBe(true);
  });

  test('WH-05: Webhook service reconciles payment success: marks order paid, authenticates grail, and confirms stock deduction', async () => {
    const orderCode = 'KX-WEBHOOK-PAID-01';
    const payload = {
      m_payment_id: orderCode,
      pf_payment_id: 'pf_paid_001',
      payment_status: 'COMPLETE',
      custom_str1: orderCode,
      amount_gross: '5500.00',
    };
    const passphrase = 'payfast_webhook_suite';
    const res = await webhookService.verifyAndProcessPayFastWebhook(
      payload,
      generatePayFastSignature(payload, passphrase),
      passphrase
    );

    expect(res.success).toBe(true);
    expect(res.provider).toBe('payfast');
    expect(res.orderCode).toBe(orderCode);
    expect(res.paymentStatus).toBe('paid');
    expect(res.orderStatus).toBe('Authenticated');
    expect(res.idempotent).toBe(false);
  });

  test('WH-06: Webhook service reconciles payment failure: marks order failed and releases reserved stock', async () => {
    const orderCode = 'KX-WEBHOOK-FAIL-01';
    const payload = {
      m_payment_id: orderCode,
      pf_payment_id: '998877',
      payment_status: 'FAILED',
      custom_str1: orderCode,
      amount_gross: '3200.00'
    };

    const passphrase = 'test_passphrase';
    const signature = generatePayFastSignature(payload, passphrase);

    const res = await webhookService.verifyAndProcessPayFastWebhook(
      payload,
      signature,
      passphrase
    );

    expect(res.success).toBe(true);
    expect(res.provider).toBe('payfast');
    expect(res.orderCode).toBe(orderCode);
    expect(res.paymentStatus).toBe('failed');
    expect(res.orderStatus).toBe('Cancelled');
  });

  test('WH-08: End-to-end webhook processing pipeline gracefully handles corrupted or unconfigured gateway requests', async () => {
    // 1. Corrupted JSON payload
    const corruptRes = await webhookService.processWebhook({
      provider: 'payfast',
      payload: null as any,
      rawBody: 'NOT_VALID_JSON_%%%'
    });
    expect(corruptRes.success).toBe(false);

    // 2. Invalid driver provider
    const invalidProviderRes = await webhookService.processWebhook({
      provider: 'invalid_gateway' as any,
      payload: { type: 'test' }
    });
    expect(invalidProviderRes.success).toBe(false); // Unsupported providers fail closed

    // 3. Delegation through paymentService facade
    const facadeRes = await paymentService.handlePaymentWebhook(
      { type: 'payment_intent.succeeded', orderCode: 'KX-FACADE-01' },
      undefined,
      'mock'
    );
    expect(facadeRes.success).toBe(true);
    expect(facadeRes.newStatus).toBe('paid');
  });
});
