import { test, expect } from '@playwright/test';
import { generatePayFastSignature } from '../../src/services/payments/crypto';
import { getPaymentDriver, getActivePaymentDriver } from '../../src/services/payments';
import { MockPaymentDriver } from '../../src/services/payments/mockDriver';
import { PayFastPaymentDriver } from '../../src/services/payments/payfastDriver';
import { paymentService } from '../../src/services/paymentService';

test.describe('Phase 3B: Real Payment Gateway Integration & Drivers', () => {

  test('PG-01: Gateway driver factory resolves mock and PayFast drivers', async () => {
    const mockDriver = getPaymentDriver('mock');
    expect(mockDriver).toBeInstanceOf(MockPaymentDriver);
    expect(mockDriver.provider).toBe('mock');
    expect(mockDriver.isConfigured()).toBe(true);

    const payfastDriver = getPaymentDriver('payfast');
    expect(payfastDriver).toBeInstanceOf(PayFastPaymentDriver);
    expect(payfastDriver.provider).toBe('payfast');

    const activeDriver = getActivePaymentDriver();
    expect(activeDriver).toBeDefined();
    expect(['mock', 'payfast']).toContain(activeDriver.provider);
  });

  test('PG-03: PayFast driver refuses browser-side checkout initiation', async () => {
    const previousMerchantId = process.env.VITE_PAYFAST_MERCHANT_ID;
    const previousMerchantKey = process.env.VITE_PAYFAST_MERCHANT_KEY;
    process.env.VITE_PAYFAST_MERCHANT_ID = '10000100';
    process.env.VITE_PAYFAST_MERCHANT_KEY = 'sandbox-test-key';

    const payfastDriver = new PayFastPaymentDriver();

    try {
      const intent = await payfastDriver.createPaymentIntent({
        amount: 3200,
        currency: 'ZAR',
        orderCode: 'KXO-4412',
        customerEmail: 'kagiso.m@kixora.co.za',
        customerName: 'Kagiso Molefe',
      });

      expect(intent.success).toBe(false);
      expect(intent.provider).toBe('payfast');
      expect(intent.errorCode).toBe('PAYFAST_SERVER_INITIATION_REQUIRED');
    } finally {
      if (previousMerchantId === undefined) delete process.env.VITE_PAYFAST_MERCHANT_ID;
      else process.env.VITE_PAYFAST_MERCHANT_ID = previousMerchantId;
      if (previousMerchantKey === undefined) delete process.env.VITE_PAYFAST_MERCHANT_KEY;
      else process.env.VITE_PAYFAST_MERCHANT_KEY = previousMerchantKey;
    }
  });

  test('PG-04: PayFast webhook / ITN parser transitions payment statuses correctly', async () => {
    const payfastDriver = new PayFastPaymentDriver();

    // 1. COMPLETE event
    const completePayload = {
      payment_status: 'COMPLETE',
      m_payment_id: 'KXO-5555',
      pf_payment_id: '12345678',
      amount_gross: '2500.00',
    };
    const completeRes = await payfastDriver.handleWebhook({
      provider: 'payfast',
      payload: completePayload,
      passphrase: 'phase4-test-passphrase',
      signature: generatePayFastSignature(completePayload, 'phase4-test-passphrase'),
    });

    expect(completeRes.success).toBe(true);
    expect(completeRes.newStatus).toBe('paid');
    expect(completeRes.orderCode).toBe('KXO-5555');

    // 2. FAILED event
    const failedPayload = {
      payment_status: 'FAILED',
      m_payment_id: 'KXO-5555',
      pf_payment_id: '12345678',
    };
    const failedRes = await payfastDriver.handleWebhook({
      provider: 'payfast',
      payload: failedPayload,
      passphrase: 'phase4-test-passphrase',
      signature: generatePayFastSignature(failedPayload, 'phase4-test-passphrase'),
    });

    expect(failedRes.success).toBe(true);
    expect(failedRes.newStatus).toBe('failed');

    // 3. CANCELLED event
    const cancelledPayload = {
      payment_status: 'CANCELLED',
      m_payment_id: 'KXO-5555',
      pf_payment_id: '12345678',
    };
    const cancelledRes = await payfastDriver.handleWebhook({
      provider: 'payfast',
      payload: cancelledPayload,
      passphrase: 'phase4-test-passphrase',
      signature: generatePayFastSignature(cancelledPayload, 'phase4-test-passphrase'),
    });

    expect(cancelledRes.success).toBe(true);
    expect(cancelledRes.newStatus).toBe('cancelled');
  });

  test('PG-06: paymentService delegates to active driver and processes refunds', async () => {
    const result = await paymentService.initializePayment({
      amount: 5000,
      currency: 'ZAR',
      orderCode: 'KXO-1234',
      customerEmail: 'test@kixora.com'
    });

    expect(result.success).toBe(true);
    expect(result.paymentIntentId).toBeDefined();

    // Refund handling
    const refund = await paymentService.refundPayment('order-uuid-test', 5000);
    expect(refund.success).toBe(true);
    expect(refund.status).toBe('refunded');
  });

  test('PG-07: Client checkout flow executes cleanly with payment gateway integration', async ({ page }) => {
    await page.goto('/?domain=customer', { waitUntil: 'commit' });
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('kixora_auth_session', JSON.stringify({
        user: {
          id: 'customer-phase4',
          email: 'customer@kixora.test',
          role: 'customer',
          fullName: 'Phase 4 Customer',
          appMetadata: { role: 'customer' },
          userMetadata: { full_name: 'Phase 4 Customer' },
        },
        accessToken: 'mock_jwt_customer_phase4',
        expiresAt: Math.floor(Date.now() / 1000) + 86400,
      }));
    });
    await page.reload({ waitUntil: 'commit' });
    await page.waitForSelector('header', { state: 'visible' });
    await page.addStyleTag({
      content: '* { transition-duration: 0s !important; animation-duration: 0s !important; }',
    });

    // 1. Add product to cart (automatically opens cart drawer)
    const addBtn = page.locator('button[id^="add-to-cart-btn-"]').first();
    await expect(addBtn).toBeVisible();
    await addBtn.dispatchEvent('click');

    // 2. Click proceed to checkout in drawer
    const checkoutBtn = page.locator('#cart-proceed-checkout-btn');
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.dispatchEvent('click');
    await expect(page.locator('#cart-drawer-backdrop')).toHaveCount(0);

    // 3. Checkout modal is visible
    const modalBackdrop = page.locator('#checkout-modal-backdrop');
    await expect(modalBackdrop).toBeVisible();

    // 4. Fill Step 1 Shipping
    await page.locator('#checkout-fullname').fill('Mandla Dlamini');
    await page.locator('#checkout-email').fill('mandla@dlamini.co.za');
    await page.locator('#checkout-phone').fill('+27 83 123 4567');
    await page.locator('#checkout-street').fill('88 Bree Street');
    await page.locator('#checkout-city').fill('Cape Town');
    await page.locator('#checkout-zip').fill('8001');

    // 5. Continue to Step 2
    const step1Btn = page.locator('#checkout-step1-continue-btn');
    await step1Btn.dispatchEvent('click');

    // 6. Step 2: Payment options
    await expect(page.getByText('2. SECURE PAYMENT METHOD')).toBeVisible();

    // 7. Continue to Step 3
    const step2Btn = page.locator('#checkout-step2-continue-btn');
    await step2Btn.dispatchEvent('click');

    // 8. Step 3: Review & Place Order
    await expect(page.getByText('3. REVIEW & AUTHORIZATION')).toBeVisible();
    const confirmBtn = page.locator('#checkout-confirm-pay-btn');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.dispatchEvent('click');

    // 9. Step 4: Confirmation screen
    await expect(page.locator('#checkout-track-order-btn')).toBeVisible({ timeout: 10000 });
  });

});
