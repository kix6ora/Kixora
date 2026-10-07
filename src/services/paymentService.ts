// ==============================================================================
// KIXORA PAYMENT ABSTRACTION SERVICE (Phase 3A & 3B)
// Orchestrates payment intent initialization, verification, webhooks, and refunds
// across concrete payment gateway drivers (PayFast and Mock).
// ==============================================================================

import { getEnvConfig } from '../config/env';
import {
  getPaymentDriver,
  getActivePaymentDriver,
  PaymentProviderType,
  PaymentStatus,
  PaymentIntentResponse,
  PaymentVerificationResponse,
  PaymentWebhookResponse,
  RefundResponse
} from './payments';

export type { PaymentProviderType, PaymentStatus };

export interface PaymentIntentInput {
  amount: number;
  currency?: string;
  orderCode: string;
  customerEmail: string;
  customerName?: string;
  metadata?: Record<string, any>;
  provider?: PaymentProviderType;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentIntentResult {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  redirectUrl?: string;
  status: PaymentStatus;
  provider: string;
  publishableKey?: string;
  gatewayData?: Record<string, any>;
  error?: string;
  errorCode?: string;
}

export interface PaymentVerificationResult {
  success: boolean;
  status: PaymentStatus;
  transactionId?: string;
  amountPaid?: number;
  error?: string;
}

export interface PaymentWebhookResult {
  success: boolean;
  event: string;
  orderCode?: string;
  paymentIntentId?: string;
  newStatus?: PaymentStatus;
  error?: string;
}

export interface PaymentRefundResult {
  success: boolean;
  refundId?: string;
  amountRefunded?: number;
  status: PaymentStatus;
  error?: string;
}

export const paymentService = {
  /**
   * Initialize a payment intent with the active or specified gateway driver.
   */
  async initializePayment(input: PaymentIntentInput, providerOverride?: PaymentProviderType): Promise<PaymentIntentResult> {
    const config = getEnvConfig();
    const provider = providerOverride || input.provider || config.paymentProviderMode;

    if (!input.amount || input.amount <= 0) {
      return {
        success: false,
        status: 'failed',
        provider,
        error: 'Invalid payment amount specified for intent initialization.',
        errorCode: 'INVALID_AMOUNT'
      };
    }

    try {
      const driver = getPaymentDriver(provider);
      const res: PaymentIntentResponse = await driver.createPaymentIntent({
        amount: input.amount,
        currency: input.currency || 'ZAR',
        orderCode: input.orderCode,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        returnUrl: input.returnUrl,
        cancelUrl: input.cancelUrl,
        metadata: input.metadata
      });

      return {
        success: res.success,
        paymentIntentId: res.paymentIntentId,
        clientSecret: res.clientSecret,
        redirectUrl: res.redirectUrl,
        status: res.status,
        provider: res.provider,
        publishableKey: res.publishableKey,
        gatewayData: res.gatewayData,
        error: res.error,
        errorCode: res.errorCode
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        provider,
        error: err.message || 'Payment intent initialization failed.',
        errorCode: 'GATEWAY_ERROR'
      };
    }
  },

  /**
   * Verify payment status securely via gateway API or driver verification.
   */
  async verifyPayment(paymentIntentId: string, provider?: PaymentProviderType): Promise<PaymentVerificationResult> {
    if (!paymentIntentId) {
      return {
        success: false,
        status: 'failed',
        error: 'Payment intent ID is required for verification.'
      };
    }

    try {
      const driver = getPaymentDriver(provider);
      const res: PaymentVerificationResponse = await driver.verifyPayment({
        paymentIntentId
      });

      return {
        success: res.success,
        status: res.status,
        transactionId: res.transactionId,
        amountPaid: res.amountPaid,
        error: res.error
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        error: err.message || 'Payment verification failed.'
      };
    }
  },

  /**
   * Handle incoming gateway webhook events securely.
   */
  async handlePaymentWebhook(payload: any, signature?: string, provider?: PaymentProviderType): Promise<PaymentWebhookResult> {
    if (!payload) {
      return {
        success: false,
        event: 'unknown',
        error: 'Invalid webhook payload structure.'
      };
    }

    try {
      const driver = getPaymentDriver(provider);
      const res: PaymentWebhookResponse = await driver.handleWebhook({
        provider: provider || driver.provider,
        payload,
        signature
      });

      return {
        success: res.success,
        event: res.event,
        orderCode: res.orderCode,
        paymentIntentId: res.paymentIntentId,
        newStatus: res.newStatus,
        error: res.error
      };
    } catch (err: any) {
      return {
        success: false,
        event: 'error',
        error: err.message || 'Webhook processing failed.'
      };
    }
  },

  /**
   * Request a refund for an order via the payment gateway driver.
   */
  async refundPayment(orderId: string, amount?: number, provider?: PaymentProviderType): Promise<PaymentRefundResult> {
    if (!orderId) {
      return {
        success: false,
        status: 'paid',
        error: 'Order ID is required to process refund.'
      };
    }

    try {
      const driver = getPaymentDriver(provider);
      const res: RefundResponse = await driver.processRefund({
        orderId,
        amount
      });

      return {
        success: res.success,
        refundId: res.refundId,
        amountRefunded: res.amountRefunded,
        status: res.status,
        error: res.error
      };
    } catch (err: any) {
      return {
        success: false,
        status: 'paid',
        error: err.message || 'Refund processing failed.'
      };
    }
  },

  /**
   * Get active gateway information.
   */
  getActiveGatewayInfo(): { provider: PaymentProviderType; isConfigured: boolean } {
    const driver = getActivePaymentDriver();
    return {
      provider: driver.provider,
      isConfigured: driver.isConfigured()
    };
  }
};
