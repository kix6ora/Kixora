// ==============================================================================
// KIXORA PAYFAST PAYMENT GATEWAY DRIVER (Phase 3B)
// Production driver for PayFast (Instant EFT, Credit Cards, Masterpass, ZAR payments).
// ==============================================================================

import { getEnvConfig, getServerConfig } from '../../config/env';
import { verifyPayFastSignature } from './crypto';
import {
  PaymentGatewayDriver,
  PaymentProviderType,
  PaymentIntentRequest,
  PaymentIntentResponse,
  PaymentVerificationRequest,
  PaymentVerificationResponse,
  PaymentWebhookPayload,
  PaymentWebhookResponse,
  RefundRequest,
  RefundResponse
} from './types';

export class PayFastPaymentDriver implements PaymentGatewayDriver {
  readonly provider: PaymentProviderType = 'payfast';

  isConfigured(): boolean {
    const config = getEnvConfig();
    return !!config.payfastMerchantId && !!config.payfastMerchantKey;
  }

  getPassphrase(): string {
    const config = getServerConfig();
    return config.payfastPassphrase || '';
  }

  async createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntentResponse> {
    if (!request.amount || request.amount <= 0) {
      return {
        success: false,
        provider: this.provider,
        status: 'failed',
        error: 'Invalid payment amount specified for PayFast.',
        errorCode: 'INVALID_AMOUNT'
      };
    }

    return {
      success: false,
      provider: this.provider,
      status: 'failed',
      error: 'PayFast checkout must be initialized by the server.',
      errorCode: 'PAYFAST_SERVER_INITIATION_REQUIRED',
    };
  }

  async verifyPayment(request: PaymentVerificationRequest): Promise<PaymentVerificationResponse> {
    if (!request.paymentIntentId) {
      return {
        success: false,
        provider: this.provider,
        status: 'failed',
        error: 'PayFast payment ID is required for verification.'
      };
    }

    return {
      success: false,
      provider: this.provider,
      status: 'pending',
      transactionId: request.paymentIntentId,
      error: 'PayFast verification requires a verified ITN callback; no payment was confirmed.'
    };
  }

  async handleWebhook(payload: PaymentWebhookPayload): Promise<PaymentWebhookResponse> {
    let raw = payload.payload;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        // May be URL encoded key-value pairs
        const params = new URLSearchParams(raw);
        raw = Object.fromEntries(params.entries());
      }
    }

    if (!raw || typeof raw !== 'object') {
      return {
        success: false,
        event: 'unknown',
        error: 'Invalid PayFast ITN payload structure.'
      };
    }

    // 1. Signature Verification if signature provided in payload or wrapper, or passphrase configured
    const receivedSignature = payload.signature || raw.signature;
    const passphrase = payload.passphrase ?? this.getPassphrase();
    if (!passphrase || !passphrase.trim() || !receivedSignature) {
      return {
        success: false,
        event: 'payfast.itn.missing_signature',
        verified: false,
        error: 'Missing mandatory PayFast ITN verification configuration.'
      };
    }
    const verification = verifyPayFastSignature(raw, receivedSignature, passphrase);
    if (!verification.valid) {
      return {
        success: false,
        event: 'payfast.itn.invalid_signature',
        verified: false,
        error: verification.error || 'PayFast ITN signature mismatch.'
      };
    }

    const paymentStatus = (raw.payment_status || '').toUpperCase();
    const mPaymentId = raw.m_payment_id || '';
    const pfPaymentId = raw.pf_payment_id || '';

    const orderCode = mPaymentId;

    const gatewayMetadata = {
      pfPaymentId,
      mPaymentId,
      amountGross: raw.amount_gross ? parseFloat(raw.amount_gross) : undefined,
      amountFee: raw.amount_fee ? parseFloat(raw.amount_fee) : undefined,
      amountNet: raw.amount_net ? parseFloat(raw.amount_net) : undefined,
      currency: raw.currency || 'ZAR',
      paymentStatus
    };

    switch (paymentStatus) {
      case 'COMPLETE':
        return {
          success: true,
          event: 'payfast.itn.complete',
          orderCode,
          paymentIntentId: pfPaymentId,
          newStatus: 'paid',
          verified: true,
          gatewayMetadata
        };

      case 'FAILED':
        return {
          success: true,
          event: 'payfast.itn.failed',
          orderCode,
          paymentIntentId: pfPaymentId,
          newStatus: 'failed',
          verified: true,
          gatewayMetadata
        };

      case 'CANCELLED':
        return {
          success: true,
          event: 'payfast.itn.cancelled',
          orderCode,
          paymentIntentId: pfPaymentId,
          newStatus: 'cancelled',
          verified: true,
          gatewayMetadata
        };

      default:
        return {
          success: true,
          event: `payfast.itn.${paymentStatus.toLowerCase() || 'pending'}`,
          orderCode,
          paymentIntentId: pfPaymentId,
          newStatus: 'pending',
          verified: true,
          gatewayMetadata
        };
    }
  }

  async processRefund(request: RefundRequest): Promise<RefundResponse> {
    if (!request.orderId && !request.paymentReference) {
      return {
        success: false,
        provider: this.provider,
        status: 'paid',
        error: 'Order ID or PayFast reference is required to process refund.'
      };
    }

    return {
      success: false,
      provider: this.provider,
      status: 'paid',
      error: 'PayFast refunds require an authenticated provider refund workflow; no refund was created.'
    };
  }
}
