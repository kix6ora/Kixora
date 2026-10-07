// ==============================================================================
// KIXORA PAYMENT GATEWAY TYPES & CONTRACTS (Phase 3B)
// Core types and interfaces for modular payment gateway drivers.
// ==============================================================================

export type PaymentProviderType = 'mock' | 'payfast';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export interface PaymentIntentRequest {
  amount: number;
  currency?: string; // e.g. 'ZAR', 'USD'
  orderCode: string;
  customerEmail: string;
  customerName?: string;
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, any>;
}

export interface PaymentIntentResponse {
  success: boolean;
  provider: PaymentProviderType;
  paymentIntentId?: string;
  clientSecret?: string;
  redirectUrl?: string;
  status: PaymentStatus;
  publishableKey?: string;
  gatewayData?: Record<string, any>;
  error?: string;
  errorCode?: string;
}

export interface PaymentVerificationRequest {
  paymentIntentId: string;
  signature?: string;
  metadata?: Record<string, any>;
}

export interface PaymentVerificationResponse {
  success: boolean;
  provider: PaymentProviderType;
  status: PaymentStatus;
  transactionId?: string;
  amountPaid?: number;
  error?: string;
}

export interface PaymentWebhookPayload {
  provider?: PaymentProviderType;
  payload?: any;
  signature?: string;
  signatureHeader?: string;
  rawBody?: string;
  secret?: string;
  passphrase?: string;
  toleranceSeconds?: number;
}

export interface PaymentWebhookResponse {
  success: boolean;
  event: string;
  orderCode?: string;
  paymentIntentId?: string;
  newStatus?: PaymentStatus;
  verified?: boolean;
  gatewayMetadata?: Record<string, any>;
  error?: string;
}

export interface RefundRequest {
  orderId: string;
  paymentReference?: string;
  amount?: number;
  reason?: string;
}

export interface RefundResponse {
  success: boolean;
  provider: PaymentProviderType;
  refundId?: string;
  amountRefunded?: number;
  status: PaymentStatus;
  error?: string;
}

export interface PaymentGatewayDriver {
  readonly provider: PaymentProviderType;
  isConfigured(): boolean;
  createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntentResponse>;
  verifyPayment(request: PaymentVerificationRequest): Promise<PaymentVerificationResponse>;
  handleWebhook(payload: PaymentWebhookPayload): Promise<PaymentWebhookResponse>;
  processRefund(request: RefundRequest): Promise<RefundResponse>;
}
